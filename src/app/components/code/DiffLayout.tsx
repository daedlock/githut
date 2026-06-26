import { Columns2, PanelLeftClose, PanelLeftOpen, Rows2 } from "lucide-react";
import { Fragment, memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChangedFile, ChangedFileTree } from "@/app/components/repo/ChangedFileTree";
import { cn } from "@/app/lib/cn";
import { useSettingsStore } from "@/app/stores/settings";
import { ChangeStatsBadge } from "./ChangeStatsBadge";
import { type DiffMode, DiffModeContext, type DiffReviewHooks } from "./DiffView";
import { FileDiff } from "./FileDiff";

export type DiffLayoutFile = ChangedFile & {
  patch: string | null | undefined;
  lang?: string;
  previousFilename?: string;
};

export type DiffLayoutProps = {
  files: DiffLayoutFile[];
  defaultMode?: DiffMode;
  initialSidebarOpen?: boolean;
  className?: string;
  owner?: string;
  repo?: string;
  headRef?: string;
  baseRef?: string;
  getReviewHooks?: (filename: string) => DiffReviewHooks | undefined;
  /** Left portion of review context (back + title). Replaces sidebar toggle + file stats. */
  reviewBar?: ReactNode;
  /** Extra toolbar content placed immediately before the unified/split toggle. */
  beforeModeSlot?: ReactNode;
  /** Right portion — review actions (submit, cancel). Placed after the mode toggle. */
  reviewActions?: ReactNode;
};

// ─── DiffLayout ────────────────────────────────────────────────────────────
//
// Uses CSS `content-visibility: auto` instead of JS virtualization. Every
// file card is in the DOM but the browser skips layout + paint for
// off-screen ones. This gives:
//   • Zero empty space on fast scroll (no mount/unmount cycle)
//   • Instant scroll-to-file (element already exists in DOM)
//   • Native scrollbar accuracy (real heights, not estimates)
//   • No React reconciliation overhead on scroll
//
// `contain-intrinsic-block-size` gives the browser a height estimate for
// off-screen files so the scrollbar is roughly correct before paint.
// Once painted, the browser remembers the actual size.

const NAV_H = 40;
const TOPBAR_H = 44;
const STICKY_TOP = NAV_H + TOPBAR_H; // 84px — below both nav + diff bar

