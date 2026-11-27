import { useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  GitMerge,
  GitPullRequestClosed,
  Loader2,
  MinusCircle,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { CheckRunPeek } from "@/app/features/pulls/components/CheckRunPeek";
import { PrMergeDialog } from "@/app/features/pulls/components/PrMergeDialog";
import {
  type CheckRun,
  isMergeabilityPollExhausted,
  type MergeMethod,
  type PrChecksData,
  type PrMergeStatusData,
  pullsKeys,
  resetMergeabilityPoll,
  useDeletePrHeadRef,
  useMergePr,
  usePrChecks,
  usePrMergeStatus,
  useRestorePrHeadRef,
  useSetPrAutoMerge,
  useTogglePrState,
  useUpdatePrBranch,
} from "@/app/features/pulls/hooks";
import {
  type BypassReason,
  type BypassStatus,
  buildCheckBreakdown,
  type CheckBreakdown,
  type CheckSummary,
  evaluateMergeReadiness,
  hasLiveChecks,
  type MergeabilityState,
  resolveMergeability,
  summarizeChecks,
} from "@/app/features/pulls/lib/mergeReadiness";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { useRepo } from "@/app/hooks/useRepo";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";
import { evictETagsForRepo } from "@/app/lib/github/client";
import { formatRelativeTime } from "@/app/lib/time";

export function PrMergeBox({ owner, repo, pr }: { owner: string; repo: string; pr: PullRequest }) {
  const state = toUiState(pr);
  const queryClient = useQueryClient();
  const repoQuery = useRepo(owner, repo);
  const merge = useMergePr(owner, repo, pr.number);
  const toggleState = useTogglePrState(owner, repo, pr.number);
  const { canMutate, reason: cannotMutateReason } = useCanMutate();
  const checksQuery = usePrChecks(owner, repo, pr.head.sha);
  const mergeStatusQuery = usePrMergeStatus(owner, repo, pr.number, pr.base.ref);
  const updateBranch = useUpdatePrBranch(owner, repo, pr.number);
  const autoMerge = useSetPrAutoMerge(owner, repo, pr.number);
  const deleteHeadRef = useDeletePrHeadRef(owner, repo, pr.number);
  const restoreHeadRef = useRestorePrHeadRef(owner, repo, pr.number);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [autoMergeOpen, setAutoMergeOpen] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);

  const mergeStatus = mergeStatusQuery.data;
  const allowedMethods = useMemo(() => allowedMergeMethods(repoQuery.data), [repoQuery.data]);
  const checkBreakdown = useMemo(
    () => buildCheckBreakdown(checksQuery.data, mergeStatus),
    [checksQuery.data, mergeStatus],
  );

  // When live CI checks finish, refresh PR detail + mergeStatus so the merge box
  // immediately transitions out of BLOCKED/pending without hanging on stale data.
  const checksLive = hasLiveChecks(checksQuery.data);
  const prevChecksLiveRef = useRef<{ sha: string; live: boolean }>({
    sha: pr.head.sha,
    live: checksLive,
  });
  useEffect(() => {
    const prev = prevChecksLiveRef.current;
    prevChecksLiveRef.current = { sha: pr.head.sha, live: checksLive };
    if (prev.sha === pr.head.sha && prev.live && !checksLive) {
      evictETagsForRepo(owner, repo);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, pr.number) }),
        queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, pr.number) }),
      ]);
    }
  }, [checksLive, owner, pr.head.sha, pr.number, queryClient, repo]);

  const handleRefreshStatus = () => {
    evictETagsForRepo(owner, repo);
    resetMergeabilityPoll(owner, repo, pr.number);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, pr.number) }),
      queryClient.invalidateQueries({ queryKey: pullsKeys.mergeStatus(owner, repo, pr.number) }),
      queryClient.invalidateQueries({ queryKey: pullsKeys.checks(owner, repo, pr.head.sha) }),
    ]);
  };

  if (state === "merged") {
    return (
      <TerminalBox
        tone="merged"
        icon={GitMerge}
        title="Merged and closed"
        detail={pr.merged_by ? `by ${pr.merged_by.login}` : undefined}
        actions={
          <HeadBranchActions
            pr={pr}
            mergeStatus={mergeStatus}
            deletePending={deleteHeadRef.isPending}
            restorePending={restoreHeadRef.isPending}
            onDelete={() => deleteHeadRef.mutate({ pr })}
            onRestore={() => restoreHeadRef.mutate({ pullRequestId: pr.node_id })}
          />
        }
      />
    );
  }

  if (state === "closed") {
    return (
      <TerminalBox
        tone="danger"
        icon={GitPullRequestClosed}
        title="Closed"
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={toggleState.isPending || !canMutate}
            title={cannotMutateReason}
            onClick={() => toggleState.mutate({ state: "open" })}
          >
            Reopen
          </Button>
        }
      />
    );
  }

  const mergeability = resolveMergeability(pr, mergeStatus);
  const hasConflicts = mergeability === "conflicting";
  const isCheckingMergeability = mergeability === "checking";
  const mergeabilityTimedOut =
    isCheckingMergeability && isMergeabilityPollExhausted(owner, repo, pr.number, pr.head.sha);
  const isBehind = pr.mergeable_state === "behind" || mergeStatus?.mergeStateStatus === "BEHIND";

  const previewReadiness = evaluateMergeReadiness({
    state,
    mergeability,
    mergeabilityTimedOut,
    blockedByRequirements: true,
    allowedMethods,
    repoPermissions: repoQuery.data?.permissions,
    mergeStatus,
  });

  const requirements = buildRequirements({
    pr,
    state,
    mergeStatus,
    checksPending: checksQuery.isPending,
    checksError: checksQuery.isError,
    checkBreakdown,
    hasConflicts,
    isBehind,
    bypassStatus: previewReadiness.bypassStatus,
    onUpdateBranch: () => updateBranch.mutate({ expectedHeadSha: pr.head.sha }),
    updateBranchPending: updateBranch.isPending || !canMutate,
  });
  const blockedByRequirements = requirements.some((item) => item.blocksMerge);
  const readiness = evaluateMergeReadiness({
    state,
    mergeability,
    mergeabilityTimedOut,
    blockedByRequirements,
    allowedMethods,
    repoPermissions: repoQuery.data?.permissions,
    mergeStatus,
  });
  const {
    canMergeNow,
    canBypassRequirements,
    canOpenMergeDialog,
    bypassStatus,
    bypassReason,
    viewerCanMerge,
  } = readiness;

  const canEnableAutoMerge =
    repoQuery.data?.allow_auto_merge !== false &&
    !mergeStatus?.autoMergeRequest &&
    !!mergeStatus?.viewerCanEnableAutoMerge &&
    state !== "draft" &&
    !hasConflicts &&
    allowedMethods.length > 0;

  const isRefreshing = checksQuery.isFetching || mergeStatusQuery.isFetching;

  const accentVar = hasConflicts
    ? "--color-danger"
    : canMergeNow
      ? "--color-success"
      : state === "draft"
        ? "--color-fg-faint"
        : "--color-warning";

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        borderColor: `color-mix(in oklab, var(${accentVar}) 40%, var(--color-border))`,
        backgroundColor: `color-mix(in oklab, var(${accentVar}) 6%, var(--color-bg))`,
      }}
    >
      <ChecksSection
        owner={owner}
        repo={repo}
        loading={checksQuery.isPending}
        error={checksQuery.isError}
        data={checksQuery.data}
        expanded={checksExpanded}
        onExpandedChange={setChecksExpanded}
        breakdown={checkBreakdown}
      />

      <RequirementsSection
        requirements={requirements}
        mergeStatusLoading={mergeStatusQuery.isPending}
        mergeStatusError={mergeStatusQuery.isError}
        isRefreshing={isRefreshing}
        onRefresh={handleRefreshStatus}
      />

      {mergeStatus?.autoMergeRequest && (
        <AutoMergeBanner
          request={mergeStatus.autoMergeRequest}
          canDisable={mergeStatus.viewerCanDisableAutoMerge}
          disabled={autoMerge.isPending || !canMutate}
          onDisable={() => autoMerge.mutate({ pullRequestId: pr.node_id, enabled: false })}
        />
      )}

      <div className="flex items-center gap-3 border-t border-border/40 px-4 py-3">
        <ReadinessIcon
          hasConflicts={hasConflicts}
          checking={isCheckingMergeability && !mergeabilityTimedOut}
          draft={state === "draft"}
          ready={canMergeNow}
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-foreground">
            {readinessTitle({
              hasConflicts,
              mergeability,
              mergeabilityTimedOut,
              state,
              canMergeNow,
              canBypassRequirements,
              bypassStatus,
              bypassReason,
              isBehind,
              mergeStatus,
            })}
          </p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {readinessDetail({
              hasConflicts,
              mergeability,
              mergeabilityTimedOut,
              state,
              canMergeNow,
              canBypassRequirements,
              bypassStatus,
              bypassReason,
              viewerCanMerge,
              isBehind,
              mergeStatus,
              allowedMethods,
            })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mergeabilityTimedOut && (
            <Button size="sm" variant="outline" onClick={handleRefreshStatus}>
              <RefreshCcw data-icon="inline-start" />
              Retry
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={toggleState.isPending || !canMutate}
            title={cannotMutateReason}
            onClick={() => toggleState.mutate({ state: "closed" })}
          >
            Close
          </Button>
          {canEnableAutoMerge && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canMutate}
              title={cannotMutateReason}
              onClick={() => {
                autoMerge.reset();
                setAutoMergeOpen(true);
              }}
            >
              <Clock data-icon="inline-start" />
              Auto-merge
            </Button>
          )}
          {state !== "draft" && !hasConflicts && viewerCanMerge && (
            <Button
              size="sm"
              disabled={merge.isPending || !canOpenMergeDialog || !canMutate}
              onClick={() => {
                merge.reset();
                setMergeOpen(true);
              }}
              className={cn(
                "border text-foreground",
                canBypassRequirements
                  ? "border-[color-mix(in_oklab,var(--color-warning)_50%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-warning)_12%,var(--color-bg-subtle))] hover:bg-[color-mix(in_oklab,var(--color-warning)_20%,var(--color-bg-subtle))]"
                  : "border-[color-mix(in_oklab,var(--color-success)_50%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_12%,var(--color-bg-subtle))] hover:bg-[color-mix(in_oklab,var(--color-success)_20%,var(--color-bg-subtle))]",
              )}
              title={
                cannotMutateReason ??
                (canOpenMergeDialog
                  ? undefined
                  : isCheckingMergeability && !mergeabilityTimedOut
                    ? "Checking whether this branch can be merged cleanly"
                    : "Resolve merge requirements first, or use a GitHub account with bypass access")
              }
            >
              <GitMerge data-icon="inline-start" />
              {canBypassRequirements ? "Bypass and merge" : "Merge"}
            </Button>
          )}
        </div>
      </div>

      <PrMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        pr={pr}
        isPending={merge.isPending}
        intent={canBypassRequirements ? "admin-merge" : "merge"}
        allowedMethods={allowedMethods}
        errorMessage={merge.isError ? formatMutationError(merge.error) : undefined}
        onConfirm={(vars) =>
          merge.mutate(
            {
              ...vars,
              pullRequestId: pr.node_id,
              expectedHeadOid: pr.head.sha,
              bypassRequirements: canBypassRequirements,
            },
            { onSuccess: () => setMergeOpen(false) },
          )
        }
      />
      <PrMergeDialog
        open={autoMergeOpen}
        onOpenChange={setAutoMergeOpen}
        pr={pr}
        intent="auto-merge"
        isPending={autoMerge.isPending}
        allowedMethods={allowedMethods}
        errorMessage={autoMerge.isError ? formatMutationError(autoMerge.error) : undefined}
        onConfirm={(vars) =>
          autoMerge.mutate(
            {
              pullRequestId: pr.node_id,
              enabled: true,
              method: vars.method,
              commitTitle: vars.commitTitle,
              commitMessage: vars.commitMessage,
            },
            { onSuccess: () => setAutoMergeOpen(false) },
          )
        }
      />
    </div>
  );
}

