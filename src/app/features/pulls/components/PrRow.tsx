import { Link } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  CircleX,
  Loader2,
  type LucideIcon,
  MessageSquare,
  Minus,
  X,
} from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import type { CheckContextStatus, PrCheckRollup, PrListItem } from "@/app/features/pulls/hooks";
import type { TreePosition } from "@/app/features/pulls/lib/buildPrTree";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { ReviewDecision } from "@/app/features/pulls/lib/reviewDecision";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrRow ─────────────────────────────────────────────────────────────────
//
// Mirrors `IssueRow` exactly — same padding (`px-4 py-3.5 sm:px-5`), same
// text tokens (`text-body` title, `text-caption text-(--color-fg-faint)`
// meta, `·` separators), same assignee-stack on the right. Only swaps are
// PR-specific: the leading state icon (git-pull-request family) and the
// meta verb ("opened/merged/closed by").
//
// Interaction model also matches IssueRow: the whole row is a Link so
// TanStack Router's intent-preload warms the detail route on hover.

export type PrRowProps = {
  owner: string;
  repo: string;
  pr: PrListItem;
  reviewDecision?: ReviewDecision;
  checkRollup?: PrCheckRollup;
  depth?: number;
  treePosition?: TreePosition;
  ancestorContinuations?: number[];
};

// Indent step per depth level (px). Connector line sits at the midpoint.
const DEPTH_INDENT = 24;

