import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  ExternalLink,
  FileSearch,
  GitMerge,
  History,
  PanelLeft,
  Rows2,
  X as XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DiffView, type DiffMode } from "@/app/components/code/DiffView";
import { FileContextPanel } from "@/app/components/code/FileDiff";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { ShaChip } from "@/app/components/ui/ShaChip";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { CommitSummary } from "@/app/hooks/useRepoCommits";
import { useFileHistorySession } from "@/app/hooks/useFileHistorySession";
import { cn } from "@/app/lib/cn";
import { detectLang } from "@/app/lib/detectLang";
import { formatRelativeTime } from "@/app/lib/time";

const RAIL_PAGE_TRIGGER_MARGIN = 240;

export function FileHistorySheet() {
  const session = useFileHistorySession();

  return (
    <Dialog
      open={session.open}
      onOpenChange={(next) => {
        if (!next) session.close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[92vh] max-h-[92vh] w-[min(1400px,95vw)] max-w-[min(1400px,95vw)] flex-col overflow-hidden gap-0 p-0 sm:max-w-[min(1400px,95vw)]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => {
            const nextBtn = document.querySelector<HTMLButtonElement>(
              '[data-fh-action="next"]',
            );
            nextBtn?.focus();
          });
        }}
      >
        <DialogTitle className="sr-only">File history</DialogTitle>
        <DialogDescription className="sr-only">
          Step through every commit that touched this file. Use ←/→ or j/k to navigate.
        </DialogDescription>
        <SheetBody session={session} />
      </DialogContent>
    </Dialog>
  );
}