export function DiffLayout({
  files,
  defaultMode = "split",
  initialSidebarOpen = true,
  className,
  owner,
  repo,
  headRef,
  baseRef,
  getReviewHooks,
  reviewBar,
  beforeModeSlot,
  reviewActions,
}: DiffLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const mode = useSettingsStore((s) => s.diffMode);
  const setMode = useSettingsStore((s) => s.setDiffMode);
  const [activeFile, setActiveFile] = useState<string | undefined>(files[0]?.filename);

  const fileRefs = useRef<Map<string, HTMLElement>>(new Map());

  const totals = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const f of files) {
      add += f.additions;
      del += f.deletions;
    }
    return { add, del };
  }, [files]);

  // Scroll-spy via IntersectionObserver — no JS per scroll tick.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            name: (e.target as HTMLElement).dataset.filename ?? "",
            top: e.boundingClientRect.top,
          }))
          .sort((a, b) => a.top - b.top);
        if (visible[0]) setActiveFile(visible[0].name);
      },
      { root: null, rootMargin: `-${TOPBAR_H + 40}px 0px -55% 0px`, threshold: [0, 0.25] },
    );
    for (const el of fileRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [files]);

  const scrollToFile = useCallback((filename: string) => {
    const el = fileRefs.current.get(filename);
    if (!el) return;
    el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    setActiveFile(filename);
  }, []);

  useEffect(() => {
    function isEditable(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const idx = files.findIndex((f) => f.filename === activeFile);
        const nextIdx = e.key === "j" ? Math.min(files.length - 1, idx + 1) : Math.max(0, idx - 1);
        const next = files[nextIdx];
        if (next) scrollToFile(next.filename);
      } else if (e.key === "[") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [files, activeFile, scrollToFile]);

  return (
    <div className={cn("w-full bg-background", className)}>
      <div
        className="sticky top-10 z-30 flex items-center gap-3 border-b border-border bg-background px-3 sm:px-4"
        style={{ height: TOPBAR_H }}
      >
        {/* Left: review bar or sidebar toggle + file stats */}
        {reviewBar ?? (
          <>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex size-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15"
              title={sidebarOpen ? "Hide file tree" : "Show file tree"}
              aria-label={sidebarOpen ? "Hide file tree" : "Show file tree"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-3.5" />
              ) : (
                <PanelLeftOpen className="size-3.5" />
              )}
            </button>
            <div className="flex items-center gap-2 text-caption">
              <span className="flex items-baseline gap-1.5">
                <span className="tabular-nums font-medium text-foreground">{files.length}</span>
                <span className="text-muted-foreground">files</span>
              </span>
              <ChangeStatsBadge additions={totals.add} deletions={totals.del} />
            </div>
          </>
        )}

        <div className="flex-1" />

        {beforeModeSlot}

        <div className="flex items-center rounded-lg bg-muted p-0.5">
          <ModeBtn
            active={mode === "unified"}
            onClick={() => setMode("unified")}
            title="Unified view"
          >
            <Rows2 className="size-3" />
            <span>Unified</span>
          </ModeBtn>
          <ModeBtn active={mode === "split"} onClick={() => setMode("split")} title="Split view">
            <Columns2 className="size-3" />
            <span>Split</span>
          </ModeBtn>
        </div>

        {reviewActions}
      </div>

      <div
        className="pointer-events-none sticky top-[84px] z-[4] -mb-5 h-5 bg-background"
        aria-hidden
      />

      <div className="flex min-h-[calc(100dvh-44px)] w-full">
        {sidebarOpen && (
          <aside
            className="sticky z-10 hidden w-[320px] flex-shrink-0 self-stretch overflow-y-auto lg:block"
            style={{ top: STICKY_TOP, maxHeight: `calc(100dvh - ${STICKY_TOP}px)` }}
          >
            <ChangedFileTree files={files} activeFile={activeFile} onFileClick={scrollToFile} />
          </aside>
        )}

        <DiffModeContext value={mode}>
          <div className="min-w-0 flex-1 p-4">
            <div className="flex flex-col">
              {files.map((file, index) => (
                <Fragment key={file.filename}>
                  {index > 0 && <div className="h-5 shrink-0 bg-background" aria-hidden />}
                  <div
                    ref={(el) => {
                      if (el) fileRefs.current.set(file.filename, el);
                      else fileRefs.current.delete(file.filename);
                    }}
                    data-filename={file.filename}
                    style={{
                      contentVisibility: "auto",
                      containIntrinsicBlockSize: "auto 40px",
                      scrollMarginTop: TOPBAR_H,
                    }}
                  >
                    <FileItem
                      file={file}
                      review={getReviewHooks?.(file.filename)}
                      owner={owner}
                      repo={repo}
                      headRef={headRef}
                      baseRef={baseRef}
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </DiffModeContext>
      </div>
    </div>
  );
}

const FileItem = memo(function FileItem({
  file,
  review,
  owner,
  repo,
  headRef,
  baseRef,
}: {
  file: DiffLayoutFile;
  review: DiffReviewHooks | undefined;
  owner: string | undefined;
  repo: string | undefined;
  headRef: string | undefined;
  baseRef: string | undefined;
}) {
  return (
    <FileDiff
      filename={file.filename}
      previousFilename={file.previousFilename}
      status={file.status}
      additions={file.additions}
      deletions={file.deletions}
      patch={file.patch}
      lang={file.lang}
      review={review}
      owner={owner}
      repo={repo}
      headRef={headRef}
      baseRef={baseRef}
    />
  );
});

function ModeBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
