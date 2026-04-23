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

// Lazy DiffView: the file header renders immediately (cheap) but the
// actual diff content only mounts when the header enters a 600px
// viewport margin. Combined with content-visibility on the outer
// wrapper, this gives instant page load + smooth scroll + no empty
// space. Shiki tokens are prefetched so the DiffView mounts with
// cached data.
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

  return (
    <section ref={sectionRef} className={cn("border-b border-border", className)}>
      <header className="sticky top-[44px] z-[5] flex items-center gap-3 border-b border-border bg-muted px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => !c);
            if (collapsed) setMounted(true);
          }}
          className={cn(
            "shrink-0 rounded-sm p-0.5 text-fg-faint",
            "outline-none transition-colors",
            "hover:bg-(--color-bg-sunken) hover:text-(--color-fg)",
            "focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
          aria-label={collapsed ? "Expand diff" : "Collapse diff"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        <StatusBadge status={status} />
        <Filename filename={filename} previousFilename={previousFilename} status={status} />
        <ChangeStats additions={additions} deletions={deletions} />
      </header>

      {showContent && (
        <>
          {isBinary ? (
            <div className="bg-muted px-4 py-5 text-center font-mono text-ui uppercase tracking-widest text-[var(--color-fg-faint)]">
              Binary file — preview unavailable
            </div>
          ) : hasPatch ? (
            <DiffView patch={patch} lang={lang} mode={mode} review={review} className="rounded-none border-0" />
          ) : (
            <div className="bg-muted px-4 py-5 text-center font-mono text-ui uppercase tracking-widest text-[var(--color-fg-faint)]">
              No changes
            </div>
          )}
        </>
      )}
    </section>
  );
});

// ── Header pieces ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FileStatus }) {
  const label =
    status === "added" ? "A" : status === "removed" ? "D" : status === "renamed" ? "R" : status === "copied" ? "C" : "M";
  const tone =
    status === "added"
      ? "bg-[var(--diff-add-gutter)] text-[var(--diff-add-marker)]"
      : status === "removed"
        ? "bg-[var(--diff-del-gutter)] text-[var(--diff-del-marker)]"
        : "bg-[var(--color-bg-sunken)] text-muted-foreground";
  return (
    <span className={cn("inline-flex size-[18px] flex-shrink-0 items-center justify-center rounded-sm font-mono text-micro font-semibold", tone)} aria-label={status}>
      {label}
    </span>
  );
}

function Filename({ filename, previousFilename, status }: { filename: string; previousFilename?: string; status: FileStatus }) {
  const isRename = status === "renamed" && previousFilename && previousFilename !== filename;
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-code">
      {isRename && (
        <>
          <span className="truncate text-[var(--color-fg-faint)] line-through decoration-[var(--color-fg-faint)]/60">{previousFilename}</span>
          <span className="flex-shrink-0 text-[var(--color-fg-faint)]">→</span>
        </>
      )}
      <span className="truncate font-medium text-foreground">{filename}</span>
    </div>
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
    <div className="flex flex-shrink-0 items-center gap-2">
      <span className="font-mono text-caption tabular-nums text-[var(--diff-add-marker)]">+{additions}</span>
      <span className="font-mono text-caption tabular-nums text-[var(--diff-del-marker)]">−{deletions}</span>
      <span className="flex items-center gap-[2px]">
        {squares.map((kind, i) => (
          <span key={i} className={cn("size-2 rounded-[1px]", kind === "add" && "bg-[var(--diff-add-marker)]", kind === "del" && "bg-[var(--diff-del-marker)]", kind === "empty" && "bg-[var(--color-bg-sunken)]")} />
        ))}
      </span>
    </div>
  );
}