function TerminalBox({
  tone,
  icon: Icon,
  title,
  detail,
  actions,
}: {
  tone: "merged" | "danger";
  icon: LucideIcon;
  title: string;
  detail?: string;
  actions?: React.ReactNode;
}) {
  const color = tone === "merged" ? "--color-pr-merged" : "--color-danger";
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-4"
      style={{
        borderColor: `color-mix(in oklab, var(${color}) 40%, var(--color-border))`,
        backgroundColor: `color-mix(in oklab, var(${color}) 6%, var(--color-bg))`,
      }}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `var(${color})` }}
      >
        <Icon className="size-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-foreground">{title}</p>
        {detail && <p className="mt-0.5 text-caption text-muted-foreground">{detail}</p>}
      </div>
      {actions}
    </div>
  );
}

function HeadBranchActions({
  pr,
  mergeStatus,
  deletePending,
  restorePending,
  onDelete,
  onRestore,
}: {
  pr: PullRequest;
  mergeStatus: PrMergeStatusData | undefined;
  deletePending: boolean;
  restorePending: boolean;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const { canMutate, reason } = useCanMutate();
  if (!mergeStatus) return null;
  if (
    mergeStatus.headRefExists &&
    mergeStatus.viewerCanDeleteHeadRef &&
    pr.head.ref !== pr.base.ref
  ) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={deletePending || !canMutate}
        title={reason}
        onClick={onDelete}
      >
        <Trash2 data-icon="inline-start" />
        Delete branch
      </Button>
    );
  }
  if (!mergeStatus.headRefExists) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={restorePending || !canMutate}
        title={reason}
        onClick={onRestore}
      >
        <RotateCcw data-icon="inline-start" />
        Restore branch
      </Button>
    );
  }
  return null;
}

