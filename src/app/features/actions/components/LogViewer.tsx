import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, AlertTriangle, Bug, Info, Loader2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import type {
  LogCommandLevel,
  LogLine,
  LogToken,
} from "@/app/features/actions/lib/parseLog";
import { cn } from "@/app/lib/cn";

// ─── LogViewer ─────────────────────────────────────────────────────────────
//
// Virtualized plaintext log renderer.
//   - ANSI colors surface inline via per-token style
//   - `##[group]…##[endgroup]` markers render as divider rows
//   - `::error::` / `::warning::` / `::notice::` / `::debug::` become
//     tinted command rows with a severity icon
//   - Scrolls independently; in live mode, auto-scrolls to the bottom as
//     new lines arrive (unless the user has scrolled up — in which case
//     we respect their position).

const LINE_H = 18; // px — mono @ 12-13px × 1.4 line-height
const GUTTER_W = 56; // px — line number column
const MAX_H = 480; // px — caps the viewer so long logs don't dominate the page
const OVERSCAN = 20;

export type LogViewerProps = {
  /** Pre-parsed log lines for this segment (one job, one step, whatever). */
  lines: LogLine[];
  isPending: boolean;
  isError: boolean;
  errorStatus?: number;
  /** Live mode: auto-tail to the latest line when it arrives. */
  isLive?: boolean;
  className?: string;
};

