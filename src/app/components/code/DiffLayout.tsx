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
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, []);

  const totals = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const f of files) {
      add += f.additions;
      del += f.deletions;
    }
    return { add, del };
  }, [files]);

  const virtualizer = useWindowVirtualizer({
    count: files.length,
    estimateSize: () => ESTIMATED_FILE_H,
    overscan: 2,
    scrollMargin,
  });

  // Throttled scroll-spy — RAF-gated so it fires at most once per frame.
  const activeFileRef = useRef(activeFile);
  activeFileRef.current = activeFile;
  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const items = virtualizer.getVirtualItems();
        const offset = virtualizer.scrollOffset ?? 0;
        for (const item of items) {
          const top = item.start - offset;
          if (top > -100 && top < 300) {
            const f = files[item.index];
            if (f && f.filename !== activeFileRef.current) {
              setActiveFile(f.filename);
            }
            break;
          }
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [files, virtualizer]);

  const scrollToFile = useCallback(
    (filename: string) => {
      const idx = files.findIndex((f) => f.filename === filename);
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: "start", behavior: "auto" });
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
        const idx = files.findIndex((f) => f.filename === activeFileRef.current);
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
  }, [files, scrollToFile]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn("w-full bg-background", className)}>
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
          {sidebarOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
        </button>

        <div className="flex items-baseline gap-2.5">
          <span className="text-ui font-medium text-foreground tabular-nums">{files.length}</span>
          <span className="text-caption text-muted-foreground">
            {files.length === 1 ? "file changed" : "files changed"}
          </span>
          <span className="text-caption text-[var(--color-fg-faint)]">·</span>
          <span className="font-mono text-caption tabular-nums text-[var(--diff-add-marker)]">+{totals.add}</span>
          <span className="font-mono text-caption tabular-nums text-[var(--diff-del-marker)]">−{totals.del}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center rounded-md border border-input bg-background p-0.5">
          <ModeBtn active={mode === "unified"} onClick={() => setMode("unified")} title="Unified view">
            <Rows2 className="size-3" /><span>Unified</span>
          </ModeBtn>
          <ModeBtn active={mode === "split"} onClick={() => setMode("split")} title="Split view">
            <Columns2 className="size-3" /><span>Split</span>
          </ModeBtn>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <KbdPill>j</KbdPill><KbdPill>k</KbdPill>
          <span className="text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">navigate</span>
        </div>
      </div>

      <div className="flex w-full items-start">
        {sidebarOpen && (
          <aside
            className="sticky z-10 hidden w-[280px] flex-shrink-0 overflow-y-auto border-r border-border p-2 lg:block"
            style={{ top: TOPBAR_H, maxHeight: `calc(100dvh - ${TOPBAR_H}px)` }}
          >
            <ChangedFileTree files={files} activeFile={activeFile} onFileClick={scrollToFile} />
          </aside>
        )}

        <div ref={listRef} className="min-w-0 flex-1 p-4">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualItems.map((item) => {
              const file = files[item.index]!;
              return (
                <div
                  key={file.filename}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start - scrollMargin}px)`,
                  }}
                  className="pb-3"
                >
                  <FileItem
                    file={file}
                    mode={mode}
                    review={getReviewHooks?.(file.filename)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memo'd content — the outer positioning div changes transform on
// scroll but this inner component only re-renders when file data,
// mode, or review hooks actually change.
const FileItem = memo(function FileItem({
  file,
  mode,
  review,
}: {
  file: DiffLayoutFile;
  mode: DiffMode;
  review: DiffReviewHooks | undefined;
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
      defaultMode={mode}
      review={review}
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
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-caption",
        "outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        active ? "bg-[var(--color-bg-sunken)] text-[var(--color-fg)]" : "text-muted-foreground hover:text-foreground",
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