function ChecksSection({
  owner,
  repo,
  loading,
  error,
  data,
  expanded,
  onExpandedChange,
  breakdown,
}: {
  owner: string;
  repo: string;
  loading: boolean;
  error: boolean;
  data: PrChecksData | undefined;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  breakdown: CheckBreakdown;
}) {
  const total = data ? data.checkRuns.length + data.combined.statuses.length : 0;
  const summary = data ? summarizeChecks(data) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left",
          "outline-none transition-colors hover:bg-[color-mix(in_oklab,var(--color-fg)_4%,transparent)]",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        {loading ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-body text-muted-foreground">Loading checks…</span>
          </>
        ) : error ? (
          <>
            <AlertCircle className="size-4 shrink-0 text-[var(--color-warning)]" />
            <span className="text-body text-muted-foreground">Could not load checks</span>
          </>
        ) : !summary || total === 0 ? (
          <>
            <Circle className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-body text-muted-foreground">No checks</span>
          </>
        ) : (
          <>
            <SummaryIcon summary={summary} />
            <div className="flex flex-1 items-center gap-2">
              <span className="text-body text-foreground">
                {summary.failing > 0 ? (
                  <>
                    <span className="font-medium text-[var(--color-danger)]">
                      {summary.failing} failing
                    </span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span>{summary.passing} passed</span>
                  </>
                ) : summary.pending > 0 ? (
                  <>
                    <span className="font-medium text-[var(--color-warning)]">
                      {summary.pending} pending
                    </span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span>{summary.passing} passed</span>
                  </>
                ) : (
                  <span className="font-medium text-[var(--color-success)]">All checks passed</span>
                )}
              </span>
              {breakdown.required.total > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-micro text-muted-foreground">
                  {breakdown.required.total} required
                </span>
              )}
            </div>
            {summary.total > 0 && <ProgressBar summary={summary} />}
          </>
        )}
      </button>

      {expanded && data && (
        <div className="border-t border-border/40">
          {breakdown.missingRequired.map((name) => (
            <MissingRequiredCheckRow key={name} name={name} />
          ))}
          {data.checkRuns.map((run) => (
            <CheckRunRow
              key={run.id}
              run={run}
              owner={owner}
              repo={repo}
              required={breakdown.requiredNames.has(run.name)}
            />
          ))}
          {data.combined.statuses.map((status) => (
            <StatusRow
              key={status.id}
              status={status}
              required={breakdown.requiredNames.has(status.context)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function RequirementsSection({
  requirements,
  mergeStatusLoading,
  mergeStatusError,
  isRefreshing,
  onRefresh,
}: {
  requirements: Requirement[];
  mergeStatusLoading: boolean;
  mergeStatusError: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="border-t border-border/40 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-caption font-medium uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Merge requirements
          {mergeStatusLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="Refresh checks, rules, and mergeability"
        >
          <RefreshCcw className={cn("size-3", isRefreshing && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {mergeStatusError && (
          <RequirementRow
            requirement={{
              id: "merge-status-error",
              status: "warn",
              label: "Branch protection details unavailable",
              detail:
                "Checks and mergeability still use the REST response, but protected-branch rules could not be loaded.",
              blocksMerge: false,
            }}
          />
        )}
        {requirements.map((requirement) => (
          <RequirementRow key={requirement.id} requirement={requirement} />
        ))}
      </div>
    </div>
  );
}

function AutoMergeBanner({
  request,
  canDisable,
  disabled,
  onDisable,
}: {
  request: NonNullable<PrMergeStatusData["autoMergeRequest"]>;
  canDisable: boolean;
  disabled: boolean;
  onDisable: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border/40 px-4 py-3">
      <Clock className="size-4 shrink-0 text-[var(--color-warning)]" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-foreground">Auto-merge enabled</p>
        <p className="text-caption text-muted-foreground">
          {request.mergeMethod} merge will run when requirements pass
          {request.enabledBy ? `, enabled by ${request.enabledBy.login}` : ""}.
        </p>
      </div>
      {canDisable && (
        <Button size="xs" variant="ghost" disabled={disabled} onClick={onDisable}>
          Disable
        </Button>
      )}
    </div>
  );
}

function ReadinessIcon({
  hasConflicts,
  checking,
  draft,
  ready,
}: {
  hasConflicts: boolean;
  checking: boolean;
  draft: boolean;
  ready: boolean;
}) {
  if (hasConflicts) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]">
        <XCircle className="size-4 text-primary-foreground" />
      </div>
    );
  }
  if (checking) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]">
        <Loader2 className="size-4 animate-spin text-primary-foreground" />
      </div>
    );
  }
  if (draft) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted-foreground">
        <Circle className="size-4 text-primary-foreground" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        ready ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]",
      )}
    >
      {ready ? (
        <CheckCircle2 className="size-4 text-primary-foreground" />
      ) : (
        <ShieldAlert className="size-4 text-primary-foreground" />
      )}
    </div>
  );
}

