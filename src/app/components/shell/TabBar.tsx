import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookMarked,
  CircleDot,
  Code2,
  Copy,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  Home,
  type LucideIcon,
  Pin,
  PinOff,
  Play,
  Settings,
  X,
} from "lucide-react";
import { useMemo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";
import { useSettingsStore } from "@/app/stores/settings";
import { type Tab, useTabsStore } from "@/app/stores/tabs";

/**
 * Horizontal tab strip with right-click context menu and drag-to-reorder.
 *
 *   - Click → focus
 *   - Middle-click or X → close
 *   - Right-click → context menu (close, close others, close to right, pin, copy link)
 *   - Drag → reorder (5px activation distance so clicks still work)
 *   - Keyboard: arrow keys + Space to reorder (a11y via @dnd-kit sensors)
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
  const moveTab = useTabsStore((s) => s.moveTab);

  // ─── DnD sensors ──────────────────────────────────────────────────────
  const sensors = useSensors(
    // 5px activation distance — a real click moves less, so tabs stay clickable.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = tabs.findIndex((t) => t.id === active.id);
    const to = tabs.findIndex((t) => t.id === over.id);
    if (from !== -1 && to !== -1) moveTab(from, to);
  };

  // ─── Keyboard shortcuts ────────────────────────────────────────────────
  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {};

    for (let n = 1; n <= 9; n++) {
      map[`t ${n}`] = () => {
        const { tabs: currentTabs } = useTabsStore.getState();
        const target = n === 9 ? currentTabs[currentTabs.length - 1] : currentTabs[n - 1];
        if (target) focusTab(target.id);
      };
    }

    map["t w"] = () => {
      const { activeTabId: id } = useTabsStore.getState();
      if (id) closeTab(id);
    };

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

  const tabIds = tabs.map((t) => t.id);

  return (
    <div className={cn("flex items-center", !inline && "border-b border-border", className)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none",
              inline ? "px-1" : "px-3",
            )}
            role="tablist"
            aria-label="Open tabs"
            style={{ scrollbarWidth: "none" }}
          >
            {tabs.map((tab, idx) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                index={idx}
                totalCount={tabs.length}
                active={tab.id === activeTabId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Sortable tab — pill wrapped in useSortable + context menu ──────────────

function SortableTab({
  tab,
  index,
  totalCount,
  active,
}: {
  tab: Tab;
  index: number;
  totalCount: number;
  active: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const focusTab = useTabsStore((s) => s.focusTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const closeOthers = useTabsStore((s) => s.closeOthers);
  const closeToRight = useTabsStore((s) => s.closeToRight);
  const togglePin = useTabsStore((s) => s.togglePin);

  const onSelect = () => focusTab(tab.id);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Raise the drag ghost above neighbors without letting other tabs slide on top
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={setNodeRef} style={style} className={cn(isDragging && "cursor-grabbing")}>
          <TabPill
            tab={tab}
            active={active}
            isDragging={isDragging}
            dragAttributes={attributes}
            dragListeners={listeners}
            onSelect={onSelect}
            onClose={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={onSelect}>
          Focus tab
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => togglePin(tab.id)}>
          {tab.pinned ? (
            <>
              <PinOff />
              Unpin
            </>
          ) : (
            <>
              <Pin />
              Pin tab
            </>
          )}
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(window.location.origin + tab.href);
          }}
        >
          <Copy />
          Copy link
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          variant="destructive"
          onSelect={() => closeTab(tab.id)}
          disabled={tab.pinned}
        >
          <X />
          Close
          <ContextMenuShortcut>t w</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          variant="destructive"
          onSelect={() => closeOthers(tab.id)}
          disabled={totalCount <= 1}
        >
          Close others
        </ContextMenuItem>

        <ContextMenuItem
          variant="destructive"
          onSelect={() => closeToRight(tab.id)}
          disabled={index >= totalCount - 1}
        >
          Close to the right
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Single tab pill ─────────────────────────────────────────────────────────

function TabPill({
  tab,
  active,
  isDragging,
  dragAttributes,
  dragListeners,
  onSelect,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  isDragging: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners: any;
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
      {...dragAttributes}
      {...dragListeners}
      className={cn(
        "group relative flex shrink-0 items-center",
        // Single-line guarantee. Content inside is whitespace-nowrap so it
        // never wraps regardless of parent width; h-8 locks vertical size.
        "h-8 select-none touch-none whitespace-nowrap overflow-hidden",
        // Generous cap — long owner/repo sublabels eat into this but the
        // label itself stays full-width (it has shrink-0 below).
        "max-w-[280px]",
        "transition-colors duration-75",
        isDragging
          ? "cursor-grabbing bg-(--color-bg-subtle) ring-1 ring-border-strong shadow-[0_4px_14px_-4px_rgba(0,0,0,0.18)]"
          : [
              "cursor-grab",
              // Active = elevated surface. Inactive = transparent, hover dims in.
              // Text color lives on label/sublabel directly so we get consistent
              // contrast regardless of state.
              active
                ? "bg-(--color-bg-subtle)"
                : "hover:bg-(--color-bg-sunken)",
            ],
      )}
      title={tab.sublabel ? `${tab.label} — ${tab.sublabel}` : tab.label}
    >
      {/* Active indicator — ember top border */}
      {active && !isDragging && (
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-(--color-accent)" />
      )}

      {/* Pin dot — small accent mark left of the icon when pinned */}
      {tab.pinned && (
        <span
          aria-hidden
          className="absolute left-1.5 top-1/2 size-1 -translate-y-1/2 rounded-full bg-(--color-accent)"
        />
      )}

      {/*
       * Content wrapper. Label is always `--color-fg`; sublabel is always
       * `--color-fg-muted`. Inactive state dims the whole content to ~70%
       * opacity so the hierarchy inside the pill (label > sublabel) is
       * preserved exactly the same in both states — only the whole tab
       * reads as "quieter" when inactive. Hover restores full opacity.
       */}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 pr-1 font-mono text-caption leading-none",
          "transition-opacity",
          !active && "opacity-70 group-hover:opacity-100",
          tab.pinned ? "pl-4" : "pl-3",
        )}
      >
        <Icon className="size-3.5 shrink-0 text-(--color-fg-muted)" />
        <span className="shrink-0 font-medium text-(--color-fg)">{tab.label}</span>
        {tab.sublabel && (
          <span className="min-w-0 truncate text-micro text-(--color-fg-muted)">
            {tab.sublabel}
          </span>
        )}
      </span>

      {/* Close button — skips pinned tabs */}
      {!tab.pinned && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Close ${tab.label}`}
          className={cn(
            "mr-1.5 flex size-4 shrink-0 items-center justify-center rounded-sm",
            "text-(--color-fg-muted) outline-none transition-colors",
            "opacity-0 group-hover:opacity-100",
            active && "opacity-60",
            "hover:opacity-100! hover:bg-(--color-bg-sunken) hover:text-(--color-fg)",
          )}
        >
          <X className="size-3" strokeWidth={2} />
        </button>
      )}

      {/* Right separator */}
      <span
        aria-hidden
        className={cn(
          "absolute right-0 top-1.5 bottom-1.5 w-px bg-border",
          (active || isDragging) && "hidden",
          "group-[:has(+[aria-selected=true])]:hidden",
        )}
      />
    </div>
  );
}
