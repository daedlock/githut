import { z } from "zod";

// ─── Users ──────────────────────────────────────────────────────────────────

export const IssueUserSchema = z.object({
  login: z.string(),
  avatar_url: z.string(),
  html_url: z.string().optional(),
});

/**
 * GitHub may return `null` for user on ghost/deleted accounts; normalize to
 * a safe "ghost" placeholder so downstream components don't need null guards.
 */
const NullableIssueUserSchema = IssueUserSchema.nullish().transform((user) => ({
  login: user?.login ?? "ghost",
  avatar_url: user?.avatar_url ?? "",
  html_url: user?.html_url,
}));

// ─── Labels ─────────────────────────────────────────────────────────────────

export const RawIssueLabelSchema = z.union([
  z.string(),
  z.object({
    id: z.number().optional(),
    name: z.string(),
    color: z.string().optional(),
    description: z.string().nullable().optional(),
  }),
]);

export type IssueLabel = {
  id: number;
  name: string;
  color: string;
  description: string | null;
};

function normalizeLabel(label: z.infer<typeof RawIssueLabelSchema>, index: number): IssueLabel {
  if (typeof label === "string") {
    return { id: -(index + 1), name: label, color: "d4d4d8", description: null };
  }
  return {
    id: label.id ?? index + 1,
    name: label.name,
    color: label.color ?? "d4d4d8",
    description: label.description ?? null,
  };
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export const ReactionsSchema = z
  .object({
    "+1": z.number().default(0),
    "-1": z.number().default(0),
    laugh: z.number().default(0),
    hooray: z.number().default(0),
    confused: z.number().default(0),
    heart: z.number().default(0),
    rocket: z.number().default(0),
    eyes: z.number().default(0),
  })
  .optional()
  .default({ "+1": 0, "-1": 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 });

export type ReactionContent =
  | "+1"
  | "-1"
  | "laugh"
  | "hooray"
  | "confused"
  | "heart"
  | "rocket"
  | "eyes";

export type ReactionsMap = z.infer<typeof ReactionsSchema>;

/**
 * Map of reactions the current viewer has added, keyed by content,
 * valued with the GitHub-assigned reaction id needed for DELETE toggle.
 * A negative id is a client-side placeholder while a POST is in flight.
 */
export type MyReactionsMap = Map<ReactionContent, number>;
export const EMPTY_MY_REACTIONS: MyReactionsMap = new Map();

/** Schema for the reactions list endpoint — used to build MyReactionsMap. */
export const ReactionListItemSchema = z.object({
  id: z.number(),
  content: z.enum(["+1", "-1", "laugh", "hooray", "confused", "heart", "rocket", "eyes"]),
  user: z.object({ id: z.number() }).nullable(),
});
export const ReactionListSchema = z.array(ReactionListItemSchema);

// ─── Issues ─────────────────────────────────────────────────────────────────

export const IssueListItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  state_reason: z.string().nullish(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  body: z
    .string()
    .nullable()
    .transform((b) => b ?? ""),
  user: NullableIssueUserSchema,
  labels: z.array(RawIssueLabelSchema).transform((ls) => ls.map(normalizeLabel)),
  assignees: z.array(NullableIssueUserSchema).default([]),
  milestone: z.object({ id: z.number(), title: z.string() }).nullish(),
  reactions: ReactionsSchema,
  pull_request: z.object({}).optional(),
});

export const IssueDetailSchema = IssueListItemSchema;

export const IssueCommentSchema = z.object({
  id: z.number(),
  body: z
    .string()
    .nullable()
    .transform((b) => b ?? ""),
  created_at: z.string(),
  updated_at: z.string(),
  user: NullableIssueUserSchema,
  reactions: ReactionsSchema,
});

export const IssueListSchema = z.array(IssueListItemSchema);
export const IssueCommentsSchema = z.array(IssueCommentSchema);

export type RepoIssue = z.infer<typeof IssueListItemSchema>;
export type RepoIssueComment = z.infer<typeof IssueCommentSchema>;
export type IssueUser = z.infer<typeof NullableIssueUserSchema>;