type RequirementStatus = "pass" | "fail" | "pending" | "warn" | "neutral";

type Requirement = {
  id: string;
  status: RequirementStatus;
  label: string;
  detail: string;
  blocksMerge: boolean;
  action?: React.ReactNode;
};

function RequirementRow({ requirement }: { requirement: Requirement }) {
  const config = requirementConfig(requirement.status);
  const Icon = config.Icon;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", config.tone)} />
      <div className="min-w-0 flex-1">
        <p className="text-ui font-medium text-foreground">{requirement.label}</p>
        <p className="text-caption text-muted-foreground">{requirement.detail}</p>
      </div>
      {requirement.action}
    </div>
  );
}

function requirementConfig(status: RequirementStatus): { Icon: LucideIcon; tone: string } {
  switch (status) {
    case "pass":
      return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "fail":
      return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    case "pending":
      return { Icon: Clock, tone: "text-[var(--color-warning)]" };
    case "warn":
      return { Icon: AlertCircle, tone: "text-[var(--color-warning)]" };
    default:
      return { Icon: Circle, tone: "text-[var(--color-fg-faint)]" };
  }
}

function buildRequirements({
  pr,
  state,
  mergeStatus,
  checksPending,
  checksError,
  checkBreakdown,
  hasConflicts,
  isBehind,
  bypassStatus,
  onUpdateBranch,
  updateBranchPending,
}: {
  pr: PullRequest;
  state: "open" | "closed" | "merged" | "draft";
  mergeStatus: PrMergeStatusData | undefined;
  checksPending: boolean;
  checksError: boolean;
  checkBreakdown: CheckBreakdown;
  hasConflicts: boolean;
  isBehind: boolean;
  bypassStatus: BypassStatus;
  onUpdateBranch: () => void;
  updateBranchPending: boolean;
}): Requirement[] {
  const protection = mergeStatus?.protection;
  const out: Requirement[] = [];

  out.push(reviewRequirement(mergeStatus));
  out.push(checksRequirement(checkBreakdown, checksPending, checksError, mergeStatus));

  const unresolved = mergeStatus?.reviewThreads.unresolvedCount ?? 0;
  const requiresResolution = protection?.requiresConversationResolution ?? false;
  out.push({
    id: "conversations",
    status: unresolved === 0 ? "pass" : requiresResolution ? "fail" : "warn",
    label:
      unresolved === 0
        ? "Conversations resolved"
        : `${unresolved} unresolved ${unresolved === 1 ? "conversation" : "conversations"}`,
    detail:
      unresolved === 0
        ? "No open review threads are blocking this pull request."
        : requiresResolution
          ? "Branch protection requires every review conversation to be resolved."
          : "Unresolved threads do not appear to be required, but GitHub will still show them before merge.",
    blocksMerge: unresolved > 0 && requiresResolution,
  });

  out.push({
    id: "branch",
    status: hasConflicts ? "fail" : isBehind ? "pending" : "pass",
    label: hasConflicts
      ? "Conflicts must be resolved"
      : isBehind
        ? "Branch is behind"
        : "Branch can be merged",
    detail: branchRequirementDetail({ pr, mergeStatus, hasConflicts, isBehind }),
    blocksMerge: hasConflicts || (isBehind && (protection?.requiresStrictStatusChecks ?? false)),
    action:
      isBehind && mergeStatus?.viewerCanUpdateBranch ? (
        <Button size="xs" variant="outline" disabled={updateBranchPending} onClick={onUpdateBranch}>
          <RefreshCcw data-icon="inline-start" />
          Update branch
        </Button>
      ) : undefined,
  });

  if (state === "draft") {
    out.push({
      id: "draft",
      status: "pending",
      label: "Draft pull request",
      detail: "Mark this pull request as ready for review before merging.",
      blocksMerge: true,
    });
  }

  const alreadyBlocked = out.some((item) => item.blocksMerge);
  if (mergeStatus?.mergeStateStatus === "BLOCKED" && !alreadyBlocked) {
    out.push({
      id: "blocked",
      status: "warn",
      label: "Blocked by repository rules",
      detail:
        bypassStatus === "allowed"
          ? "GitHub reports this PR is blocked by branch protection or repository rules. Your account has permission to bypass and merge."
          : bypassStatus === "possible"
            ? "GitHub reports this PR is blocked by branch protection or repository rules. If your account has bypass access, you can bypass and merge."
            : "GitHub reports this PR is blocked by branch protection, repository rules, or merge queue policy.",
      blocksMerge: true,
    });
  }

  if (checkBreakdown.required.total === 0 && protection?.requiresStatusChecks) {
    out.push({
      id: "required-checks-unknown",
      status: "warn",
      label: "Required checks not named",
      detail:
        "Branch protection requires status checks, but GitHub did not return named required contexts.",
      blocksMerge: false,
    });
  }

  return out;
}

