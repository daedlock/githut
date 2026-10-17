import { type InfiniteData, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { issueKeys } from "@/app/features/issues/hooks";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { type PrListItem, pullsKeys } from "@/app/features/pulls/hooks";
import type { RepoLabel } from "@/app/features/pulls/pickers";
import {
  type BulkAction,
  type BulkJob,
  type BulkKind,
  describeAction,
  describeFailure,
  invertJobs,
  runBulkJobs,
  sameLogin,
} from "@/app/features/repo/bulkSelection";
import { assertCanMutate } from "@/app/lib/connectivity";
import { githubAvatarUrl } from "@/app/lib/github/appActors";
import { getGitHubClient } from "@/app/lib/github/client";

// ─── Bulk writes ───────────────────────────────────────────────────────────
//
// Every action is applied to the list caches first, so rows change the moment
// a picker option is chosen. Writes then run in the background; rows whose
// write fails are put back, and the notice offers a retry. Successful batches
// can be undone by running each job's inverse through the same pipeline.

export type BulkTarget = { owner: string; repo: string; kind: BulkKind };
export type BulkUser = { login: string; avatar_url: string };
export type BulkLookups = { labels: readonly RepoLabel[]; users: readonly BulkUser[] };

export type BulkNotice =
  | { id: number; tone: "success"; message: string; undo: BulkJob[] | null }
  | { id: number; tone: "error"; message: string; detail: string; retry: BulkJob[] };

function isNotFound(error: unknown) {
  return error instanceof Error && "status" in error && error.status === 404;
}

async function sendJob({ owner, repo, kind }: BulkTarget, { number, action }: BulkJob) {
  const client = getGitHubClient();
  const issue = { owner, repo, issue_number: number };
  if (action.type === "status") {
    const state = action.value === "open" ? "open" : "closed";
    if (kind === "pulls") {
      await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
        state,
      });
      return;
    }
    await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
      ...issue,
      state,
      state_reason:
        action.value === "open"
          ? "reopened"
          : action.value === "not_planned"
            ? "not_planned"
            : "completed",
    });
    return;
  }
  if (action.type === "label") {
    if (action.add) {
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
        ...issue,
        labels: [action.value],
      });
      return;
    }
    try {
      await client.request("DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}", {
        ...issue,
        name: action.value,
      });
    } catch (error) {
      // Already gone is the outcome we wanted.
      if (!isNotFound(error)) throw error;
    }
    return;
  }
  const res = action.add
    ? await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
        ...issue,
        assignees: [action.value],
      })
    : await client.request("DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
        ...issue,
        assignees: [action.value],
      });
  // GitHub silently drops logins that can't be assigned; the response tells the truth.
  const assignees = (res.data as { assignees?: { login: string }[] | null } | undefined)?.assignees;
  if (!Array.isArray(assignees)) return;
  if (assignees.some((user) => sameLogin(user.login, action.value)) !== action.add) {
    throw new Error(
      action.add
        ? `${action.value} can't be assigned in this repository`
        : `${action.value} couldn't be unassigned`,
    );
  }
}

// ─── Optimistic cache patches ──────────────────────────────────────────────

type LabelLike = { id: number; name: string; color: string; description?: string | null };
type UserLike = { login: string; avatar_url: string };

function toggleLabel<L extends LabelLike>(
  labels: L[],
  action: Extract<BulkAction, { type: "label" }>,
  lookups: BulkLookups,
): L[] {
  const rest = labels.filter((label) => label.name !== action.value);
  if (!action.add) return rest;
  const known = lookups.labels.find((label) => label.name === action.value);
  const label = {
    id: known?.id ?? -1,
    name: action.value,
    color: known?.color ?? "d4d4d8",
    description: known?.description ?? null,
  } as L;
  return [...rest, label];
}

function toggleUser<U extends UserLike>(
  users: U[],
  action: Extract<BulkAction, { type: "assignee" }>,
  lookups: BulkLookups,
): U[] {
  const rest = users.filter((user) => !sameLogin(user.login, action.value));
  if (!action.add) return rest;
  const known = lookups.users.find((user) => sameLogin(user.login, action.value));
  return [
    ...rest,
    {
      login: known?.login ?? action.value,
      avatar_url: known?.avatar_url ?? githubAvatarUrl(action.value),
    } as U,
  ];
}

function patchIssue(issue: RepoIssue, action: BulkAction, lookups: BulkLookups): RepoIssue {
  if (action.type === "label")
    return { ...issue, labels: toggleLabel(issue.labels, action, lookups) };
  if (action.type === "assignee")
    return { ...issue, assignees: toggleUser(issue.assignees, action, lookups) };
  const open = action.value === "open";
  return {
    ...issue,
    state: open ? "open" : "closed",
    state_reason: open ? "reopened" : action.value === "not_planned" ? "not_planned" : "completed",
    closed_at: open ? null : (issue.closed_at ?? new Date().toISOString()),
  };
}

function patchPull(pr: PrListItem, action: BulkAction, lookups: BulkLookups): PrListItem {
  if (action.type === "label") return { ...pr, labels: toggleLabel(pr.labels, action, lookups) };
  if (action.type === "assignee")
    return { ...pr, assignees: toggleUser(pr.assignees, action, lookups) };
  const open = action.value === "open";
  return {
    ...pr,
    state: open ? "open" : "closed",
    closed_at: open ? null : (pr.closed_at ?? new Date().toISOString()),
  };
}

