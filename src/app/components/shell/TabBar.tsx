import {
  BookMarked,
  CircleDot,
  Code2,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  Home,
  type LucideIcon,
  Play,
  Settings,
  X,
} from "lucide-react";
import { useMemo } from "react";

import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";
import { useSettingsStore } from "@/app/stores/settings";
import { type Tab, useTabsStore } from "@/app/stores/tabs";

/**
 * Horizontal tab strip. Each tab represents an open route — code view,
 * issues list, PR detail, settings, etc. Replaces WorkspaceBar.
 *
 * Wired to useTabsStore: clicking a tab calls focusTab(), X calls closeTab().
 * TabSyncProvider handles the router navigation in response.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Settings,
  Code2,
  CircleDot,
  GitPullRequest,
  GitCommitHorizontal,
  Play,
  FileText,
  BookMarked,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? FileText;
}

export type TabBarProps = {
  inline?: boolean;
  className?: string;
};

export function TabBar({ inline = false, className }: TabBarProps) {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────
  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {};

    // t 1 through t 9 — focus tab N (9 = last)
    for (let n = 1; n <= 9; n++) {
      map[`t ${n}`] = () => {
        const { tabs: currentTabs } = useTabsStore.getState();
        const target = n === 9 ? currentTabs[currentTabs.length - 1] : currentTabs[n - 1];
        if (target) focusTab(target.id);
      };
    }

    // t w — close active tab
    map["t w"] = () => {
      const { activeTabId: id } = useTabsStore.getState();
      if (id) closeTab(id);
    };

    // t n / t p — next / previous tab
    map["t n"] = () => {
      const { tabs: t, activeTabId: id } = useTabsStore.getState();
      if (!id || t.length === 0) return;
      const idx = t.findIndex((tab) => tab.id === id);
      const next = t[(idx + 1) % t.length];
      if (next) focusTab(next.id);
    };
    map["t p"] = () => {
      const { tabs: t, activeTabId: id } = useTabsStore.getState();
      if (!id || t.length === 0) return;
      const idx = t.findIndex((tab) => tab.id === id);
      const prev = t[(idx - 1 + t.length) % t.length];
      if (prev) focusTab(prev.id);
    };

    return map;
  }, [focusTab, closeTab]);

  useKeybindings(shortcuts);

  if (!tabsEnabled || tabs.length === 0) return null;

  return (
    <div className={cn("flex items-center", !inline && "border-b border-border", className)}>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none",
          inline ? "px-1" : "px-3",
        )}
        role="tablist"
        aria-label="Open tabs"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => focusTab(tab.id)}
            onClose={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Single tab pill ─────────────────────────────────────────────────────────

function TabPill({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const Icon = resolveIcon(tab.icon);

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={active}
      onClick={onSelect}
      onAuxClick={(e) => {
        // Middle-click to close
        if (e.button === 1) {
          e.preventDefault();
          onClose(e);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      draggable
      onDragStart={() => {}} // Phase 2: drag between groups
      className={cn(
        "group relative flex shrink-0 cursor-pointer items-center",
        "h-8 select-none",
        "transition-colors duration-75",
        active
          ? "bg-(--color-bg-subtle) text-foreground"
          : "text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground",
      )}
      title={tab.sublabel ? `${tab.label} — ${tab.sublabel}` : tab.label}
    >
      {/* Active indicator — ember top border */}
      {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-(--color-accent)" />}

      {/* Icon + label */}
      <span className="flex items-center gap-1.5 pl-3 pr-1 font-mono text-caption leading-none">
        <Icon className="size-3.5 shrink-0" />
        <span className={cn("font-medium", active && "text-foreground")}>{tab.label}</span>
        {tab.sublabel && (
          <span
            className={cn(
              "text-micro",
              active ? "text-muted-foreground" : "text-fg-faint",
            )}
          >
            {tab.sublabel}
          </span>
        )}
      </span>

      {/* Close button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={onClose}
        aria-label={`Close ${tab.label}`}
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
