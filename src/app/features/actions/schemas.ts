import { z } from "zod";

// ─── Raw GitHub enums ──────────────────────────────────────────────────────
//
// Kept as string unions (not exhaustive enums) so a new GitHub value doesn't
// crash Zod parsing. `toUiStatus` collapses whatever we receive into the
// narrow union the UI actually cares about.

export const RunStatusSchema = z.enum([
  "queued",
  "in_progress",
  "completed",
  "waiting",
  "pending",
  "requested",
  "action_required",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunConclusionSchema = z
  .enum([
    "success",
    "failure",
    "cancelled",
    "skipped",
    "timed_out",
    "action_required",
    "neutral",
    "stale",
    "startup_failure",
  ])
  .nullable();
export type RunConclusion = z.infer<typeof RunConclusionSchema>;

// ─── Actors ────────────────────────────────────────────────────────────────

const ActorSchema = z
  .object({
    login: z.string(),
    avatar_url: z.string(),
  })
  .nullable();

// ─── Workflow ──────────────────────────────────────────────────────────────

export const WorkflowSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  path: z.string(),
  state: z.enum(["active", "deleted", "disabled_fork", "disabled_inactivity", "disabled_manually"]),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
  badge_url: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowsResponseSchema = z.object({
  total_count: z.number(),
  workflows: z.array(WorkflowSchema),
});

// ─── Run ───────────────────────────────────────────────────────────────────

export const WorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  display_title: z.string(),
  head_branch: z.string().nullable(),
  head_sha: z.string(),
  path: z.string(),
  run_number: z.number(),
  run_attempt: z.number(),
  event: z.string(),
  status: RunStatusSchema,
  conclusion: RunConclusionSchema,
  workflow_id: z.number(),
  url: z.string(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  run_started_at: z.string().optional(),
  actor: ActorSchema,
  triggering_actor: ActorSchema,
  head_commit: z
    .object({
      id: z.string(),
      message: z.string(),
      timestamp: z.string(),
      author: z.object({ name: z.string(), email: z.string() }).nullable(),
    })
    .nullable(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const WorkflowRunsResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(WorkflowRunSchema),
});

// ─── Job + step ────────────────────────────────────────────────────────────

export const StepSchema = z.object({
  name: z.string(),
  status: RunStatusSchema,
  conclusion: RunConclusionSchema,
  number: z.number(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const JobSchema = z.object({
  id: z.number(),
  run_id: z.number(),
  run_attempt: z.number().optional(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string().nullable(),
  status: RunStatusSchema,
  conclusion: RunConclusionSchema,
  name: z.string(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  steps: z.array(StepSchema).default([]),
  runner_name: z.string().nullable().optional(),
  runner_group_name: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
});
export type Job = z.infer<typeof JobSchema>;

export const JobsResponseSchema = z.object({
  total_count: z.number(),
  jobs: z.array(JobSchema),
});

// ─── Artifacts ─────────────────────────────────────────────────────────────

export const ArtifactSchema = z.object({
  id: z.number(),
  name: z.string(),
  size_in_bytes: z.number(),
  url: z.string(),
  archive_download_url: z.string(),
  expired: z.boolean(),
  created_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  workflow_run: z
    .object({ id: z.number(), head_branch: z.string().nullable(), head_sha: z.string() })
    .nullable()
    .optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ArtifactsResponseSchema = z.object({
  total_count: z.number(),
  artifacts: z.array(ArtifactSchema),
});