function reviewRequirement(mergeStatus: PrMergeStatusData | undefined): Requirement {
  const protection = mergeStatus?.protection;
  const count = protection?.requiredApprovingReviewCount ?? 0;
  const codeOwners = protection?.requiresCodeOwnerReviews ?? false;
  const staleDismissal = protection?.dismissesStaleReviews ?? false;
  const details = [
    count > 0 ? `${count} approving ${count === 1 ? "review" : "reviews"}` : null,
    codeOwners ? "code owner review" : null,
    staleDismissal ? "stale reviews dismissed" : null,
  ].filter(Boolean);

  if (!mergeStatus) {
    return {
      id: "reviews",
      status: "neutral",
      label: "Review status unknown",
      detail: "Branch protection review rules are still loading.",
      blocksMerge: false,
    };
  }

  if (mergeStatus.reviewDecision === "APPROVED") {
    return {
      id: "reviews",
      status: "pass",
      label: "Required reviews approved",
      detail: details.length ? details.join(" · ") : "Latest reviewer decisions allow merging.",
      blocksMerge: false,
    };
  }

  if (mergeStatus.reviewDecision === "CHANGES_REQUESTED") {
    return {
      id: "reviews",
      status: "fail",
      label: "Changes requested",
      detail: "At least one latest reviewer decision is requesting changes.",
      blocksMerge: true,
    };
  }

  if (mergeStatus.reviewDecision === "REVIEW_REQUIRED" || protection?.requiresApprovingReviews) {
    return {
      id: "reviews",
      status: "pending",
      label: "Review required",
      detail: details.length
        ? details.join(" · ")
        : "A required approving review is still missing.",
      blocksMerge: true,
    };
  }

  return {
    id: "reviews",
    status: "neutral",
    label: "No required reviews",
    detail: "This branch does not report an approving-review requirement.",
    blocksMerge: false,
  };
}

