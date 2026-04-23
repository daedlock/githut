import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";
import type { DiffMode, DiffReviewHooks } from "./DiffView";
import { DiffView } from "./DiffView";

export type FileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed";

export type FileDiffProps = {
  filename: string;
  previousFilename?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null | undefined;
  lang?: string;
  defaultMode?: DiffMode;
  defaultCollapsed?: boolean;
  className?: string;
  review?: DiffReviewHooks;
};

export const FileDiff = memo(function FileDiff({
  filename,
  previousFilename,
  status,
  additions,
  deletions,
  patch,
  lang,
  defaultMode = "unified",
  defaultCollapsed = false,
  className,
  review,
}: FileDiffProps) {
  const mode = defaultMode;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted || collapsed) return;
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [collapsed, mounted]);

  const isBinary = !patch && (additions > 0 || deletions > 0);
  const hasPatch = !!patch;
  const showContent = !collapsed && mounted;
  const hasVisibleBody = showContent && (isBinary || hasPatch);

  return (
    <section ref={sectionRef} className={cn("overflow-hidden rounded-lg border border-[var(--color-border)]", className)}>
      <header
        className={cn(
          "sticky top-[44px] z-[5]",
          "flex items-center gap-2.5 px-3 py-2",
          "bg-[var(--color-bg-subtle)]",
          hasVisibleBody && "border-b border-[var(--color-border)]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => !c);
            if (collapsed) setMounted(true);
          }}
          className="shrink-0 rounded p-0.5 text-[var(--color-fg-faint)] outline-none transition-colors hover:text-foreground"
          aria-label={collapsed ? "Expand diff" : "Collapse diff"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        <StatusBadge status={status} />

        <div className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-code">
          {status === "renamed" && previousFilename && previousFilename !== filename && (
            <>
              <span className="truncate text-[var(--color-fg-faint)] line-through">{previousFilename}</span>
              <span className="shrink-0 text-[var(--color-fg-faint)]">→</span>
            </>
          )}
          <span className="truncate text-foreground">{filename}</span>
        </div>

        <ChangeStats additions={additions} deletions={deletions} />
      </header>

      {showContent && (
        <>
          {isBinary ? (
            <div className="px-4 py-6 text-center font-mono text-caption uppercase tracking-widest text-[var(--color-fg-faint)]">
              Binary file — preview unavailable
            </div>
          ) : hasPatch ? (
            <DiffView patch={patch} lang={lang} mode={mode} review={review} />
          ) : (
            <div className="px-4 py-6 text-center font-mono text-caption uppercase tracking-widest text-[var(--color-fg-faint)]">
              No changes
            </div>
          )}
        </>
      )}
    </section>
  );
});

function StatusBadge({ status }: { status: FileStatus }) {
  const label =
    status === "added" ? "A" : status === "removed" ? "D" : status === "renamed" ? "R" : status === "copied" ? "C" : "M";
  const tone =
    status === "added"
      ? "text-[var(--diff-add-marker)]"
      : status === "removed"
        ? "text-[var(--diff-del-marker)]"
        : "text-[var(--color-fg-faint)]";
  return (
    <span className={cn("shrink-0 font-mono text-micro font-bold", tone)} aria-label={status}>
      {label}
    </span>
  );
}

function ChangeStats({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions || 1;
  const squares: Array<"add" | "del" | "empty"> = [];
  let aLeft = additions > 0 ? Math.max(1, Math.round((additions / total) * 5)) : 0;
  let dLeft = deletions > 0 ? Math.max(1, Math.round((deletions / total) * 5)) : 0;
  while (aLeft + dLeft > 5) { if (aLeft >= dLeft) aLeft--; else dLeft--; }
  for (let i = 0; i < aLeft; i++) squares.push("add");
  for (let i = 0; i < dLeft; i++) squares.push("del");
  while (squares.length < 5) squares.push("empty");
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="font-mono text-micro tabular-nums text-[var(--diff-add-marker)]">+{additions}</span>
      <span className="font-mono text-micro tabular-nums text-[var(--diff-del-marker)]">−{deletions}</span>
      <span className="flex items-center gap-px">
        {squares.map((kind, i) => (
          <span
            key={i}
            className={cn(
              "size-[7px] rounded-[2px]",
              kind === "add" && "bg-[var(--diff-add-marker)]",
              kind === "del" && "bg-[var(--diff-del-marker)]",
              kind === "empty" && "bg-[var(--color-border-strong)]",
            )}
          />
        ))}
      </span>
    </div>
  );
}