function SheetBody({ session }: { session: ReturnType<typeof useFileHistorySession> }) {
  const [mode, setMode] = useState<DiffMode>("split");
  const [contextOpen, setContextOpen] = useState(false);
  useFileHistoryKeys(session, () => setContextOpen((c) => !c));

  if (!session.open) return null;

  const lang = session.path ? detectLang(session.path) : undefined;
  const file = session.currentFile;
  const commit = session.commitDetail;
  const isLoading = session.isCommitLoading || session.isHistoryLoading;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar
        session={session}
        mode={mode}
        onModeChange={setMode}
        contextOpen={contextOpen}
        onContextToggle={() => setContextOpen((c) => !c)}
      />
      <CommitContextStrip session={session} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CommitRail session={session} />

        <div className="min-w-0 flex-1 overflow-y-auto bg-background">
          {isLoading && !file ? (
            <DiffSkeleton />
          ) : !file ? (
            <EmptyStep
              kind={
                session.linearCommits.length === 0
                  ? "no-history"
                  : commit
                    ? "no-change"
                    : "loading"
              }
              path={session.path ?? ""}
            />
          ) : (
            <>
              <FileMetaRow
                filename={file.filename}
                previousFilename={file.previous_filename}
                status={file.status}
                additions={file.additions}
                deletions={file.deletions}
              />
              {contextOpen && session.owner && session.repo && session.activeSha && (
                <FileContextPanel
                  owner={session.owner}
                  repo={session.repo}
                  // For removed files, the head SHA no longer contains the file —
                  // load context from its parent instead.
                  path={file.status === "removed" ? (file.previous_filename ?? file.filename) : file.filename}
                  refName={
                    file.status === "removed"
                      ? (commit?.parents[0]?.sha ?? session.activeSha)
                      : session.activeSha
                  }
                  lang={lang}
                  patch={file.patch}
                  status={file.status === "unchanged" ? "modified" : file.status}
                  loadingVariant="spinner"
                />
              )}
              {file.patch ? (
                <DiffView
                  key={`${session.activeSha}:${file.filename}:${mode}`}
                  patch={file.patch}
                  lang={lang}
                  mode={mode}
                />
              ) : (
                <div className="px-6 py-12 text-center font-mono text-caption uppercase tracking-widest text-[var(--color-fg-faint)]">
                  Binary file — preview unavailable
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────

function TopBar({
  session,
  mode,
  onModeChange,
  contextOpen,
  onContextToggle,
}: {
  session: ReturnType<typeof useFileHistorySession>;
  mode: DiffMode;
  onModeChange: (m: DiffMode) => void;
  contextOpen: boolean;
  onContextToggle: () => void;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-muted px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <History className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-caption font-medium uppercase tracking-widest text-muted-foreground">
          history
        </span>
        <span className="shrink-0 text-caption text-[var(--color-fg-faint)]">·</span>
        <span className="min-w-0 truncate font-mono text-code text-foreground">
          {session.path ?? ""}
        </span>
      </div>

      <InlineTimeline session={session} />

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onContextToggle}
          aria-pressed={contextOpen}
          aria-label={contextOpen ? "Hide full file context" : "Show full file context"}
          title={contextOpen ? "Hide full file (c)" : "Show full file (c)"}
          className={cn(contextOpen && "bg-accent text-foreground")}
        >
          <FileSearch />
        </Button>

        <ModeToggle mode={mode} onChange={onModeChange} />

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={session.toggleRail}
          aria-pressed={session.railOpen}
          aria-label={session.railOpen ? "Hide commit list" : "Show commit list"}
          title={session.railOpen ? "Hide commit list (\\)" : "Show commit list (\\)"}
          className={cn(session.railOpen && "bg-accent text-foreground")}
        >
          <PanelLeft />
        </Button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={session.prev}
          disabled={!session.hasPrev}
          aria-label="Newer commit"
          title="Newer commit (← / k)"
        >
          <ChevronLeft />
        </Button>

        <span className="min-w-[3.5rem] text-center font-mono text-caption tabular-nums text-foreground">
          {session.positionLabel}
        </span>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={session.next}
          disabled={!session.hasNext}
          aria-label="Older commit"
          title="Older commit (→ / j)"
          data-fh-action="next"
        >
          <ChevronRight />
        </Button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {session.activeSha && session.owner && session.repo && (
          <Button variant="ghost" size="icon-xs" asChild>
            <Link
              to="/$owner/$repo/commit/$sha"
              params={{
                owner: session.owner,
                repo: session.repo,
                sha: session.activeSha,
              }}
              aria-label="Open commit"
              title="Open commit page (o)"
            >
              <ExternalLink />
            </Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={session.close}
          aria-label="Close"
          title="Close (Esc)"
        >
          <XIcon />
        </Button>
      </div>
    </header>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: DiffMode;
  onChange: (m: DiffMode) => void;
}) {
  return (
    <div className="flex items-center rounded-md bg-background p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onChange("unified")}
        className={cn(mode === "unified" && "bg-muted text-foreground")}
        aria-label="Unified diff"
        title="Unified"
      >
        <Rows2 data-icon="inline-start" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onChange("split")}
        className={cn(mode === "split" && "bg-muted text-foreground")}
        aria-label="Split diff"
        title="Split"
      >
        <Columns2 data-icon="inline-start" />
      </Button>
    </div>
  );
}

// ─── Timeline dots strip ──────────────────────────────────────────────────

/* Compact filmstrip — renders all linear commits as dots, but only a
 * fixed window's worth is visible at once. The strip translates so the
 * active dot stays centered; sides fade via a CSS mask gradient so dots
 * appear to scroll past a frame.
 */
const TIMELINE_PITCH = 14; // px between dot centers
const TIMELINE_VIEWPORT = 112; // px wide — fits ~7 dots with fade on edges

function InlineTimeline({
  session,
}: {
  session: ReturnType<typeof useFileHistorySession>;
}) {
  const total = session.linearCommits.length;
  if (total === 0) return null;

  const cursorIdx = session.cursorIndex >= 0 ? session.cursorIndex : 0;
  // Translate the strip so the active dot lands in the centre of the frame.
  const offsetX = TIMELINE_VIEWPORT / 2 - cursorIdx * TIMELINE_PITCH;

  return (
    <div
      role="group"
      aria-label="File history timeline"
      className="relative h-6 shrink-0 self-center rounded-full bg-accent"
      style={{ width: TIMELINE_VIEWPORT }}
    >
      <div
        className="relative h-full overflow-hidden rounded-full"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
        }}
      >
        {/* Track — a static hairline that the dots ride along. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
        />

        {/* The strip — all dots positioned by index; translateX centres
            the active one in the frame. */}
        <div
          className="absolute inset-y-0 left-0 will-change-transform transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(${offsetX}px)` }}
        >
          {session.linearCommits.map((commit, i) => {
            const isActive = i === cursorIdx;
            const isMerge = commit.parents.length > 1;
            const label = `${commit.commit.message.split("\n")[0]} · ${formatRelativeTime(commit.commit.author.date)}`;
            return (
              <button
                key={commit.sha}
                type="button"
                onClick={() => session.jumpTo(commit.sha)}
                title={label}
                aria-label={`Jump to commit ${commit.sha.slice(0, 7)}: ${label}`}
                aria-current={isActive ? "step" : undefined}
                style={{ left: i * TIMELINE_PITCH }}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isActive
                    ? "size-2.5 bg-primary ring-2 ring-accent"
                    : isMerge
                      ? "size-1.5 bg-[var(--color-fg-faint)] ring-2 ring-accent hover:size-2 hover:bg-foreground"
                      : "size-1 bg-[var(--color-fg-faint)]/70 ring-2 ring-accent hover:size-1.5 hover:bg-foreground",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Commit context strip ─────────────────────────────────────────────────

function CommitContextStrip({
  session,
}: {
  session: ReturnType<typeof useFileHistorySession>;
}) {
  const commit = session.commitDetail;
  const summary =
    session.linearCommits[session.cursorIndex] ??
    session.allCommits.find((c) => c.sha === session.activeSha);
  // Prefer the summary (URL-correct, instant) over the commit detail
  // (which lags behind during placeholder transitions). Both carry the
  // same metadata fields for our purposes.
  const author = summary?.author ?? commit?.author;
  const gitAuthor = summary?.commit.author ?? commit?.commit.author;
  const message = (summary?.commit.message ?? commit?.commit.message ?? "").split("\n")[0];
  const dateIso = summary?.commit.author.date ?? commit?.commit.author.date;

  if (!summary && !commit) {
    return <div className="h-9 shrink-0 border-b border-border bg-background" />;
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-2.5 border-b border-border bg-background px-3">
      <Avatar
        size="md"
        login={author?.login ?? gitAuthor?.name ?? "?"}
        avatarUrl={author?.avatar_url}
      />

      <span className="shrink-0 text-ui font-medium text-foreground">
        {author?.login ?? gitAuthor?.name ?? "unknown"}
      </span>

      <span className="text-caption text-[var(--color-fg-faint)]">·</span>

      <span className="min-w-0 flex-1 truncate text-body text-foreground/85" title={message}>
        {message || <span className="text-muted-foreground italic">(no message)</span>}
      </span>

      {session.activeSha && (
        <ShaChip sha={session.activeSha} variant="inline" className="shrink-0" />
      )}

      {dateIso && (
        <time
          dateTime={dateIso}
          title={new Date(dateIso).toLocaleString()}
          className="shrink-0 font-mono text-caption tabular-nums text-muted-foreground"
        >
          {formatRelativeTime(dateIso)}
        </time>
      )}
    </div>
  );
}

// ─── Inline file meta row (replaces FileDiff's full header) ───────────────

function FileMetaRow({
  filename,
  previousFilename,
  status,
  additions,
  deletions,
}: {
  filename: string;
  previousFilename?: string;
  status: string;
  additions: number;
  deletions: number;
}) {
  const statusLabel =
    status === "added"
      ? "A"
      : status === "removed"
        ? "D"
        : status === "renamed"
          ? "R"
          : status === "copied"
            ? "C"
            : "M";
  const statusTone =
    status === "added"
      ? "text-[var(--diff-add-marker)]"
      : status === "removed"
        ? "text-[var(--diff-del-marker)]"
        : "text-[var(--color-fg-faint)]";

  return (
    <div className="flex h-8 shrink-0 items-center gap-2.5 border-b border-border bg-[var(--color-bg-sunken)] px-3">
      <span className={cn("shrink-0 font-mono text-xs font-bold", statusTone)} aria-label={status}>
        {statusLabel}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-code">
        {status === "renamed" && previousFilename && previousFilename !== filename && (
          <>
            <span className="truncate text-[var(--color-fg-faint)] line-through">
              {previousFilename}
            </span>
            <span className="shrink-0 text-[var(--color-fg-faint)]">→</span>
          </>
        )}
        <span className="truncate text-foreground">{filename}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
        <span className="text-[var(--diff-add-marker)]">+{additions}</span>
        <span className="text-[var(--diff-del-marker)]">−{deletions}</span>
      </div>
    </div>
  );
}

// ─── Rail (collapsible commit list) ───────────────────────────────────────

function CommitRail({ session }: { session: ReturnType<typeof useFileHistorySession> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const open = session.railOpen;

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current?.querySelector<HTMLAnchorElement>(
      '[data-active="true"]',
    );
    el?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [session.activeSha, open]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!session.hasMoreHistory || session.isFetchingMore) return;
    const t = e.currentTarget;
    if (t.scrollHeight - t.scrollTop - t.clientHeight < RAIL_PAGE_TRIGGER_MARGIN) {
      session.fetchMoreHistory();
    }
  }

  return (
    <aside
      // Always mounted — width transitions for a natural collapse. Inner
      // content has its own intrinsic width (`w-72`) that the outer mask
      // clips when collapsed. The cubic-bezier matches DESIGN.md's
      // 120ms-ish micro-interaction curve, scaled to 220ms here so the
      // rail eases in rather than snaps.
      data-state={open ? "open" : "closed"}
      aria-label="File commit history"
      aria-hidden={!open}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-background",
        "transition-[width,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open ? "w-72 border-r border-border" : "w-0 border-r border-transparent",
      )}
    >
      <div
        className={cn(
          "flex h-full w-72 shrink-0 flex-col",
          "transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "opacity-100 delay-75" : "pointer-events-none opacity-0",
        )}
      >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted px-3">
        <span className="text-caption font-medium uppercase tracking-widest text-muted-foreground">
          commits
        </span>
        <span className="ml-auto font-mono text-caption tabular-nums text-muted-foreground">
          {session.allCommits.length}
          {session.hasMoreHistory ? "+" : ""}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={onScroll}>
        {session.allCommits.length === 0 && session.isHistoryLoading ? (
          <div className="flex flex-col gap-px p-1">
            {Array.from({ length: 12 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are positionally stable.
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col">
            {session.allCommits.map((c) => (
              <RailRow
                key={c.sha}
                commit={c}
                isActive={c.sha === session.activeSha}
                onJump={session.jumpTo}
              />
            ))}
            {session.isFetchingMore && (
              <li className="flex h-10 items-center justify-center text-caption text-muted-foreground">
                loading more…
              </li>
            )}
          </ul>
        )}
      </div>
      </div>
    </aside>
  );
}

function RailRow({
  commit,
  isActive,
  onJump,
}: {
  commit: CommitSummary;
  isActive: boolean;
  onJump: (sha: string) => void;
}) {
  const isMerge = commit.parents.length > 1;
  const message = commit.commit.message.split("\n")[0];
  const dateIso = commit.commit.author.date;

  return (
    <li>
      <button
        type="button"
        data-active={isActive ? "true" : undefined}
        onClick={() => onJump(commit.sha)}
        className={cn(
          "group/row flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
          "border-l-2 border-transparent",
          "hover:bg-accent",
          isActive && "border-l-primary bg-accent",
        )}
      >
        <Avatar
          size="md"
          login={commit.author?.login ?? commit.commit.author.name}
          avatarUrl={commit.author?.avatar_url}
          className="mt-0.5 shrink-0"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-ui",
                isActive ? "text-foreground font-medium" : "text-foreground/90",
              )}
              title={message}
            >
              {message || "(no message)"}
            </span>
            {isMerge && (
              <GitMerge
                className="size-3 shrink-0 text-[var(--color-fg-faint)]"
                aria-label="merge commit"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-micro text-muted-foreground">
            <span className="tabular-nums">{commit.sha.slice(0, 7)}</span>
            <span aria-hidden>·</span>
            <time dateTime={dateIso} className="tabular-nums">
              {formatRelativeTime(dateIso)}
            </time>
          </div>
        </div>
      </button>
    </li>
  );
}

// ─── Empty + skeleton states ──────────────────────────────────────────────

function EmptyStep({
  kind,
  path,
}: {
  kind: "no-history" | "no-change" | "loading";
  path: string;
}) {
  if (kind === "loading") return <DiffSkeleton />;

  const title =
    kind === "no-history" ? "No history yet" : "No changes to this file in this commit";
  const description =
    kind === "no-history"
      ? "GitHub hasn't returned any commits that touched this path on this branch."
      : "This commit only touched sibling files, or the path was renamed earlier. Step to a commit that changed this file using the timeline or rail.";

  return (
    <section className="mx-auto mt-12 flex max-w-md flex-col items-center gap-2 rounded-lg bg-background px-6 py-12 text-center">
      <span className="font-mono text-caption uppercase tracking-widest text-muted-foreground">
        {path}
      </span>
      <h2 className="text-title font-medium text-foreground">{title}</h2>
      <p className="text-body text-muted-foreground">{description}</p>
    </section>
  );
}

const SKELETON_WIDTHS = [
  "72%",
  "44%",
  "88%",
  "56%",
  "78%",
  "36%",
  "82%",
  "60%",
  "40%",
  "70%",
] as const;

function DiffSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex h-8 items-center gap-2 border-b border-border bg-[var(--color-bg-sunken)] px-3">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="skeleton-fade flex flex-col gap-1.5 p-3">
        {SKELETON_WIDTHS.map((w) => (
          <Skeleton key={w} className="h-4" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

// ─── Keyboard ─────────────────────────────────────────────────────────────

function useFileHistoryKeys(
  session: ReturnType<typeof useFileHistorySession>,
  onToggleContext: () => void,
) {
  useEffect(() => {
    if (!session.open) return;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        session.next();
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        session.prev();
      } else if (e.key === "\\" || e.key === "[") {
        e.preventDefault();
        session.toggleRail();
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleContext();
      } else if (e.key.toLowerCase() === "o" && !e.metaKey && !e.ctrlKey) {
        if (session.activeSha && session.owner && session.repo) {
          e.preventDefault();
          const link = document.querySelector<HTMLAnchorElement>(
            `a[href*="/commit/${session.activeSha}"]`,
          );
          link?.click();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [session, onToggleContext]);
}