export function PrRow({
  owner,
  repo,
  pr,
  reviewDecision,
  checkRollup,
  depth = 0,
  treePosition = "root",
  ancestorContinuations = [],
}: PrRowProps) {
  const state = toUiState({
    state: pr.state,
    draft: pr.draft ?? false,
    merged: !!pr.pull_request?.merged_at,
  });
  const isClosedLike = state === "closed" || state === "merged";
  const timeAt = isClosedLike ? (pr.closed_at ?? pr.updated_at) : pr.created_at;
  const timeVerb = state === "merged" ? "merged" : state === "closed" ? "closed" : "opened";
  const isChild = depth > 0;

  return (
    <Link
      to="/$owner/$repo/pull/$number"
      params={{ owner, repo, number: pr.number }}
      className="group block rounded-lg outline-none transition-colors focus-visible:bg-muted hover:bg-muted"
    >
      <div
        className="relative flex w-full items-start gap-3 py-2.5 text-left"
        style={{ paddingLeft: 16 + depth * DEPTH_INDENT + (isChild ? 6 : 0), paddingRight: 16 }}
      >
        {isChild && (
          <TreeConnector
            depth={depth}
            treePosition={treePosition}
            ancestorContinuations={ancestorContinuations}
          />
        )}
        <div className={cn("mt-0.5 flex-shrink-0", isChild && "opacity-60")}>
          <PrStateIcon state={state} size={4} />
        </div>
        <div className={cn("min-w-0 flex-1", isChild && "opacity-70")}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-body font-[475] text-foreground">{pr.title}</span>
            <ChecksBadge rollup={checkRollup} />
            {pr.labels.map((l) => (
              <LabelPill
                key={l.id}
                label={{
                  id: l.id,
                  name: l.name,
                  color: l.color,
                  description: l.description ?? null,
                }}
                size="xs"
              />
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ui text-muted-foreground">
            <span>
              <span className="font-mono">#{pr.number}</span>
              {" · "}
              {timeVerb} {formatRelativeTime(timeAt)}
              {pr.user ? (
                <>
                  {" by "}
                  <ProfileLink
                    login={pr.user.login}
                    stopPropagation
                    className="text-muted-foreground"
                  >
                    {pr.user.login}
                  </ProfileLink>
                </>
              ) : null}
            </span>
            {pr.comments > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" />
                {pr.comments}
              </span>
            )}
            <ReviewDecisionText decision={reviewDecision} />
            {pr.assignees.length > 0 && (
              <div className="mt-0.5 flex ">
                {pr.assignees.slice(0, 3).map((a) => (
                  <Avatar key={a.login} login={a.login} avatarUrl={a.avatar_url} size="sm" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Per-check lifecycle → a bare glyph (no enclosing circle) + tone, matching
// GitHub: a check for pass, an X for fail, a spinner while running.
const CHECK_GLYPH: Record<CheckContextStatus, { Icon: LucideIcon; tone: string; spin?: boolean }> =
  {
    success: { Icon: Check, tone: "text-(--color-success)" },
    failure: { Icon: X, tone: "text-(--color-danger)" },
    pending: { Icon: Loader2, tone: "text-(--color-warning)", spin: true },
    neutral: { Icon: Minus, tone: "text-(--color-fg-muted)" },
    skipped: { Icon: Minus, tone: "text-(--color-fg-faint)" },
    cancelled: { Icon: Minus, tone: "text-(--color-fg-faint)" },
  };

function CheckGlyph({ status, className }: { status: CheckContextStatus; className?: string }) {
  const { Icon, tone, spin } = CHECK_GLYPH[status];
  return (
    <Icon
      aria-label={status}
      className={cn("size-4 shrink-0", tone, spin && "animate-spin", className)}
      strokeWidth={2.5}
    />
  );
}

// CI rollup next to the title — the same green-check / red-X / amber-spinner
// GitHub shows, with a hover-card listing every check (step/action) and its
// result. `undefined` (still loading) and PRs with no checks render nothing,
// so the title line stays quiet until there's a real signal.
function ChecksBadge({ rollup }: { rollup: PrCheckRollup | undefined }) {
  if (!rollup) return null;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        {/* self-center realigns the icon within the baseline-aligned title row */}
        <span className="inline-flex shrink-0 items-center self-center">
          <CheckGlyph status={rollup.state} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={8} className="w-72 p-0">
        <ChecksList rollup={rollup} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ChecksList({ rollup }: { rollup: PrCheckRollup }) {
  const passed = rollup.contexts.filter((c) => c.status === "success").length;
  const failed = rollup.contexts.filter((c) => c.status === "failure").length;
  const pending = rollup.contexts.filter((c) => c.status === "pending").length;

  const summary =
    failed > 0
      ? `${failed} failing${passed > 0 ? `, ${passed} successful` : ""}`
      : pending > 0
        ? `${pending} pending${passed > 0 ? `, ${passed} successful` : ""}`
        : `All ${passed || rollup.contexts.length} checks passed`;

  return (
    <div>
      <div className="border-b border-(--color-border) px-3 py-2">
        <span className="text-caption font-medium text-foreground">{summary}</span>
      </div>
      {rollup.contexts.length === 0 ? (
        <div className="px-3 py-3 text-center text-caption text-muted-foreground">
          No checks reported
        </div>
      ) : (
        <div className="max-h-[260px] overflow-y-auto py-1">
          {rollup.contexts.map((c, i) => {
            const row = (
              <>
                <CheckGlyph status={c.status} className="size-3.5" />
                <span className="min-w-0 flex-1 truncate text-ui text-foreground">{c.name}</span>
                {c.description ? (
                  <span className="shrink-0 truncate text-caption text-muted-foreground">
                    {c.description}
                  </span>
                ) : null}
              </>
            );
            const rowClass = "flex items-center gap-2 px-3 py-1.5";
            // Content is portaled outside the row Link, but stop propagation
            // anyway so an external check link never also triggers navigation.
            return c.url ? (
              <a
                // biome-ignore lint/suspicious/noArrayIndexKey: check order is stable within a rollup; name+index disambiguates duplicate contexts.
                key={`${c.name}-${i}`}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(rowClass, "transition-colors hover:bg-muted")}
              >
                {row}
              </a>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: check order is stable within a rollup; name+index disambiguates duplicate contexts.
              <div key={`${c.name}-${i}`} className={rowClass}>
                {row}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tree connector lines ──────────────────────────────────────────────────
//
// Geometry:
//   paddingLeft per row = 16 + depth * DEPTH_INDENT (+ 6 for children)
//   connector X for depth d = 4 + d * DEPTH_INDENT  (midpoint of indent gap)
//   arm width = DEPTH_INDENT / 2  (horizontal branch to content)
//
// When siblings follow (first/middle child), the vertical line runs the full
// row height as one continuous stroke with a horizontal arm at center.
// Only the last (or only) child draws a rounded L-bend that terminates.

function TreeConnector({
  depth,
  treePosition,
  ancestorContinuations,
}: {
  depth: number;
  treePosition: TreePosition;
  ancestorContinuations: number[];
}) {
  const hasMore = treePosition === "first-child" || treePosition === "middle-child";
  const connX = 4 + depth * DEPTH_INDENT;
  const armWidth = DEPTH_INDENT / 2;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Ancestor continuation lines — full-height verticals */}
      {ancestorContinuations.map((ancDepth) => (
        <div
          key={ancDepth}
          className="absolute top-0 h-full border-l border-(--color-border)"
          style={{ left: 4 + (ancDepth + 1) * DEPTH_INDENT }}
        />
      ))}

      {hasMore ? (
        <>
          {/* Continuous vertical line through the full row */}
          <div
            className="absolute top-0 h-full border-l border-(--color-border)"
            style={{ left: connX }}
          />
          {/* Horizontal arm branching off at center */}
          <div
            className="absolute top-1/2 border-t border-(--color-border)"
            style={{ left: connX, width: armWidth }}
          />
        </>
      ) : (
        /* Last/only child — L-bend with rounded corner, terminates here */
        <div
          className="absolute top-0 border-b border-l border-(--color-border) rounded-bl-lg"
          style={{ left: connX, width: armWidth, height: "50%" }}
        />
      )}
    </div>
  );
}

function ReviewDecisionText({ decision }: { decision: ReviewDecision | undefined }) {
  if (decision === "approved") {
    return (
      <span
        className="inline-flex items-center gap-1 text-caption text-(--color-success)"
        title="Approved"
      >
        <CircleCheck className="size-3" aria-hidden />
        Approved
      </span>
    );
  }

  if (decision === "changes_requested") {
    return (
      <span
        className="inline-flex items-center gap-1 text-caption text-(--color-danger)"
        title="Changes requested"
      >
        <CircleX className="size-3" aria-hidden />
        Changes requested
      </span>
    );
  }

  return null;
}
