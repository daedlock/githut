import type {
  CheckRun,
  MergeMethod,
  PrChecksData,
  PrMergeStatusData,
} from "@/app/features/pulls/hooks";
import type { PullRequest } from "@/app/features/pulls/schemas";

export type RepoPermissions = {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
};

export type ViewerPermission = "ADMIN" | "MAINTAIN" | "WRITE" | "TRIAGE" | "READ" | null;

export type RulesetBypassStatus = "none" | "allowed" | "possible" | "denied" | "unknown";

export type MergeabilityState = "mergeable" | "conflicting" | "checking";

export type BypassStatus = "allowed" | "possible" | "denied";

export type BypassReason = "admin" | "ruleset" | "access" | null;

export type RawBranchRule = {
  type?: string;
  ruleset_id?: number;
  parameters?: Record<string, unknown>;
};

export type RawRepoRuleset = {
  id?: number;
  enforcement?: string;
  current_user_can_bypass?: string;
};

export type BranchRulesetSummary = {
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number;
  requiresCodeOwnerReviews: boolean;
  dismissesStaleReviews: boolean;
  requiresStatusChecks: boolean;
  requiresStrictStatusChecks: boolean;
  requiresConversationResolution: boolean;
  requiredStatusCheckContexts: string[];
  hasMergeQueueRule: boolean;
  mergeRelevantRulesetCount: number;
  rulesetBypass: RulesetBypassStatus;
};

export type CheckSummary = {
  passing: number;
  failing: number;
  pending: number;
  total: number;
};

export type RequiredSummary = CheckSummary & { missing: number };

export type CheckBreakdown = {
  all: CheckSummary;
  required: RequiredSummary;
  optional: CheckSummary;
  requiredNames: Set<string>;
  missingRequired: string[];
};

const NON_MERGE_RULE_TYPES = new Set([
  "creation",
  "deletion",
  "non_fast_forward",
  "copilot_code_review",
]);

const MERGEABLE_GRAPHQL_STATES = new Set(["CLEAN", "UNSTABLE", "HAS_HOOKS", "BLOCKED", "BEHIND"]);

const MERGEABLE_REST_STATES = new Set(["clean", "unstable", "has_hooks", "blocked", "behind"]);

const BYPASS_ALLOWED_VALUES = new Set(["always", "pull_requests_only", "exempt"]);

export function encodeBranchPath(branch: string): string {
  return branch.split("/").map(encodeURIComponent).join("/");
}

export function summarizeBranchRulesets(
  branchRules: RawBranchRule[],
  rulesets: RawRepoRuleset[] | null,
): BranchRulesetSummary {
  let requiredApprovingReviewCount = 0;
  let requiresCodeOwnerReviews = false;
  let dismissesStaleReviews = false;
  let requiresStrictStatusChecks = false;
  let requiresConversationResolution = false;
  let hasMergeQueueRule = false;
  const requiredContexts = new Set<string>();
  const rulesetRuleTypes = new Map<number, Set<string>>();

  for (const rule of branchRules) {
    const type = typeof rule.type === "string" ? rule.type : "";
    const params = rule.parameters ?? {};

    if (typeof rule.ruleset_id === "number" && type && !NON_MERGE_RULE_TYPES.has(type)) {
      const types = rulesetRuleTypes.get(rule.ruleset_id) ?? new Set<string>();
      types.add(type);
      rulesetRuleTypes.set(rule.ruleset_id, types);
    }

    if (type === "pull_request") {
      const count = params.required_approving_review_count;
      if (typeof count === "number" && count > requiredApprovingReviewCount) {
        requiredApprovingReviewCount = count;
      }
      if (params.require_code_owner_review === true) requiresCodeOwnerReviews = true;
      if (params.dismiss_stale_reviews_on_push === true) dismissesStaleReviews = true;
      if (params.required_review_thread_resolution === true) {
        requiresConversationResolution = true;
      }
    } else if (type === "required_status_checks") {
      if (params.strict_required_status_checks_policy === true) {
        requiresStrictStatusChecks = true;
      }
      const checks = params.required_status_checks;
      if (Array.isArray(checks)) {
        for (const item of checks) {
          if (
            item &&
            typeof item === "object" &&
            "context" in item &&
            typeof (item as { context?: unknown }).context === "string" &&
            (item as { context: string }).context.length > 0
          ) {
            requiredContexts.add((item as { context: string }).context);
          }
        }
      }
    } else if (type === "merge_queue") {
      hasMergeQueueRule = true;
    }
  }

  const rulesetBypass = evaluateRulesetBypass(rulesetRuleTypes, rulesets);

  return {
    requiresApprovingReviews: requiredApprovingReviewCount > 0 || requiresCodeOwnerReviews,
    requiredApprovingReviewCount,
    requiresCodeOwnerReviews,
    dismissesStaleReviews,
    requiresStatusChecks: requiredContexts.size > 0,
    requiresStrictStatusChecks,
    requiresConversationResolution,
    requiredStatusCheckContexts: [...requiredContexts],
    hasMergeQueueRule,
    mergeRelevantRulesetCount: rulesetRuleTypes.size,
    rulesetBypass,
  };
}

