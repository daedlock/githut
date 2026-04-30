import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink, FileSearch } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CodeView } from "@/app/components/code/CodeView";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { cn } from "@/app/lib/cn";
import { Button } from "../ui/button";
import type { DiffReviewHooks } from "./DiffView";
import { DiffView, useDiffMode } from "./DiffView";
import { parseUnifiedDiff } from "./parseDiff";
import type { LineKind } from "./types";
import { useCodeTokens } from "./useCodeTokens";

export type FileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed";

export type FileDiffProps = {
  filename: string;
  previousFilename?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null | undefined;
  lang?: string;
  defaultCollapsed?: boolean;
  className?: string;
  review?: DiffReviewHooks;
  owner?: string;
  repo?: string;
  headRef?: string;
  baseRef?: string;
};

export const FileDiff = memo(function FileDiff({
  filename,
  previousFilename,
  status,
  additions,
  deletions,
  patch,
  lang,
  defaultCollapsed = false,
  className,
  review,
  owner,
  repo,
  headRef,
  baseRef,
}: FileDiffProps) {
  const mode = useDiffMode();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

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
  const contextTarget = getContextTarget({ filename, previousFilename, status, headRef, baseRef });
  const canLoadContext = !!owner && !!repo && !!contextTarget && !isBinary;
  const showContent = !collapsed && mounted;
  const hasVisibleBody = showContent && (isBinary || hasPatch || contextOpen);

  return (
    <section ref={sectionRef} className={cn("rounded-lg border border-[var(--color-border)]", className)}>
      <header
        className={cn(
          "sticky top-[84px] z-[5] isolate",
          "flex items-center gap-2.5 px-3 py-2",
          "bg-[var(--color-bg-sunken)]",
          "shadow-[0_-6px_0_0_var(--color-bg)]",
          hasVisibleBody ? "border-b border-[var(--color-border)]" : "rounded-b-lg",
          "rounded-t-lg",
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

        <div className="flex shrink-0 items-center gap-1.5">
          {canLoadContext && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setContextOpen((open) => !open);
                setMounted(true);
              }}
              className={cn(contextOpen && "bg-muted text-foreground")}
              title={contextOpen ? "Hide full file context" : "Show full file context"}
              aria-label={contextOpen ? "Hide full file context" : "Show full file context"}
              aria-pressed={contextOpen}
            >
              <FileSearch data-icon="inline-start" />
            </Button>
          )}
          {owner && repo && contextTarget && (
            <Button variant="ghost" size="icon-xs" asChild>
              <Link
                to="/$owner/$repo/code"
                params={{ owner, repo }}
                search={{ path: contextTarget.path, view: "blob", branch: contextTarget.ref }}
                title="Open full file"
                aria-label="Open full file"
              >
                <ExternalLink data-icon="inline-start" />
              </Link>
            </Button>
          )}
          <ChangeStats additions={additions} deletions={deletions} />
        </div>
      </header>

      {showContent && (
        <>
          {contextOpen && owner && repo && contextTarget && (
            <FileContextPanel
              owner={owner}
              repo={repo}
              path={contextTarget.path}
              refName={contextTarget.ref}
              lang={lang}
              patch={patch}
              status={status}
            />
          )}
          {isBinary ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Binary file — preview unavailable
            </div>
          ) : hasPatch ? (
            <DiffView patch={patch} lang={lang} mode={mode} review={review} />
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No changes
            </div>
          )}
        </>
      )}
    </section>
  );
});

type ContextTarget = { path: string; ref: string };

function getContextTarget({
  filename,
  previousFilename,
  status,
  headRef,
  baseRef,
}: {
  filename: string;
  previousFilename?: string;
  status: FileStatus;
  headRef?: string;
  baseRef?: string;
}): ContextTarget | null {
  if (status === "removed") {
    return baseRef ? { path: previousFilename ?? filename, ref: baseRef } : null;
  }
  return headRef ? { path: filename, ref: headRef } : null;
}

function FileContextPanel({
  owner,
  repo,
  path,
  refName,
  lang = "text",
  patch,
  status,
}: {
  owner: string;
  repo: string;
  path: string;
  refName: string;
  lang?: string;
  patch: string | null | undefined;
  status: FileStatus;
}) {
  const fileQuery = useRepoFile(owner, repo, path, refName);
  const content = fileQuery.data?.content ?? "";
  const { data: tokenLines, isPending: tokensPending } = useCodeTokens(content, lang);
  const highlights = useMemo(() => buildLineHighlights(patch, status), [patch, status]);

  return (
    <div className="border-b border-border bg-[var(--color-code-bg)]">
      <div className="flex h-8 items-center gap-2 bg-muted px-3 font-mono text-caption text-muted-foreground">
        <span className="text-foreground">full file context</span>
        <span className="truncate">{path}</span>
      </div>
      {fileQuery.isPending || tokensPending || !tokenLines ? (
        <div className="skeleton-fade flex flex-col gap-1.5 p-3">
          {CONTEXT_SKELETON_WIDTHS.map((width) => (
            <Skeleton key={width} className="h-4" style={{ width }} />
          ))}
        </div>
      ) : fileQuery.isError ? (
        <div className="px-4 py-6 text-center text-ui text-muted-foreground">
          Could not load file context.
        </div>
      ) : (
        <CodeView lines={tokenLines} lineHighlights={highlights} className="max-h-[52vh]" />
      )}
    </div>
  );
}

const CONTEXT_SKELETON_WIDTHS = ["58%", "74%", "46%", "82%", "61%", "70%"] as const;

function buildLineHighlights(
  patch: string | null | undefined,
  status: FileStatus,
): ReadonlyMap<number, LineKind> {
  const highlights = new Map<number, LineKind>();
  for (const hunk of parseUnifiedDiff(patch)) {
    for (const line of hunk.lines) {
      if (status === "removed") {
        if (line.kind === "del" && line.oldNum) highlights.set(line.oldNum, "removed");
      } else if (line.kind === "add" && line.newNum) {
        highlights.set(line.newNum, "added");
      }
    }
  }
  return highlights;
}

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
    <span className={cn("shrink-0 font-mono text-xs font-bold", tone)} aria-label={status}>
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
      <span className="font-mono text-xs tabular-nums text-[var(--diff-add-marker)]">+{additions}</span>
      <span className="font-mono text-xs tabular-nums text-[var(--diff-del-marker)]">−{deletions}</span>
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
