import { ChevronDown, ChevronRight, Columns2, Rows2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/app/lib/cn";
import { DiffView, type DiffMode, type DiffReviewHooks } from "./DiffView";

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

export function FileDiff({
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
  const [mode, setMode] = useState<DiffMode>(defaultMode);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const headerRef = useRef<HTMLElement>(null);
  const hasBeenVisible = useRef(false);
  const [visible, setVisible] = useState(!defaultCollapsed);

  // Lazy mount: only render DiffView when the file header has entered
  // the viewport at least once. Prevents Shiki tokenization + DOM
  // creation for off-screen files. Once visible, stays mounted (no
  // unmounting on scroll-away — that would lose user-expanded state).
  useEffect(() => {
    if (hasBeenVisible.current || collapsed) return;
    const el = headerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          hasBeenVisible.current = true;
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [collapsed]);

  const isBinary = !patch && (additions > 0 || deletions > 0);
  const hasPatch = !!patch;
  const showContent = !collapsed && visible;

  return (
    <section className={cn("overflow-hidden rounded-lg border border-input bg-muted", className)}>
      <header ref={headerRef} className="flex items-center gap-3 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => !c);
            if (collapsed) {
              hasBeenVisible.current = true;
              setVisible(true);
            }
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

        {hasPatch && (
          <div className="ml-2 flex items-center rounded-sm border border-border bg-background p-0.5">
            <ModeBtn active={mode === "unified"} onClick={() => setMode("unified")} title="Unified">
              <Rows2 className="size-3" />
            </ModeBtn>
            <ModeBtn active={mode === "split"} onClick={() => setMode("split")} title="Split">
              <Columns2 className="size-3" />
            </ModeBtn>
          </div>
        )}
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
}

// ── Header pieces ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FileStatus }) {
  const label =
    status === "added"
      ? "A"
      : status === "removed"
        ? "D"
        : status === "renamed"
          ? "R"
          : status === "copied"
            ? "C"
            : "M";
  const tone =
    status === "added"
      ? "bg-[var(--diff-add-gutter)] text-[var(--diff-add-marker)]"
      : status === "removed"
        ? "bg-[var(--diff-del-gutter)] text-[var(--diff-del-marker)]"
        : "bg-[var(--color-bg-sunken)] text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex size-[18px] flex-shrink-0 items-center justify-center rounded-sm font-mono text-micro font-semibold",
        tone,
      )}
      aria-label={status}
    >
      {label}
    </span>
  );
}

function Filename({
  filename,
  previousFilename,
  status,
}: {
  filename: string;
  previousFilename?: string;
  status: FileStatus;
}) {
  const isRename = status === "renamed" && previousFilename && previousFilename !== filename;
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-code">
      {isRename && (
        <>
          <span className="truncate text-[var(--color-fg-faint)] line-through decoration-[var(--color-fg-faint)]/60">
            {previousFilename}
          </span>
          <span className="flex-shrink-0 text-[var(--color-fg-faint)]">→</span>
        </>
      )}
      <span className="truncate font-medium text-foreground">{filename}</span>
    </div>
  );
}

function ChangeStats({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions || 1;
  const addPct = (additions / total) * 5;
  const delPct = (deletions / total) * 5;
  const squares: Array<"add" | "del" | "empty"> = [];
  let aLeft = additions > 0 ? Math.max(1, Math.round(addPct)) : 0;
  let dLeft = deletions > 0 ? Math.max(1, Math.round(delPct)) : 0;
  while (aLeft + dLeft > 5) {
    if (aLeft >= dLeft) aLeft--;
    else dLeft--;
  }
  for (let i = 0; i < aLeft; i++) squares.push("add");
  for (let i = 0; i < dLeft; i++) squares.push("del");
  while (squares.length < 5) squares.push("empty");

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <span className="font-mono text-caption tabular-nums text-[var(--diff-add-marker)]">
        +{additions}
      </span>
      <span className="font-mono text-caption tabular-nums text-[var(--diff-del-marker)]">
        −{deletions}
      </span>
      <span className="flex items-center gap-[2px]">
        {squares.map((kind, i) => (
          <span
            key={i}
            className={cn(
              "size-2 rounded-[1px]",
              kind === "add" && "bg-[var(--diff-add-marker)]",
              kind === "del" && "bg-[var(--diff-del-marker)]",
              kind === "empty" && "bg-[var(--color-bg-sunken)]",
            )}
          />
        ))}
      </span>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-sm",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        active
          ? "bg-[var(--color-bg-sunken)] text-[var(--color-fg)]"
          : "text-[var(--color-fg-faint)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