function evaluateRulesetBypass(
  rulesetRuleTypes: Map<number, Set<string>>,
  rulesets: RawRepoRuleset[] | null,
): RulesetBypassStatus {
  if (rulesetRuleTypes.size === 0) return "none";
  if (rulesets === null) return "unknown";

  const byId = new Map<number, RawRepoRuleset>();
  for (const rs of rulesets) {
    if (typeof rs.id === "number") byId.set(rs.id, rs);
  }

  let allowed = 0;
  let denied = 0;
  let deniedOnlyAdvisory = 0;
  let unknown = 0;

  for (const [id, types] of rulesetRuleTypes) {
    const rs = byId.get(id);
    const mode = rs?.current_user_can_bypass;
    if (typeof mode === "string" && BYPASS_ALLOWED_VALUES.has(mode)) {
      allowed++;
    } else if (mode === "never") {
      denied++;
      if (types.size === 1 && types.has("required_linear_history")) {
        deniedOnlyAdvisory++;
      }
    } else {
      unknown++;
    }
  }

  const total = rulesetRuleTypes.size;
  if (allowed === total) return "allowed";
  if (denied === 0) return "unknown";
  if (allowed > 0) return "possible";
  if (deniedOnlyAdvisory === denied && unknown > 0) return "possible";
  return "denied";
}

export function resolveMergeability(
  pr: Pick<PullRequest, "mergeable" | "mergeable_state">,
  mergeStatus: Pick<PrMergeStatusData, "mergeable" | "mergeStateStatus"> | undefined,
): MergeabilityState {
  if (
    pr.mergeable === false ||
    pr.mergeable_state === "dirty" ||
    mergeStatus?.mergeable === "CONFLICTING" ||
    mergeStatus?.mergeStateStatus === "DIRTY"
  ) {
    return "conflicting";
  }

  if (
    pr.mergeable === true ||
    mergeStatus?.mergeable === "MERGEABLE" ||
    (mergeStatus?.mergeStateStatus != null &&
      MERGEABLE_GRAPHQL_STATES.has(mergeStatus.mergeStateStatus)) ||
    (pr.mergeable_state != null && MERGEABLE_REST_STATES.has(pr.mergeable_state))
  ) {
    return "mergeable";
  }

  return "checking";
}

export function hasLiveChecks(data: PrChecksData | undefined): boolean {
  if (!data) return false;
  const anyRunLive = data.checkRuns.some((r) => r.status !== "completed");
  const anyStatusLive =
    data.combined.statuses.length > 0 &&
    (data.combined.state === "pending" ||
      data.combined.statuses.some((s) => s.state === "pending"));
  return anyRunLive || anyStatusLive;
}