function checksRequirement(
  breakdown: CheckBreakdown,
  checksPending: boolean,
  checksError: boolean,
  mergeStatus: PrMergeStatusData | undefined,
): Requirement {
  const required = breakdown.required;
  const requiresChecks = mergeStatus?.protection.requiresStatusChecks ?? false;
  if (checksError) {
    return {
      id: "checks",
      status: "warn",
      label: "Could not load status checks",
      detail: "GitHub check runs failed to load. Click Refresh to retry.",
      blocksMerge: requiresChecks,
    };
  }

  if (checksPending && required.total === 0) {
    const blocksWhileLoading =
      !mergeStatus || requiresChecks || mergeStatus.mergeStateStatus === "BLOCKED";
    return {
      id: "checks",
      status: "pending",
      label: requiresChecks ? "Loading required checks" : "Loading checks",
      detail: "GitHub status checks are still loading.",
      blocksMerge: blocksWhileLoading,
    };
  }

  if (required.total === 0) {
    return {
      id: "checks",
      status: breakdown.all.failing > 0 ? "warn" : "neutral",
      label: "No required checks",
      detail:
        breakdown.all.total > 0
          ? `${breakdown.all.passing} passing · ${breakdown.all.pending} pending · ${breakdown.all.failing} failing optional checks.`
          : "This branch does not report named required status checks.",
      blocksMerge: false,
    };
  }

  const blocked = required.failing > 0 || required.pending > 0 || required.missing > 0;
  return {
    id: "checks",
    status: required.failing > 0 ? "fail" : blocked ? "pending" : "pass",
    label: blocked ? "Required checks incomplete" : "Required checks passed",
    detail: `${required.passing} passing · ${required.pending} pending · ${required.failing} failing · ${required.missing} missing`,
    blocksMerge: blocked,
  };
}

