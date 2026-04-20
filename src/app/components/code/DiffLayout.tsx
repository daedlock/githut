import { Columns2, PanelLeftClose, PanelLeftOpen, Rows2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChangedFile, ChangedFileTree } from "@/app/components/repo/ChangedFileTree";
import { cn } from "@/app/lib/cn";
import type { DiffMode } from "./DiffView";
import { FileDiff } from "./FileDiff";

/**
 * A file in the diff stack — ChangedFile (filename + status + stats) plus the
 * patch text and language hint the diff renderer needs. Kept as an extension
 * of ChangedFile so the same array can feed the sidebar tree and the main stack.
 */
export type DiffLayoutFile = ChangedFile & {
  patch: string | null | undefined;
  lang?: string;
  previousFilename?: string;
};

export type DiffLayoutProps = {
  files: DiffLayoutFile[];
  /** Initial layout mode — persists to each FileDiff's internal state. */
  defaultMode?: DiffMode;
  /** Start with the tree sidebar open. Default true; callers with 1-file
   * diffs (single-file commits) should pass false so the diff gets the full
   * viewport and isn't dwarfed by a sidebar pointing at one row. */
  initialSidebarOpen?: boolean;
  className?: string;
};

/**
 * World-class diff review layout:
 *   ┌─ sticky top bar (file count, +/-, global mode, sidebar toggle, hint) ─┐
 *   ├──────┬──────────────────────────────────────────────────────────────┤
 *   │ Tree │  Stack of FileDiff cards, anchored per file                  │
 *   │ stky │                                                              │
 *   └──────┴──────────────────────────────────────────────────────────────┘
 *
 * Design decisions:
 *  • PAGE-LEVEL SCROLL, not internal. The AppShell uses `min-h-full` so the
 *    page grows with content and scrolls naturally. If we created an internal
 *    scroll container here, nothing would bound its height and the sidebar
 *    wouldn't actually stick. Instead: top bar is `position: sticky; top: 0`,
 *    sidebar is `position: sticky; top: <topbar-h>` with its own max-height.
 *    This is the pattern GitHub/GitLab/Reviewable all use — resilient and
 *    works with any surrounding layout.
 *  • Scroll-spy rooted on `null` (viewport). rootMargin pushes the activation
 *    line ~25% down from the top of the viewport — where reading eyes rest —
 *    so the "active" file is the one you're actually looking at.
 *  • Click a tree row → smooth scroll with `scroll-mt` offset so the file's
 *    top sits just below the sticky top bar, not underneath it. j/k steps
 *    through files, `[` toggles the sidebar.
 *  • Global mode toggle in the top bar OVERRIDES per-file modes when flipped —
 *    a 30-file PR doesn't require 30 clicks to switch to split. We re-key the
 *    FileDiff children so they remount with the new default.
 */
const TOPBAR_H = 44; // px — sidebar sticky offset so it parks below the top bar
export function DiffLayout({
  files,
  defaultMode = "unified",
  initialSidebarOpen = true,
  className,
}: DiffLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [mode, setMode] = useState<DiffMode>(defaultMode);
  const [activeFile, setActiveFile] = useState<string | undefined>(files[0]?.filename);

  const fileRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Aggregate stats for the top bar
  const totals = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const f of files) {
      add += f.additions;
      del += f.deletions;
    }
    return { add, del };
  }, [files]);

  // Scroll-spy rooted on the viewport (null). rootMargin pushes the activation
  // line below the sticky top bar and ~25% down from there — where reading
  // eyes naturally rest — so the "active" file matches what the user is
  // actually looking at, not just the file technically most-visible.
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
        if (visible.length > 0 && visible[0]) {
          setActiveFile(visible[0].name);
        }
      },
      {
        root: null,
        rootMargin: `-${TOPBAR_H + 40}px 0px -55% 0px`,
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    for (const el of fileRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [files]);

  const scrollToFile = useCallback((filename: string) => {
    const el = fileRefs.current.get(filename);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveFile(filename);
  }, []);

  // Keyboard nav — j/k between files, [ to toggle sidebar.
  // Bound to window so the user doesn't need to focus the diff area first.
  // We skip when the user is typing in an input/textarea/contenteditable.
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
      {/* ─── Sticky top bar ─────────────────────────────────────────────────
       *    z-20 sits it above the sticky sidebar (z-10). */}
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
            "hover:bg-accent hover:text-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring/20",
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

        {/* Global mode toggle — re-keys all FileDiffs so each remounts with new default. */}
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

      {/* ─── Sidebar + main ────────────────────────────────────────────────
       *    Sticky sidebar parks below the top bar; long trees get inner scroll. */}
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-3 p-4">
            {files.map((file) => (
              <div
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: data attr used by scroll-spy
                key={file.filename}
                ref={(el) => {
                  if (el) fileRefs.current.set(file.filename, el);
                  else fileRefs.current.delete(file.filename);
                }}
                data-filename={file.filename}
                // scroll-mt = sticky top bar height + a bit of breathing room,
                // so smooth-scrolling to a file lands its top just below the bar
                style={{ scrollMarginTop: `${TOPBAR_H + 8}px` }}
              >
                <FileDiff
                  // Re-key on mode change so the FileDiff re-initializes to the
                  // new mode (its internal state otherwise overrides defaultMode).
                  key={`${file.filename}:${mode}`}
                  filename={file.filename}
                  previousFilename={file.previousFilename}
                  status={file.status}
                  additions={file.additions}
                  deletions={file.deletions}
                  patch={file.patch}
                  lang={file.lang}
                  defaultMode={mode}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
        "focus-visible:ring-1 focus-visible:ring-ring/20",
        active
          ? "bg-accent text-accent-foreground"
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