export function checkRunState(
  run: Pick<CheckRun, "status" | "conclusion">,
): "passing" | "failing" | "pending" {
  if (run.status !== "completed") return "pending";
  if (
    run.conclusion === "success" ||
    run.conclusion === "skipped" ||
    run.conclusion === "neutral"
  ) {
    return "passing";
  }
  if (
    run.conclusion === "failure" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "action_required" ||
    run.conclusion === "startup_failure"
  ) {
    return "failing";
  }
  return "pending";
}

export function statusState(
  state: "pending" | "success" | "failure" | "error",
): "passing" | "failing" | "pending" {
  if (state === "success") return "passing";
  if (state === "failure" || state === "error") return "failing";
  return "pending";
}

function checkRunTimestamp(run: CheckRun): number {
  const raw = run.completed_at ?? run.started_at;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dedupeLatestCheckRuns(checkRuns: CheckRun[]): CheckRun[] {
  const latestByName = new Map<string, CheckRun>();
  for (const run of checkRuns) {
    const prev = latestByName.get(run.name);
    if (!prev) {
      latestByName.set(run.name, run);
      continue;
    }
    const prevTs = checkRunTimestamp(prev);
    const nextTs = checkRunTimestamp(run);
    if (nextTs > prevTs || (nextTs === prevTs && run.id > prev.id)) {
      latestByName.set(run.name, run);
    }
  }
  return [...latestByName.values()];
}

export function summarizeChecks(data: PrChecksData): CheckSummary {
  let passing = 0;
  let failing = 0;
  let pending = 0;
  for (const run of dedupeLatestCheckRuns(data.checkRuns)) {
    const state = checkRunState(run);
    if (state === "passing") passing++;
    else if (state === "failing") failing++;
    else pending++;
  }
  for (const status of data.combined.statuses) {
    const state = statusState(status.state);
    if (state === "passing") passing++;
    else if (state === "failing") failing++;
    else pending++;
  }
  return { passing, failing, pending, total: passing + failing + pending };
}

function incrementRequired(summary: RequiredSummary, state: "passing" | "failing" | "pending") {
  if (state === "passing") summary.passing++;
  else if (state === "failing") summary.failing++;
  else summary.pending++;
}

export function buildCheckBreakdown(
  data: PrChecksData | undefined,
  mergeStatus: PrMergeStatusData | undefined,
): CheckBreakdown {
  const requiredNames = new Set(mergeStatus?.protection.requiredStatusCheckContexts ?? []);
  const all = data ? summarizeChecks(data) : { passing: 0, failing: 0, pending: 0, total: 0 };
  const required: RequiredSummary = {
    passing: 0,
    failing: 0,
    pending: 0,
    missing: 0,
    total: requiredNames.size,
  };
  const seenRequired = new Set<string>();

  if (data) {
    for (const run of dedupeLatestCheckRuns(data.checkRuns)) {
      if (!requiredNames.has(run.name)) continue;
      seenRequired.add(run.name);
      incrementRequired(required, checkRunState(run));
    }
    for (const status of data.combined.statuses) {
      if (!requiredNames.has(status.context)) continue;
      if (seenRequired.has(status.context)) continue;
      seenRequired.add(status.context);
      incrementRequired(required, statusState(status.state));
    }
  }

  const missingRequired = [...requiredNames].filter((name) => !seenRequired.has(name));
  required.missing = missingRequired.length;
  const optional = {
    passing: Math.max(0, all.passing - required.passing),
    failing: Math.max(0, all.failing - required.failing),
    pending: Math.max(0, all.pending - required.pending),
    total: Math.max(0, all.total - (required.total - required.missing)),
  };
  return { all, required, optional, requiredNames, missingRequired };
}

export type MergeReadiness = {
  isAdmin: boolean;
  canWrite: boolean;
  viewerCanMerge: boolean;
  bypassStatus: BypassStatus;
  bypassReason: BypassReason;
  canMergeNow: boolean;
  canBypassRequirements: boolean;
  canOpenMergeDialog: boolean;
};

export function evaluateMergeReadiness({
  state,
  mergeability,
  mergeabilityTimedOut = false,
  blockedByRequirements,
  allowedMethods,
  repoPermissions,
  mergeStatus,
}: {
  state: "open" | "closed" | "merged" | "draft";
  mergeability: MergeabilityState;
  mergeabilityTimedOut?: boolean;
  blockedByRequirements: boolean;
  allowedMethods: MergeMethod[];
  repoPermissions: RepoPermissions | undefined;
  mergeStatus: PrMergeStatusData | undefined;
}): MergeReadiness {
  const viewerPermission = mergeStatus?.viewerPermission ?? null;
  const isAdmin = viewerPermission === "ADMIN" || repoPermissions?.admin === true;
  const canWrite =
    isAdmin ||
    viewerPermission === "MAINTAIN" ||
    viewerPermission === "WRITE" ||
    repoPermissions?.maintain === true ||
    repoPermissions?.push === true;
  const hasPermissionInfo = viewerPermission !== null || repoPermissions !== undefined;
  const viewerCanMerge = hasPermissionInfo ? canWrite : true;

  const { bypassStatus, bypassReason } = evaluateBypassAccess({
    isAdmin,
    canWrite,
    mergeStatus,
  });

  const canAttemptMerge =
    state !== "draft" &&
    mergeability !== "conflicting" &&
    (mergeability === "mergeable" || mergeabilityTimedOut) &&
    allowedMethods.length > 0 &&
    viewerCanMerge;

  const canMergeNow = canAttemptMerge && !blockedByRequirements && mergeability === "mergeable";
  const canBypassRequirements =
    canAttemptMerge && (blockedByRequirements || mergeabilityTimedOut) && bypassStatus !== "denied";

  return {
    isAdmin,
    canWrite,
    viewerCanMerge,
    bypassStatus,
    bypassReason,
    canMergeNow,
    canBypassRequirements,
    canOpenMergeDialog: canMergeNow || canBypassRequirements,
  };
}

function evaluateBypassAccess({
  isAdmin,
  canWrite,
  mergeStatus,
}: {
  isAdmin: boolean;
  canWrite: boolean;
  mergeStatus: PrMergeStatusData | undefined;
}): { bypassStatus: BypassStatus; bypassReason: BypassReason } {
  if (!canWrite) {
    return { bypassStatus: "denied", bypassReason: null };
  }

  if (!mergeStatus) {
    // Merge status is still loading or failed to load. Don't lock out admins or
    // writers — GitHub enforces actual bypass authorization on merge.
    return {
      bypassStatus: "possible",
      bypassReason: isAdmin ? "admin" : "access",
    };
  }

  const { viewerCanMergeAsAdmin, rulesetBypass, hasClassicProtection, classicIsAdminEnforced } =
    mergeStatus;

  // If GitHub explicitly reports that the current user cannot bypass active
  // merge rulesets and GraphQL doesn't report admin merge override, deny bypass.
  if (rulesetBypass === "denied" && !viewerCanMergeAsAdmin) {
    return { bypassStatus: "denied", bypassReason: null };
  }

  const rulesetsAllow = rulesetBypass === "none" || rulesetBypass === "allowed";
  const classicAllows =
    !hasClassicProtection || viewerCanMergeAsAdmin || (isAdmin && !classicIsAdminEnforced);

  if (rulesetsAllow && classicAllows) {
    if (viewerCanMergeAsAdmin || (isAdmin && !classicIsAdminEnforced)) {
      return { bypassStatus: "allowed", bypassReason: "admin" };
    }
    if (rulesetBypass === "allowed") {
      return { bypassStatus: "allowed", bypassReason: "ruleset" };
    }
  }

  // Non-admin users with write/maintain access may still be listed in classic
  // `bypass_pull_request_allowances` (which GitHub does not expose to
  // non-admins), or ruleset details may be unavailable. Allow attempting bypass
  // and let GitHub's merge API return the authoritative result.
  return {
    bypassStatus: "possible",
    bypassReason: isAdmin ? "admin" : "access",
  };
}