function patchLists(
  qc: QueryClient,
  { owner, repo, kind }: BulkTarget,
  changes: readonly { number: number; action: BulkAction }[],
  lookups: BulkLookups,
) {
  if (!changes.length) return;
  const byNumber = new Map(changes.map((change) => [change.number, change.action]));
  if (kind === "issues") {
    qc.setQueryData<RepoIssue[]>(issueKeys.all(owner, repo), (issues) =>
      issues?.map((issue) => {
        const action = byNumber.get(issue.number);
        return action ? patchIssue(issue, action, lookups) : issue;
      }),
    );
    return;
  }
  qc.setQueriesData<InfiniteData<PrListItem[]>>(
    { queryKey: pullsKeys.lists(owner, repo) },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) =>
          page.map((pr) => {
            const action = byNumber.get(pr.number);
            return action ? patchPull(pr, action, lookups) : pr;
          }),
        ),
      },
  );
  const reopened = changes.reduce(
    (delta, { action }) =>
      action.type === "status" ? delta + (action.value === "open" ? 1 : -1) : delta,
    0,
  );
  if (reopened) {
    qc.setQueryData<{ open: number; closed: number }>(
      pullsKeys.counts(owner, repo),
      (counts) =>
        counts && { open: counts.open + reopened, closed: Math.max(0, counts.closed - reopened) },
    );
  }
}

function describeJobs(kind: BulkKind, jobs: readonly BulkJob[]) {
  const [first] = jobs;
  const numbers = jobs.map((job) => job.number);
  const uniform = jobs.every((job) => JSON.stringify(job.action) === JSON.stringify(first?.action));
  if (first && uniform) return describeAction(kind, first.action, numbers);
  return `Restored ${numbers.length === 1 ? `#${numbers[0]}` : `${numbers.length} ${kind === "issues" ? "issues" : "pull requests"}`}`;
}

// Octokit appends a docs link to API errors; it is noise in a one-line notice.
const cleanMessage = (message: string) => message.split(" - https://")[0] ?? message;

let nextNoticeId = 1;

export function useBulkActions(target: BulkTarget, lookups: BulkLookups) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState<BulkNotice | null>(null);
  const inflight = useRef(0);
  const touched = useRef(new Set<number>());
  const latest = useRef({ target, lookups });
  latest.current = { target, lookups };

  const settle = useCallback(() => {
    const { owner, repo, kind } = latest.current.target;
    const numbers = [...touched.current];
    touched.current.clear();
    if (kind === "issues") {
      // The REST list is consistent immediately, so reconcile with it now.
      void qc.invalidateQueries({ queryKey: issueKeys.all(owner, repo) });
    } else {
      // Search lags writes by a few seconds; refetching now would briefly undo
      // the optimistic rows. Mark stale and let the next visit reconcile.
      void qc.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo), refetchType: "none" });
      void qc.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo), refetchType: "none" });
    }
    for (const number of numbers) {
      void qc.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, number) });
      void qc.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) });
    }
  }, [qc]);

  const run = useCallback(
    async (jobs: BulkJob[], { undoable = true } = {}) => {
      if (!jobs.length) return;
      const { target: current, lookups: currentLookups } = latest.current;
      try {
        assertCanMutate();
        if (current.kind === "issues")
          await qc.cancelQueries({ queryKey: issueKeys.all(current.owner, current.repo) });
        else await qc.cancelQueries({ queryKey: pullsKeys.lists(current.owner, current.repo) });
        assertCanMutate();
      } catch (error) {
        setNotice({
          id: nextNoticeId++,
          tone: "error",
          message: "Changes unavailable",
          detail: error instanceof Error ? error.message : "Try again when connected.",
          retry: jobs,
        });
        return;
      }
      patchLists(qc, current, jobs, currentLookups);
      // The last result no longer describes the list; a new one follows shortly.
      setNotice((previous) => (previous?.tone === "success" ? null : previous));
      for (const job of jobs) touched.current.add(job.number);
      inflight.current++;
      setPending((count) => count + 1);

      const failures = await runBulkJobs(jobs, (job) => sendJob(current, job));
      const failed = new Set(failures.map((failure) => failure.job));
      // Put failed rows back exactly as they were before this batch.
      patchLists(
        qc,
        current,
        failures.map(({ job }) => ({ number: job.number, action: job.undo })),
        currentLookups,
      );
      const done = jobs.filter((job) => !failed.has(job));
      const id = nextNoticeId++;
      if (failures.length) {
        setNotice({
          id,
          tone: "error",
          message: describeFailure(
            current.kind,
            failures.map(({ job }) => job.number),
            jobs.length,
          ),
          detail: cleanMessage(failures[0]?.message ?? ""),
          retry: failures.map(({ job }) => job),
        });
      } else {
        // Never bury an unresolved failure under a later success.
        setNotice((previous) =>
          previous?.tone === "error"
            ? previous
            : {
                id,
                tone: "success",
                message: describeJobs(current.kind, done),
                undo: undoable ? invertJobs(done) : null,
              },
        );
      }
      inflight.current--;
      setPending((count) => count - 1);
      if (inflight.current === 0) settle();
    },
    [qc, settle],
  );

  const retry = useCallback(() => {
    if (notice?.tone !== "error") return;
    setNotice(null);
    void run(notice.retry);
  }, [notice, run]);

  const undo = useCallback(() => {
    if (notice?.tone !== "success" || !notice.undo) return;
    setNotice(null);
    void run(notice.undo, { undoable: false });
  }, [notice, run]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { run, pending: pending > 0, notice, retry, undo, dismiss };
}
