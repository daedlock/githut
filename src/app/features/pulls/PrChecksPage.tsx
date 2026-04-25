import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  ExternalLink,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useFullPr, usePrChecks } from "@/app/features/pulls/hooks";
import type { CheckRun } from "@/app/features/pulls/hooks";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type PrChecksPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrChecksPage({ owner, repo, number }: PrChecksPageProps) {
  const prQuery = useFullPr(owner, repo, number);
  const checksQuery = usePrChecks(owner, repo, prQuery.data?.head.sha);

  if (prQuery.isPending || checksQuery.isPending) return <ChecksSkeleton />;
  if (prQuery.isError || !prQuery.data) {
    return <StateRow tone="danger" text="Could not load this pull request." />;
  }
  if (checksQuery.isError) {
    return <StateRow tone="danger" text="Could not load checks for this PR." />;
  }

  const data = checksQuery.data;
  if (!data) return <StateRow tone="muted" text="No checks have reported yet." />;

  const { checkRuns, combined } = data;
  const total = checkRuns.length + combined.statuses.length;
  if (total === 0) {
    return <StateRow tone="muted" text="No checks have reported yet." />;
  }

  const rollup = summarize(checkRuns, combined.state, combined.statuses.length);

  return (
    <div className="flex flex-col gap-3">
      {/* Rollup */}
      <div className={cn("flex items-center gap-3 rounded-lg px-4 py-3", rollup.bg)}>
        <rollup.Icon className={cn("size-5 shrink-0", rollup.tone)} aria-hidden />
        <div>
          <p className="text-body font-medium text-foreground">{rollup.headline}</p>
          <p className="text-caption text-muted-foreground">{rollup.detail}</p>
        </div>
      </div>

      {/* Check runs */}
      {checkRuns.length > 0 && (
        <div className="flex flex-col gap-1">
          {checkRuns.map((run) => (
            <CheckRunRow key={run.id} run={run} />
          ))}
        </div>
      )}

      {/* Combined statuses (legacy) */}
      {combined.statuses.length > 0 && (
        <div className="flex flex-col gap-1">
          {combined.statuses.map((s) => {
            const icon = iconForState(s.state);
            return (
              <div
                key={s.id}
                className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted rounded-lg"
              >
                <icon.Icon
                  className={cn("mt-0.5 size-4 shrink-0", icon.tone)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-[475] text-foreground truncate">
                    {s.context}
                  </div>
                  {s.description && (
                    <div className="mt-0.5 text-caption text-muted-foreground truncate">
                      {s.description}
                    </div>
                  )}
                  <div className="mt-0.5 text-micro text-[var(--color-fg-faint)]">
                    {formatRelativeTime(s.updated_at)}
                  </div>
                </div>
                {s.target_url && (
                  <a
                    href={s.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 rounded-sm px-2 py-1",
                      "text-caption text-muted-foreground outline-none transition-colors",
                      "hover:bg-muted hover:text-foreground",
                      "focus-visible:ring-1 focus-visible:ring-foreground/15",
                    )}
                  >
                    Details
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckRunRow({ run }: { run: CheckRun }) {
  const icon = iconForCheckRun(run);
  const url = run.html_url ?? run.details_url ?? undefined;
  const appName = run.app?.name;

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted rounded-lg">
      <icon.Icon className={cn("mt-0.5 size-4 shrink-0", icon.tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-body font-[475] text-foreground truncate">
            {run.name}
          </span>
          {appName && (
            <span className="rounded bg-muted px-1.5 text-micro text-muted-foreground">
              {appName}
            </span>
          )}
        </div>
        {run.output?.title && (
          <div className="mt-0.5 text-caption text-muted-foreground truncate">
            {run.output.title}
          </div>
        )}
        {run.completed_at ? (
          <div className="mt-0.5 text-micro text-[var(--color-fg-faint)]">
            {formatRelativeTime(run.completed_at)}
          </div>
        ) : run.started_at ? (
          <div className="mt-0.5 text-micro text-[var(--color-fg-faint)]">
            Running since {formatRelativeTime(run.started_at)}
          </div>
        ) : null}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-sm px-2 py-1",
            "text-caption text-muted-foreground outline-none transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          Details
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

// ─── Icon mappings ─────────────────────────────────────────────────────────

function iconForCheckRun(run: CheckRun): { Icon: LucideIcon; tone: string } {
  if (run.status !== "completed") {
    return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
  switch (run.conclusion) {
    case "success":
      return { Icon: CheckCircle2, tone: "text-[var(--color-success)]" };
    case "failure":
    case "timed_out":
      return { Icon: XCircle, tone: "text-[var(--color-danger)]" };
    case "action_required":
      return { Icon: AlertCircle, tone: "text-[var(--color-warning)]" };
    case "cancelled":
    case "skipped":
      return { Icon: MinusCircle, tone: "text-[var(--color-fg-faint)]" };
    case "neutral":
    case "stale":
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
    case "pending":
    default:
      return { Icon: Clock, tone: "text-[var(--color-warning)]" };
  }
}

function summarize(
  runs: CheckRun[],
  combined: "pending" | "success" | "failure" | "error",
  combinedCount: number,
) {
  let passing = 0;
  let failing = 0;
  let pending = 0;
  for (const r of runs) {
    if (r.status !== "completed") {
      pending++;
    } else if (r.conclusion === "success" || r.conclusion === "skipped") {
      passing++;
    } else if (r.conclusion === "failure" || r.conclusion === "timed_out") {
      failing++;
    }
  }
  if (combinedCount > 0) {
    if (combined === "success") passing++;
    else if (combined === "failure" || combined === "error") failing++;
    else pending++;
  }

  if (failing > 0) {
    return {
      Icon: XCircle,
      tone: "text-[var(--color-danger)]",
      bg: "bg-[color-mix(in_oklab,var(--color-danger)_8%,var(--color-bg-subtle))]",
      headline: `${failing} failing ${failing === 1 ? "check" : "checks"}`,
      detail: `${passing} passing · ${pending} pending`,
    };
  }
  if (pending > 0) {
    return {
      Icon: CircleDot,
      tone: "text-[var(--color-warning)]",
      bg: "bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-bg-subtle))]",
      headline: `${pending} pending ${pending === 1 ? "check" : "checks"}`,
      detail: `${passing} passing · ${failing} failing`,
    };
  }
  return {
    Icon: CheckCircle2,
    tone: "text-[var(--color-success)]",
    bg: "bg-[color-mix(in_oklab,var(--color-success)_8%,var(--color-bg-subtle))]",
    headline: passing > 0 ? "All checks passed" : "No checks",
    detail: passing > 0 ? `${passing} successful` : "",
  };
}

function StateRow({
  tone,
  text,
}: {
  tone: "muted" | "danger";
  text: string;
}) {
  const Icon = tone === "danger" ? AlertCircle : CircleDot;
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon
        className={cn(
          "size-5",
          tone === "danger" ? "text-destructive" : "text-[var(--color-fg-faint)]",
        )}
      />
      <p className="text-body text-muted-foreground">{text}</p>
    </div>
  );
}

function ChecksSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      <Skeleton className="h-14 rounded-lg" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          <Skeleton className="size-4 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5" style={{ width: `${50 + i * 10}%` }} />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