function branchRequirementDetail({
  pr,
  mergeStatus,
  hasConflicts,
  isBehind,
}: {
  pr: PullRequest;
  mergeStatus: PrMergeStatusData | undefined;
  hasConflicts: boolean;
  isBehind: boolean;
}) {
  if (hasConflicts) return "This branch has conflicts with the base branch.";
  if (isBehind) {
    if (mergeStatus?.protection.requiresStrictStatusChecks) {
      return "Branch protection requires this branch to be up to date before merging.";
    }
    const reasons = mergeStatus?.viewerCannotUpdateReasons ?? [];
    return reasons.length > 0
      ? `GitHub will not let this viewer update the branch: ${reasons.join(", ")}.`
      : "This branch is behind the base branch and can be updated.";
  }
  if (mergeStatus?.mergeStateStatus === "HAS_HOOKS") {
    return "Repository rules or merge hooks will run before merge completes.";
  }
  return `This branch can be merged into ${pr.base.ref}.`;
}

function readinessTitle({
  hasConflicts,
  mergeability,
  mergeabilityTimedOut,
  state,
  canMergeNow,
  canBypassRequirements,
  bypassStatus,
  bypassReason,
  isBehind,
  mergeStatus,
}: {
  hasConflicts: boolean;
  mergeability: MergeabilityState;
  mergeabilityTimedOut: boolean;
  state: string;
  canMergeNow: boolean;
  canBypassRequirements: boolean;
  bypassStatus: BypassStatus;
  bypassReason: BypassReason;
  isBehind: boolean;
  mergeStatus: PrMergeStatusData | undefined;
}) {
  if (hasConflicts) return "Conflicts must be resolved";
  if (state === "draft") return "Draft pull request";
  if (mergeability === "checking") {
    return mergeabilityTimedOut ? "Mergeability status unavailable" : "Checking mergeability…";
  }
  if (canMergeNow) return "Ready to merge";
  if (canBypassRequirements && bypassStatus === "allowed") {
    return bypassReason === "admin" ? "Administrator bypass available" : "Rule bypass available";
  }
  if (mergeStatus?.autoMergeRequest) return "Waiting for auto-merge";
  if (isBehind) return "Branch update needed";
  if (mergeStatus?.mergeStateStatus === "BLOCKED") return "Blocked by repository rules";
  return "Waiting on merge requirements";
}

function readinessDetail({
  hasConflicts,
  mergeability,
  mergeabilityTimedOut,
  state,
  canMergeNow,
  canBypassRequirements,
  bypassStatus,
  bypassReason,
  viewerCanMerge,
  isBehind,
  mergeStatus,
  allowedMethods,
}: {
  hasConflicts: boolean;
  mergeability: MergeabilityState;
  mergeabilityTimedOut: boolean;
  state: string;
  canMergeNow: boolean;
  canBypassRequirements: boolean;
  bypassStatus: BypassStatus;
  bypassReason: BypassReason;
  viewerCanMerge: boolean;
  isBehind: boolean;
  mergeStatus: PrMergeStatusData | undefined;
  allowedMethods: MergeMethod[];
}) {
  if (allowedMethods.length === 0) return "This repository has no merge methods enabled.";
  if (hasConflicts) return "Resolve conflicts locally or on GitHub before merging.";
  if (state === "draft") return "Mark as ready for review to enable merging.";
  if (!viewerCanMerge) return "You need write access to this repository to merge pull requests.";
  if (mergeability === "checking") {
    return mergeabilityTimedOut
      ? "GitHub is still calculating mergeability. Retry, or attempt to merge directly."
      : "GitHub is checking whether this branch can be merged cleanly.";
  }
  if (canMergeNow) return `Available methods: ${allowedMethods.map(formatMethod).join(", ")}.`;
  if (canBypassRequirements) {
    if (bypassStatus === "allowed") {
      return bypassReason === "ruleset"
        ? "Your repository ruleset permissions allow bypassing these requirements to merge."
        : "Your GitHub permissions allow merging without waiting for these requirements.";
    }
    return "Requirements are not all met, but you can attempt a bypass merge if your account has access.";
  }
  if (mergeStatus?.autoMergeRequest)
    return "GitHub will merge this PR once the remaining requirements pass.";
  if (isBehind) return "Update the branch, then wait for required checks to rerun.";
  return "Complete required reviews, checks, and conversation resolution first.";
}