export function LogViewer({
  lines,
  isPending,
  isError,
  errorStatus,
  isLive = false,
  className,
}: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_H,
    overscan: OVERSCAN,
  });

  // ─── Auto-tail in live mode, but respect user scroll position ────────────
  const stickToBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      stickToBottom.current = atBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isLive || !stickToBottom.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isLive, lines.length]);

  // ─── Auto-scroll to first error on terminal failed steps ─────────────────
  //
  // Find the first line flagged as error (either a `##[error]/::error::`
  // command row or a plain line classified by `classifySeverity`). When the
  // step isn't live anymore, jump the viewport to it — saves the user
  // scrolling through hundreds of "Set up Go succeeded" rows. Only fires
  // once per unique error index so a poll returning the same logs doesn't
  // keep re-scrolling while the user is reading.
  const firstErrorIndex = useMemo(() => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.kind === "command" && line.level === "error") return i;
      if (line.severity === "error") return i;
    }
    return -1;
  }, [lines]);

  const scrolledToErrorRef = useRef<number>(-1);
  useEffect(() => {
    if (isLive || firstErrorIndex === -1) return;
    if (scrolledToErrorRef.current === firstErrorIndex) return;
    // Defer a frame so the virtualizer has measured enough to compute offsets.
    const id = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(firstErrorIndex, { align: "center" });
      scrolledToErrorRef.current = firstErrorIndex;
    });
    return () => cancelAnimationFrame(id);
    // `virtualizer` identity is stable for the hook's lifetime; adding it
    // here would cause a scroll loop on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstErrorIndex, isLive]);

  // ─── States (priority ordered) ──────────────────────────────────────────
  //
  // Ordering matters. Live steps NEVER show the skeleton — they'd flicker
  // between skeleton and "Waiting" on every 3 s poll. Skeleton is reserved
  // for the cold first-load of a *terminal* step. A live step with no lines
  // yet, regardless of error/pending status, always shows the waiting
  // spinner — polling replaces it with logs the moment bytes arrive.
  const hasLines = lines.length > 0;

  // Skeleton: only on the initial cold load of a terminal step.
  if (isPending && !isLive && !hasLines) {
    return (
      <div className={cn("bg-(--color-bg-subtle) border-t border-border p-3", className)}>
        <div className="skeleton-fade flex flex-col gap-1.5">
          {[68, 90, 42, 78, 60, 84].map((w) => (
            <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // Live + no lines yet: single stable "Waiting for output…" state. Covers
  // initial fetch, polling retries, and 404s from Azure while the blob is
  // still being written — every path ends here for a running step.
  if (isLive && !hasLines) {
    return (
      <div
        className={cn(
          "bg-(--color-bg-subtle) border-t border-border px-4 py-5 text-center",
          className,
        )}
      >
        <Loader2
          className="mx-auto mb-1.5 size-4 animate-spin text-(--color-warning)"
          aria-hidden
        />
        <p className="font-mono text-caption text-muted-foreground">Waiting for output…</p>
      </div>
    );
  }

  // Terminal step + error: show scoped error. Skipped for live (handled above).
  if (isError && !hasLines) {
    return (
      <div
        className={cn(
          "bg-(--color-bg-subtle) border-t border-border px-4 py-6 text-center",
          className,
        )}
      >
        <AlertCircle className="mx-auto mb-1.5 size-4 text-destructive" aria-hidden />
        <p className="text-caption text-muted-foreground">
          {errorStatus === 401 || errorStatus === 403
            ? "Token is missing actions:read / workflow scope."
            : errorStatus === 404
              ? "Logs aren't available for this job yet."
              : errorStatus === 410
                ? "Logs have expired (GitHub retains them 90 days)."
                : "Could not load logs."}
        </p>
        {errorStatus && errorStatus !== 401 && errorStatus !== 403 && errorStatus !== 404 ? (
          <p className="mt-1 font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
            status {errorStatus}
          </p>
        ) : null}
      </div>
    );
  }

  // Terminal step that completed with genuinely no output.
  if (!hasLines) {
    return (
      <div
        className={cn(
          "bg-(--color-bg-subtle) border-t border-border px-4 py-6 text-center",
          className,
        )}
      >
        <p className="font-mono text-caption text-(--color-fg-faint)">No log output.</p>
      </div>
    );
  }

  const containerH = Math.min(lines.length * LINE_H + 12, MAX_H);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-auto border-t border-border bg-(--color-bg-subtle)",
        "font-mono text-[12px] leading-[18px]",
        className,
      )}
      style={{
        height: containerH,
        // Force the mono token inline so unlayered font-family inherits can't
        // steal it (same technique as CodeView).
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const line = lines[v.index];
          if (!line) return null;
          return (
            <LogRow
              key={v.key}
              lineNumber={v.index + 1}
              line={line}
              isLive={isLive}
              isLastLine={v.index === lines.length - 1}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: LINE_H,
                transform: `translateY(${v.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────

type LogRowProps = {
  lineNumber: number;
  line: LogLine;
  isLive: boolean;
  isLastLine: boolean;
  style: React.CSSProperties;
};

const LogRow = memo(function LogRow({ lineNumber, line, isLive, isLastLine, style }: LogRowProps) {
  // Tint the row if it carries error/warning signal — either as a workflow
  // command (`##[error]` / `::error::`) or a plain-text line matching the
  // severity heuristics in parseLog.
  const sevBg =
    line.kind === "command"
      ? commandRowBg(line.level)
      : line.severity === "error"
        ? commandRowBg("error")
        : line.severity === "warning"
          ? commandRowBg("warning")
          : "";

  return (
    <div
      style={style}
      className={cn(
        "flex items-center select-text whitespace-pre",
        sevBg,
        line.kind === "group-start" && "bg-(--color-bg-sunken)",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 select-none pr-3 text-right tabular-nums",
          line.severity === "error" || (line.kind === "command" && line.level === "error")
            ? "text-(--color-danger)"
            : "text-(--color-fg-faint)/60",
        )}
        style={{ width: GUTTER_W }}
      >
        {lineNumber}
      </span>

      {line.kind === "group-start" ? (
        <GroupStart title={line.groupTitle ?? ""} />
      ) : line.kind === "group-end" ? (
        <span className="text-caption text-(--color-fg-faint)">— end group</span>
      ) : line.kind === "command" ? (
        <CommandLine level={line.level ?? "notice"} tokens={line.tokens} />
      ) : (
        <NormalLine tokens={line.tokens} severity={line.severity} />
      )}

      {/* Live cursor — a single blinking caret at the very end of the
          log when the job is still running. Signals "more coming". */}
      {isLive && isLastLine ? <LiveCaret /> : null}
    </div>
  );
});

// ─── Line bodies ───────────────────────────────────────────────────────────

function NormalLine({
  tokens,
  severity,
}: {
  tokens: LogToken[];
  severity?: "error" | "warning";
}) {
  return (
    <span
      className={cn(
        "min-w-0",
        severity === "error"
          ? "text-(--color-danger)"
          : severity === "warning"
            ? "text-(--color-warning)"
            : "text-(--color-fg)",
      )}
    >
      {tokens.map((t, i) => (
        <span
          key={i}
          // If the line has severity, honor it over the ANSI color — the
          // content color is less informative than the failure signal here.
          style={
            severity
              ? {
                  fontWeight: t.bold ? 600 : undefined,
                  fontStyle: t.italic ? "italic" : undefined,
                  textDecoration: t.underline ? "underline" : undefined,
                  opacity: t.dim ? 0.6 : undefined,
                }
              : {
                  color: t.fg,
                  fontWeight: t.bold ? 600 : undefined,
                  fontStyle: t.italic ? "italic" : undefined,
                  textDecoration: t.underline ? "underline" : undefined,
                  opacity: t.dim ? 0.6 : undefined,
                }
          }
        >
          {t.content}
        </span>
      ))}
    </span>
  );
}

function CommandLine({ level, tokens }: { level: LogCommandLevel; tokens: LogToken[] }) {
  const Icon =
    level === "error"
      ? AlertCircle
      : level === "warning"
        ? AlertTriangle
        : level === "debug"
          ? Bug
          : Info;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", commandRowFg(level))}>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="font-mono text-micro uppercase tracking-widest">{level}</span>
      <span className="truncate">
        {tokens.map((t, i) => (
          <span key={i}>{t.content}</span>
        ))}
      </span>
    </span>
  );
}

function GroupStart({ title }: { title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="font-mono text-micro uppercase tracking-widest text-(--color-fg-faint)">
        group
      </span>
      <span className="truncate">{title}</span>
    </span>
  );
}

function LiveCaret() {
  return (
    <Loader2
      className="ml-2 size-3 shrink-0 animate-spin text-(--color-warning)"
      aria-hidden
    />
  );
}

// ─── Style maps ────────────────────────────────────────────────────────────

function commandRowBg(level: LogCommandLevel | undefined) {
  switch (level) {
    case "error":
      return "bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-bg-subtle))]";
    case "warning":
      return "bg-[color-mix(in_oklab,var(--color-warning)_12%,var(--color-bg-subtle))]";
    case "notice":
      return "bg-[color-mix(in_oklab,var(--color-brand)_8%,var(--color-bg-subtle))]";
    case "debug":
      return "bg-(--color-bg-sunken)";
    default:
      return "";
  }
}

function commandRowFg(level: LogCommandLevel) {
  switch (level) {
    case "error":
      return "text-(--color-danger)";
    case "warning":
      return "text-(--color-warning)";
    case "notice":
      return "text-(--color-brand)";
    case "debug":
      return "text-(--color-fg-muted)";
  }
}
