import { describe, expect, it } from "bun:test";
import type { PrChecksData, PrMergeStatusData } from "@/app/features/pulls/hooks";
import {
  buildCheckBreakdown,
  encodeBranchPath,
  evaluateMergeReadiness,
  hasLiveChecks,
  resolveMergeability,
  summarizeBranchRulesets,
} from "@/app/features/pulls/lib/mergeReadiness";

function makeMergeStatus(overrides: Partial<PrMergeStatusData> = {}): PrMergeStatusData {
  return {
    reviewDecision: null,
    mergeable: "MERGEABLE",
    mergeStateStatus: "BLOCKED",
    viewerPermission: "ADMIN",
    autoMergeRequest: null,
    viewerCanEnableAutoMerge: false,
    viewerCanDisableAutoMerge: false,
    viewerCanMergeAsAdmin: false,
    viewerCanDeleteHeadRef: false,
    viewerCanUpdateBranch: false,
    viewerCannotUpdateReasons: [],
    headRefExists: true,
    headRefOid: "abc123",
    baseRefOid: "def456",
    baseRefName: "main",
    hasClassicProtection: false,
    classicIsAdminEnforced: false,
    hasMergeQueueRule: false,
    rulesetBypass: "none",
    protection: {
      requiresApprovingReviews: false,
      requiredApprovingReviewCount: 0,
      requiresCodeOwnerReviews: false,
      dismissesStaleReviews: false,
      requiresStatusChecks: false,
      requiresStrictStatusChecks: false,
      requiresConversationResolution: false,
      requiredStatusCheckContexts: [],
    },
    reviewThreads: { totalCount: 0, unresolvedCount: 0 },
    ...overrides,
  };
}

