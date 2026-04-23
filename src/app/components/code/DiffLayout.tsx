import { Columns2, PanelLeftClose, PanelLeftOpen, Rows2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type ChangedFile, ChangedFileTree } from "@/app/components/repo/ChangedFileTree";
import { cn } from "@/app/lib/cn";
import type { DiffMode, DiffReviewHooks } from "./DiffView";
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
  getReviewHooks?: (filename: string) => DiffReviewHooks | undefined;
};

// ─── DiffLayout ────────────────────────────────────────────────────────────
//
// Virtualized file-level rendering via useWindowVirtualizer. All files
// appear expanded in the scrollbar, but only files near the viewport
// actually mount their FileDiff + DiffView + Shiki tokenization. Files
// that scroll out of the overscan window unmount entirely — their
// tokens are still cached in React Query so re-expanding is instant.
//
// Page-level scroll (not internal) — matches GitHub/GitLab/Reviewable.
// Sidebar is sticky below the top bar with its own inner scroll.

const TOPBAR_H = 44;
const ESTIMATED_FILE_H = 400;

export function DiffLayout({
  files,
  defaultMode = "unified",
  initialSidebarOpen = true,
  className,
  getReviewHooks,
}: DiffLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [mode, setMode] = useState<DiffMode>(defaultMode);
  const [activeFile, setActiveFile] = useState<string | undefined>(files[0]?.filename);

  const listRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const f of files) {
      add += f.additions;
      del += f.deletions;
    }
    return { add, del };
  }, [files]);

  // Window virtualizer: uses page scroll, not an internal container.
  // estimateSize gives a rough height; measureElement corrects it after
  // first paint so the scroll thumb reflects actual content.
  const virtualizer = useWindowVirtualizer({
    count: files.length,
    estimateSize: () => ESTIMATED_FILE_H,
    overscan: 3,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Scroll-spy: detect which file is near the top of the viewport.
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const topItem = virtualItems.find(
      (item) => {
        const top = item.start - virtualizer.scrollOffset!;
        return top > -100 && top < 300;
      },
    );
    if (topItem) {
      const f = files[topItem.index];
      if (f && f.filename !== activeFile) setActiveFile(f.filename);
    }
  }, [virtualItems, virtualizer.scrollOffset, files, activeFile]);

  const scrollToFile = useCallback(
    (filename: string) => {
      const idx = files.findIndex((f) => f.filename === filename);
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: "start" });
        setActiveFile(filename);
      }
    },
    [files, virtualizer],
  );

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
        const nextIdx =
          e.key === "j" ? Math.min(files.length - 1, idx + 1) : Math.max(0, idx - 1);
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
      {/* ─── Sticky top bar ───────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-muted px-4 sm:px-6"
        style={{ height: TOPBAR_H }}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className={cn(
            "inline-flex size-7 flex-shrink-0 items-center justify-center rounded-sm",
            "text-muted-foreground outline-none transition-colors",
            "hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]",
            "focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
          title={sidebarOpen ? "Hide file tree  [" : "Show file tree  ["}
          aria-label={sidebarOpen ? "Hide file tree" : "Show file tree"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="size-3.5" />
          ) : (
            <PanelLeftOpen className="size-3.5" />
          )}
        </button>

        <div className="flex items-baseline gap-2.5">
          <span className="text-ui font-medium text-foreground tabular-nums">
            {files.length}
          </span>
          <span className="text-caption text-muted-foreground">
            {files.length === 1 ? "file changed" : "files changed"}
          </span>
          <span className="text-caption text-[var(--color-fg-faint)]">·</span>
          <span className="font-mono text-caption tabular-nums text-[var(--diff-add-marker)]">
            +{totals.add}
          </span>
          <span className="font-mono text-caption tabular-nums text-[var(--diff-del-marker)]">
            −{totals.del}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center rounded-md border border-input bg-background p-0.5">
          <ModeBtn active={mode === "unified"} onClick={() => setMode("unified")} title="Unified view">
            <Rows2 className="size-3" />
            <span>Unified</span>
          </ModeBtn>
          <ModeBtn active={mode === "split"} onClick={() => setMode("split")} title="Split view">
            <Columns2 className="size-3" />
            <span>Split</span>
          </ModeBtn>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <KbdPill>j</KbdPill>
          <KbdPill>k</KbdPill>
          <span className="text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            navigate
          </span>
        </div>
      </div>

      {/* ─── Sidebar + virtualized main ────────────────────────────────── */}
      <div className="flex w-full items-start">
        {sidebarOpen && (
          <aside
            className="sticky z-10 hidden w-[280px] flex-shrink-0 overflow-y-auto border-r border-border p-2 lg:block"
            style={{ top: TOPBAR_H, maxHeight: `calc(100dvh - ${TOPBAR_H}px)` }}
          >
            <ChangedFileTree
              files={files}
              activeFile={activeFile}
              onFileClick={scrollToFile}
            />
          </aside>
        )}

        <div ref={listRef} className="min-w-0 flex-1 p-4">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualItems.map((item) => {
              const file = files[item.index]!;
              return (
                <VirtualFileItem
                  key={file.filename}
                  file={file}
                  mode={mode}
                  review={getReviewHooks?.(file.filename)}
                  measureElement={virtualizer.measureElement}
                  start={item.start - virtualizer.options.scrollMargin}
                  index={item.index}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Virtualized file item ─────────────────────────────────────────────────
//
// Memo'd so only the file whose data changed re-renders. The
// measureElement callback lets the virtualizer learn the actual height
// after Shiki tokenizes + the diff expands.

const VirtualFileItem = memo(function VirtualFileItem({
  file,
  mode,
  review,
  measureElement,
  start,
  index,
}: {
  file: DiffLayoutFile;
  mode: DiffMode;
  review: DiffReviewHooks | undefined;
  measureElement: (el: Element | null) => void;
  start: number;
  index: number;
}) {
  return (
    <div
      data-index={index}
      ref={measureElement}
      data-filename={file.filename}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${start}px)`,
      }}
      className="pb-3"
    >
      <FileDiff
        key={`${file.filename}:${mode}`}
        filename={file.filename}
        previousFilename={file.previousFilename}
        status={file.status}
        additions={file.additions}
        deletions={file.deletions}
        patch={file.patch}
        lang={file.lang}
        defaultMode={mode}
        review={review}
      />
    </div>
  );
});

// ─── Top-bar pieces ────────────────────────────────────────────────────────

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
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-caption",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        active
          ? "bg-[var(--color-bg-sunken)] text-[var(--color-fg)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function KbdPill({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-input bg-background px-1 font-mono text-micro text-muted-foreground">
      {children}
    </kbd>
  );
}
