import { z } from "zod";

// ─── Core PR schema ────────────────────────────────────────────────────────
//
// Shaped from REST `/repos/{o}/{r}/pulls/{n}` response. Fields required to
// render the detail header + permission-gate mutations live here; every
// derived display concept (UiState, review decision) is computed in
// `lib/prStatus.ts` and `lib/reviewDecision.ts` respectively.

const UserRefSchema = z
  .object({
    login: z.string(),
    avatar_url: z.string(),
    html_url: z.string().optional(),
  })
  .nullable();

const LabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
});

const RefSchema = z.object({
  label: z.string(),
  ref: z.string(),
  sha: z.string(),
  repo: z
    .object({
      id: z.number(),
      name: z.string(),
      full_name: z.string(),
    })
    .nullable(),
});

const AutoMergeSchema = z
  .object({
    enabled_by: UserRefSchema,
    merge_method: z.enum(["merge", "squash", "rebase"]),
    commit_title: z.string().nullable().optional(),
    commit_message: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const PullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  state: z.enum(["open", "closed"]),
  locked: z.boolean(),
  title: z.string(),
  body: z.string().nullable(),
  draft: z.boolean().optional().default(false),
  merged: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional(),
  merged_by: UserRefSchema.optional(),
  mergeable: z.boolean().nullable().optional(),
  mergeable_state: z.string().optional(),
  rebaseable: z.boolean().nullable().optional(),
  comments: z.number(),
  review_comments: z.number(),
  commits: z.number(),
  additions: z.number(),
  deletions: z.number(),
  changed_files: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  user: UserRefSchema,
  assignees: z.array(z.object({ login: z.string(), avatar_url: z.string() })).default([]),
  requested_reviewers: z
    .array(z.object({ login: z.string(), avatar_url: z.string() }))
    .default([]),
  labels: z.array(LabelSchema).default([]),
  milestone: z
    .object({ id: z.number(), title: z.string(), state: z.string() })
    .nullable()
    .optional(),
  head: RefSchema,
  base: RefSchema,
  auto_merge: AutoMergeSchema,
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const PullRequestsResponseSchema = z.array(PullRequestSchema);

// ─── Review ────────────────────────────────────────────────────────────────

export const ReviewStateSchema = z.enum([
  "PENDING",
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
]);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const ReviewSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  user: UserRefSchema,
  body: z.string().nullable(),
  state: ReviewStateSchema,
  html_url: z.string(),
  pull_request_url: z.string(),
  submitted_at: z.string().nullable().optional(),
  commit_id: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewsResponseSchema = z.array(ReviewSchema);

// ─── Review comment (inline on diff) ───────────────────────────────────────

export const ReviewCommentSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  pull_request_review_id: z.number().nullable(),
  url: z.string(),
  html_url: z.string(),
  user: UserRefSchema,
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  path: z.string(),
  // `position` is deprecated; modern is `line` + `side` + `start_line` +
  // `start_side` for multi-line. Keep both nullable for legacy rows.
  position: z.number().nullable().optional(),
  original_position: z.number().nullable().optional(),
  line: z.number().nullable().optional(),
  original_line: z.number().nullable().optional(),
  side: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  start_line: z.number().nullable().optional(),
  start_side: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  commit_id: z.string(),
  original_commit_id: z.string().optional(),
  in_reply_to_id: z.number().optional(),
  diff_hunk: z.string(),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

export const ReviewCommentsResponseSchema = z.array(ReviewCommentSchema);

// ─── Issue comment (PR conversation level) ─────────────────────────────────

export const IssueCommentOnPrSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  user: UserRefSchema,
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IssueCommentOnPr = z.infer<typeof IssueCommentOnPrSchema>;

// ─── Files changed ─────────────────────────────────────────────────────────

export const PrFileSchema = z.object({
  sha: z.string().optional(),
  filename: z.string(),
  previous_filename: z.string().optional(),
  status: z.enum(["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"]),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  patch: z.string().nullish().transform((p) => p ?? null),
  blob_url: z.string().optional(),
  raw_url: z.string().optional(),
});
export type PrFile = z.infer<typeof PrFileSchema>;

export const PrFilesResponseSchema = z.array(PrFileSchema);

// ─── Timeline event ────────────────────────────────────────────────────────
//
// The timeline endpoint returns a heterogeneous event list — we lean on
// `event` as the discriminator and keep most fields optional since each
// event type only populates a subset.

export const TimelineEventSchema = z.object({
  id: z.number().optional(),
  node_id: z.string().optional(),
  event: z.string(), // "commented", "reviewed", "labeled", "assigned", "head_ref_force_pushed", ...
  actor: UserRefSchema.optional(),
  created_at: z.string().optional(),
  submitted_at: z.string().optional(), // reviews use submitted_at
  // Event-specific payloads — loose by design. UI narrows on `event`.
  body: z.string().optional(),
  state: z.string().optional(),
  label: z.object({ name: z.string(), color: z.string() }).optional(),
  assignee: z.object({ login: z.string(), avatar_url: z.string() }).optional(),
  requested_reviewer: z
    .object({ login: z.string(), avatar_url: z.string() })
    .optional(),
  commit_id: z.string().nullable().optional(),
  milestone: z.object({ title: z.string() }).optional(),
  rename: z.object({ from: z.string(), to: z.string() }).optional(),
  source: z
    .object({ issue: z.object({ number: z.number(), html_url: z.string() }).nullable().optional() })
    .optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineEventsResponseSchema = z.array(TimelineEventSchema);
