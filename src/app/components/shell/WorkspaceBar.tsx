import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";

import { cn } from "@/app/lib/cn";
import { useWorkspacesStore, type WorkspaceEntry } from "@/app/stores/workspaces";

/**
 * Horizontal repo-tab strip below the top bar. Each tab shows `owner/repo`,
 * navigates to the last visited path inside that repo, and can be closed.
 *
 * Closing the *active* tab navigates to the next sibling (or previous, or `/`
 * when it was the last one). Switching tabs saves scroll position of the
 * outgoing workspace and navigates to the stored href of the incoming one.
 */
export type WorkspaceBarProps = {
  bottomBorder?: boolean;
};

export function WorkspaceBar({ bottomBorder = false }: WorkspaceBarProps) {
  const entries = useWorkspacesStore((s) => s.entries);
  const remove = useWorkspacesStore((s) => s.remove);
  const saveScroll = useWorkspacesStore((s) => s.saveScroll);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (entries.length === 0) return null;

  const activeKey = getActiveKey(pathname);

  /** Save current workspace scroll, then navigate to a target href. */
  function switchTo(href: string) {
    if (activeKey) saveScroll(activeKey, window.scrollY);
    navigate({ to: normalizeWorkspaceHref(href) });
  }

  function handleClose(e: React.MouseEvent, entry: WorkspaceEntry) {
    e.stopPropagation();

    if (entry.key === activeKey) {
      const idx = entries.findIndex((t) => t.key === entry.key);
      if (idx < 0) {
        remove(entry.key);
        return;
      }
      const next = entries[idx + 1] ?? entries[idx - 1];
      switchTo(next ? next.href : "/");
    }

    remove(entry.key);
  }

  return (
    <div className={cn("flex items-center border-t border-border", bottomBorder && "border-b")}>
      <div
        className="flex min-w-0 flex-1 items-center overflow-x-auto px-3 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {entries.map((entry) => (
          <WorkspaceTab
            key={entry.key}
            entry={entry}
            active={entry.key === activeKey}
            onSelect={() => switchTo(entry.href)}
            onClose={(e) => handleClose(e, entry)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Single tab ─────────────────────────────────────────────────────────────

function WorkspaceTab({
  entry,
  active,
  onSelect,
  onClose,
}: {
  entry: WorkspaceEntry;
  active: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={active}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex shrink-0 cursor-pointer items-center",
        "h-8 select-none",
        "transition-colors duration-75",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      title={entry.key}
    >
      {/* Active indicator — thin top line */}
      {active && <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-foreground/40" />}

      {/* Label */}
      <span className="flex items-baseline gap-0.5 px-3 font-mono text-caption leading-none">
        <span className={cn(active ? "text-muted-foreground" : "text-fg-faint")}>
          {entry.owner}/
        </span>
        <span className={cn("font-medium", active && "text-foreground")}>{entry.repo}</span>
      </span>

      {/* Close */}
      <button
        type="button"
        tabIndex={-1}
        onClick={onClose}
        aria-label={`Close ${entry.key}`}
        className={cn(
          "mr-1.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm",
          "text-fg-faint outline-none transition-colors",
          "opacity-0 group-hover:opacity-100",
          active && "opacity-60",
          "hover:opacity-100! hover:bg-(--color-bg-sunken) hover:text-foreground",
        )}
      >
        <X className="size-3" strokeWidth={2} />
      </button>

      {/* Right separator between tabs */}
      <span
        aria-hidden
        className={cn(
          "absolute right-0 top-1.5 bottom-1.5 w-px bg-border",
          active && "hidden",
          "group-[:has(+[aria-selected=true])]:hidden",
        )}
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getActiveKey(pathname: string): string | null {
  const m = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const [, owner, repo] = m;
  if (!owner || !repo) return null;
  if (["login", "settings", "playground", "w"].includes(owner)) return null;
  return `${owner}/${repo}`;
}

function normalizeWorkspaceHref(href: string): string {
  if (!href) return "/";
  if (href.startsWith("/")) return href;

  try {
    const parsed = new URL(href, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}