function formatMutationError(error: unknown): string {
  if (error && typeof error === "object") {
    if ("response" in error) {
      const response = error.response as { data?: { message?: unknown } } | undefined;
      if (typeof response?.data?.message === "string") return response.data.message;
    }
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "GitHub rejected this request. Check your bypass permissions and try again.";
}

function allowedMergeMethods(repo: ReturnType<typeof useRepo>["data"]): MergeMethod[] {
  const methods: MergeMethod[] = [];
  if (repo?.allow_merge_commit !== false) methods.push("merge");
  if (repo?.allow_squash_merge !== false) methods.push("squash");
  if (repo?.allow_rebase_merge !== false) methods.push("rebase");
  return methods;
}

function formatMethod(method: MergeMethod): string {
  switch (method) {
    case "squash":
      return "squash";
    case "rebase":
      return "rebase";
    default:
      return "merge commit";
  }
}

function ProgressBar({ summary }: { summary: CheckSummary }) {
  return (
    <div className="flex h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-sunken)]">
      {summary.passing > 0 && (
        <div
          className="h-full bg-[var(--color-success)]"
          style={{ width: `${(summary.passing / summary.total) * 100}%` }}
        />
      )}
      {summary.pending > 0 && (
        <div
          className="h-full bg-[var(--color-warning)]"
          style={{ width: `${(summary.pending / summary.total) * 100}%` }}
        />
      )}
      {summary.failing > 0 && (
        <div
          className="h-full bg-[var(--color-danger)]"
          style={{ width: `${(summary.failing / summary.total) * 100}%` }}
        />
      )}
    </div>
  );
}

function SummaryIcon({ summary }: { summary: CheckSummary }) {
  if (summary.failing > 0)
    return <XCircle className="size-4 shrink-0 text-[var(--color-danger)]" />;
  if (summary.pending > 0)
    return <CircleDot className="size-4 shrink-0 text-[var(--color-warning)]" />;
  return <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />;
}

function CheckRunRow({
  run,
  owner,
  repo,
  required,
}: {
  run: CheckRun;
  owner: string;
  repo: string;
  required: boolean;
}) {
  const { Icon, tone } = iconForCheckRun(run);
  const url = run.html_url ?? run.details_url ?? undefined;
  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{run.name}</span>
      {required && <RequiredBadge />}
      {run.app?.name && (
        <span className="shrink-0 rounded bg-muted px-1.5 text-micro text-muted-foreground">
          {run.app.name}
        </span>
      )}
      {run.completed_at && (
        <span className="shrink-0 text-caption text-[var(--color-fg-faint)]">
          {formatRelativeTime(run.completed_at)}
        </span>
      )}
      {url ? (
        <CheckRunPeek owner={owner} repo={repo} checkUrl={url} checkName={run.name}>
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-caption text-muted-foreground transition-colors duration-75 hover:bg-muted hover:text-foreground"
          >
            Details
          </button>
        </CheckRunPeek>
      ) : null}
    </div>
  );
}

function StatusRow({
  status,
  required,
}: {
  status: {
    id: number;
    state: "pending" | "success" | "failure" | "error";
    context: string;
    description: string | null;
    target_url: string | null;
    updated_at: string;
  };
  required: boolean;
}) {
  const { Icon, tone } = iconForState(status.state);
  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
      <Icon className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 flex-1 truncate text-caption text-foreground">{status.context}</span>
      {required && <RequiredBadge />}
      {status.description && (
        <span className="max-w-40 shrink-0 truncate text-caption text-muted-foreground">
          {status.description}
        </span>
      )}
      <span className="shrink-0 text-caption text-[var(--color-fg-faint)]">
        {formatRelativeTime(status.updated_at)}
      </span>
      {status.target_url && (
        <a
          href={status.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded px-1.5 py-0.5 text-caption text-muted-foreground transition-colors duration-75 hover:bg-muted hover:text-foreground"
        >
          Details
        </a>
      )}
    </div>
  );
}

function MissingRequiredCheckRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-caption text-muted-foreground">
      <Clock className="size-4 shrink-0 text-[var(--color-warning)]" />
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      <RequiredBadge />
      <span className="shrink-0 text-[var(--color-warning)]">missing</span>
    </div>
  );
}

function RequiredBadge() {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 text-micro text-muted-foreground">
      required
    </span>
  );
}

function iconForCheckRun(run: CheckRun): { Icon: LucideIcon; tone: string } {
  if (run.status !== "completed") {
    if (run.status === "in_progress")
      return { Icon: Loader2, tone: "animate-spin text-[var(--color-warning)]" };
    return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
  switch (run.conclusion) {
    case "success":
      return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "failure":
    case "timed_out":
      return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    case "action_required":
      return { Icon: CircleDot, tone: "text-[var(--color-warning)]" };
    case "cancelled":
    case "skipped":
      return { Icon: MinusCircle, tone: "text-[var(--color-fg-faint)]" };
    default:
      return { Icon: Circle, tone: "text-[var(--color-fg-faint)]" };
  }
}

function iconForState(state: "pending" | "success" | "failure" | "error"): {
  Icon: LucideIcon;
  tone: string;
} {
  switch (state) {
    case "success":
      return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "failure":
    case "error":
      return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    default:
      return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
}
