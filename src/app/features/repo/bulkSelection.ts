// ─── Bulk selection model ──────────────────────────────────────────────────
//
// Pure logic behind multi-select on the issue and pull request lists:
// range toggling, tri-state coverage for pickers, planning the per-item
// writes an action needs (with the inverse of each, for undo and rollback),
// and running those writes with bounded concurrency.

export type BulkKind = "issues" | "pulls";
export type BulkStatus = "open" | "closed" | "not_planned";

export type BulkItem = {
  number: number;
  status: BulkStatus;
  /** Merged pull requests can be neither closed nor reopened. */
  merged: boolean;
  labels: readonly string[];
  assignees: readonly string[];
};

export type BulkAction =
  | { type: "status"; value: BulkStatus }
  | { type: "label"; value: string; add: boolean }
  | { type: "assignee"; value: string; add: boolean };

export type BulkJob = { number: number; action: BulkAction; undo: BulkAction };
export type BulkFailure = { job: BulkJob; message: string };
export type Coverage = "all" | "some" | "none";

type ListItemLike = {
  number: number;
  state: "open" | "closed";
  state_reason?: string | null;
  labels: readonly { name: string }[];
  assignees: readonly ({ login: string } | null)[];
  pull_request?: { merged_at?: string | null } | null;
};

export function toBulkItem(item: ListItemLike): BulkItem {
  return {
    number: item.number,
    status:
      item.state === "open"
        ? "open"
        : item.state_reason === "not_planned" || item.state_reason === "duplicate"
          ? "not_planned"
          : "closed",
    merged: !!item.pull_request?.merged_at,
    labels: item.labels.map((label) => label.name),
    assignees: item.assignees.flatMap((user) => (user ? [user.login] : [])),
  };
}

/** Toggle the row at `index`; with `range`, apply its new state from the anchor to it. */
export function toggleSelection(
  selected: ReadonlySet<number>,
  order: readonly number[],
  index: number,
  anchor: number | null,
  range: boolean,
): Set<number> {
  const next = new Set(selected);
  const number = order[index];
  if (number === undefined) return next;
  const from = anchor ?? -1;
  const targets =
    range && from >= 0 && from < order.length
      ? order.slice(Math.min(from, index), Math.max(from, index) + 1)
      : [number];
  const removing = selected.has(number);
  for (const target of targets) {
    if (removing) next.delete(target);
    else next.add(target);
  }
  return next;
}

export function coverage(items: readonly BulkItem[], has: (item: BulkItem) => boolean): Coverage {
  const count = items.filter(has).length;
  return count === 0 ? "none" : count === items.length ? "all" : "some";
}

export const sameLogin = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** One write per item the action would actually change, each paired with its inverse. */
export function planJobs(items: readonly BulkItem[], action: BulkAction): BulkJob[] {
  return items.flatMap((item): BulkJob[] => {
    if (action.type === "status") {
      if (item.merged || item.status === action.value) return [];
      return [{ number: item.number, action, undo: { type: "status", value: item.status } }];
    }
    const has =
      action.type === "label"
        ? item.labels.includes(action.value)
        : item.assignees.some((login) => sameLogin(login, action.value));
    if (has === action.add) return [];
    return [{ number: item.number, action, undo: { ...action, add: !action.add } }];
  });
}

/** Swap each job for its inverse, so undo runs through the same pipeline. */
export function invertJobs(jobs: readonly BulkJob[]): BulkJob[] {
  return jobs.map((job) => ({ number: job.number, action: job.undo, undo: job.action }));
}

/** Run writes with bounded concurrency; failures are collected, never thrown. */
export async function runBulkJobs(
  jobs: readonly BulkJob[],
  run: (job: BulkJob) => Promise<unknown>,
  concurrency = 4,
): Promise<BulkFailure[]> {
  const failures: BulkFailure[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        if (!job) break;
        try {
          await run(job);
        } catch (error) {
          failures.push({
            job,
            message: error instanceof Error ? error.message : "Update failed",
          });
        }
      }
    }),
  );
  return failures;
}

function subject(kind: BulkKind, numbers: readonly number[]) {
  if (numbers.length === 1) return `#${numbers[0]}`;
  return `${numbers.length} ${kind === "issues" ? "issues" : "pull requests"}`;
}

/** Past-tense summary of a completed action, e.g. "Added bug to 3 issues". */
export function describeAction(kind: BulkKind, action: BulkAction, numbers: readonly number[]) {
  const what = subject(kind, numbers);
  switch (action.type) {
    case "status":
      return action.value === "open"
        ? `Reopened ${what}`
        : action.value === "not_planned"
          ? `Closed ${what} as not planned`
          : `Closed ${what}`;
    case "label":
      return action.add
        ? `Added ${action.value} to ${what}`
        : `Removed ${action.value} from ${what}`;
    case "assignee":
      return action.add
        ? `Assigned ${action.value} to ${what}`
        : `Unassigned ${action.value} from ${what}`;
  }
}

export function describeFailure(kind: BulkKind, failed: readonly number[], total: number) {
  if (failed.length === total || total < 2) return `Couldn't update ${subject(kind, failed)}`;
  return `Couldn't update ${failed.length} of ${total} ${kind === "issues" ? "issues" : "pull requests"}`;
}