describe("resolveMergeability", () => {
  it("uses GraphQL MERGEABLE even while REST mergeable is null", () => {
    expect(
      resolveMergeability(
        { mergeable: null, mergeable_state: "unknown" },
        { mergeable: "MERGEABLE", mergeStateStatus: "BLOCKED" },
      ),
    ).toBe("mergeable");
  });

  it("returns conflicting when either REST or GraphQL reports conflicts", () => {
    expect(
      resolveMergeability(
        { mergeable: null, mergeable_state: "unknown" },
        { mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" },
      ),
    ).toBe("conflicting");
    expect(resolveMergeability({ mergeable: false, mergeable_state: "dirty" }, undefined)).toBe(
      "conflicting",
    );
  });

  it("returns checking only when both sources are still unknown", () => {
    expect(
      resolveMergeability(
        { mergeable: null, mergeable_state: "unknown" },
        { mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" },
      ),
    ).toBe("checking");
  });
});

describe("hasLiveChecks", () => {
  it("does not treat empty legacy combined status (state=pending) as live", () => {
    const data: PrChecksData = {
      checkRuns: [{ id: 1, name: "ci", status: "completed", conclusion: "success" }],
      combined: { state: "pending", total_count: 0, statuses: [] },
    };
    expect(hasLiveChecks(data)).toBe(false);
  });

  it("treats waiting/requested/in_progress check runs as live", () => {
    const data: PrChecksData = {
      checkRuns: [{ id: 1, name: "ci", status: "requested", conclusion: null }],
      combined: { state: "pending", total_count: 0, statuses: [] },
    };
    expect(hasLiveChecks(data)).toBe(true);
  });
});

describe("summarizeBranchRulesets", () => {
  it("extracts required checks/reviews and ignores non-merge rules for bypass evaluation", () => {
    const summary = summarizeBranchRulesets(
      [
        { type: "deletion", ruleset_id: 10 },
        { type: "non_fast_forward", ruleset_id: 10 },
        {
          type: "pull_request",
          ruleset_id: 20,
          parameters: {
            required_approving_review_count: 2,
            require_code_owner_review: true,
            required_review_thread_resolution: true,
          },
        },
        {
          type: "required_status_checks",
          ruleset_id: 20,
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [{ context: "build" }, { context: "test" }],
          },
        },
      ],
      [
        { id: 10, current_user_can_bypass: "never" },
        { id: 20, current_user_can_bypass: "pull_requests_only" },
      ],
    );

    expect(summary.rulesetBypass).toBe("allowed");
    expect(summary.requiredApprovingReviewCount).toBe(2);
    expect(summary.requiresCodeOwnerReviews).toBe(true);
    expect(summary.requiresConversationResolution).toBe(true);
    expect(summary.requiresStrictStatusChecks).toBe(true);
    expect(summary.requiredStatusCheckContexts).toEqual(["build", "test"]);
  });

  it("denies bypass when all merge-relevant rulesets report never", () => {
    const summary = summarizeBranchRulesets(
      [
        {
          type: "required_status_checks",
          ruleset_id: 20,
          parameters: { required_status_checks: [{ context: "ci" }] },
        },
      ],
      [{ id: 20, current_user_can_bypass: "never" }],
    );
    expect(summary.rulesetBypass).toBe("denied");
  });
});

describe("evaluateMergeReadiness", () => {
  it("allows admin to bypass rulesets even when GraphQL viewerCanMergeAsAdmin is false", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "mergeable",
      blockedByRequirements: true,
      allowedMethods: ["squash"],
      repoPermissions: { admin: true, push: true },
      mergeStatus: makeMergeStatus({
        viewerCanMergeAsAdmin: false,
        rulesetBypass: "allowed",
      }),
    });

    expect(readiness.canBypassRequirements).toBe(true);
    expect(readiness.bypassStatus).toBe("allowed");
    expect(readiness.bypassReason).toBe("admin");
  });

  it("allows non-admin on ruleset bypass list to bypass", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "mergeable",
      blockedByRequirements: true,
      allowedMethods: ["squash"],
      repoPermissions: { admin: false, push: true },
      mergeStatus: makeMergeStatus({
        viewerPermission: "WRITE",
        viewerCanMergeAsAdmin: false,
        rulesetBypass: "allowed",
      }),
    });

    expect(readiness.canBypassRequirements).toBe(true);
    expect(readiness.bypassStatus).toBe("allowed");
    expect(readiness.bypassReason).toBe("ruleset");
  });

  it("allows write user to attempt bypass on classic protection (bypass_pull_request_allowances)", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "mergeable",
      blockedByRequirements: true,
      allowedMethods: ["merge"],
      repoPermissions: { admin: false, push: true },
      mergeStatus: makeMergeStatus({
        viewerPermission: "WRITE",
        viewerCanMergeAsAdmin: false,
        hasClassicProtection: true,
        rulesetBypass: "none",
      }),
    });

    expect(readiness.canBypassRequirements).toBe(true);
    expect(readiness.bypassStatus).toBe("possible");
  });

  it("blocks bypass when active ruleset explicitly says current_user_can_bypass=never", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "mergeable",
      blockedByRequirements: true,
      allowedMethods: ["squash"],
      repoPermissions: { admin: true, push: true },
      mergeStatus: makeMergeStatus({
        viewerCanMergeAsAdmin: false,
        rulesetBypass: "denied",
      }),
    });

    expect(readiness.canBypassRequirements).toBe(false);
    expect(readiness.bypassStatus).toBe("denied");
  });

  it("does not allow read-only users to merge or bypass", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "mergeable",
      blockedByRequirements: false,
      allowedMethods: ["squash"],
      repoPermissions: { admin: false, push: false, pull: true },
      mergeStatus: makeMergeStatus({
        viewerPermission: "READ",
        mergeStateStatus: "CLEAN",
      }),
    });

    expect(readiness.canMergeNow).toBe(false);
    expect(readiness.canBypassRequirements).toBe(false);
  });

  it("allows attempting merge if mergeability polling timed out for a user with write access", () => {
    const readiness = evaluateMergeReadiness({
      state: "open",
      mergeability: "checking",
      mergeabilityTimedOut: true,
      blockedByRequirements: false,
      allowedMethods: ["squash"],
      repoPermissions: { admin: true, push: true },
      mergeStatus: makeMergeStatus({
        mergeable: "UNKNOWN",
        mergeStateStatus: "UNKNOWN",
      }),
    });

    expect(readiness.canOpenMergeDialog).toBe(true);
    expect(readiness.canBypassRequirements).toBe(true);
  });
});

describe("buildCheckBreakdown & encodeBranchPath", () => {
  it("uses the latest run when a required check was retried", () => {
    const data: PrChecksData = {
      checkRuns: [
        {
          id: 1,
          name: "test",
          status: "completed",
          conclusion: "failure",
          completed_at: "2026-06-01T10:00:00Z",
        },
        {
          id: 2,
          name: "test",
          status: "completed",
          conclusion: "success",
          completed_at: "2026-06-01T10:05:00Z",
        },
      ],
      combined: { state: "pending", total_count: 0, statuses: [] },
    };
    const breakdown = buildCheckBreakdown(
      data,
      makeMergeStatus({
        protection: {
          requiresApprovingReviews: false,
          requiredApprovingReviewCount: 0,
          requiresCodeOwnerReviews: false,
          dismissesStaleReviews: false,
          requiresStatusChecks: true,
          requiresStrictStatusChecks: false,
          requiresConversationResolution: false,
          requiredStatusCheckContexts: ["test"],
        },
      }),
    );

    expect(breakdown.required.passing).toBe(1);
    expect(breakdown.required.failing).toBe(0);
    expect(breakdown.required.missing).toBe(0);
  });

  it("encodes branch path segments while preserving slashes", () => {
    expect(encodeBranchPath("release/v1.0#rc")).toBe("release/v1.0%23rc");
  });
});
