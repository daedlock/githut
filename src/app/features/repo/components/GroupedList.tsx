import { CheckCircle2, ChevronRight, CircleDot, Flag, Tag, UserRound } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import type { ListGroup, ListGrouping, ListKind } from "@/app/features/repo/listGrouping";
import { cn } from "@/app/lib/cn";
import { useTabScope } from "@/app/lib/tabScope";

type GroupedListProps<T> = {
  groups: ListGroup<T>[];
  groupBy: ListGrouping;
  kind: ListKind;
  collapsedGroups: ReadonlySet<string>;
  onGroupsCollapsed: (keys: string[], collapsed: boolean) => void;
  renderItems: (items: T[]) => ReactNode;
};

export function GroupedList<T>({
  groups,
  groupBy,
  kind,
  collapsedGroups,
  onGroupsCollapsed,
  renderItems,
}: GroupedListProps<T>) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const { isFocused } = useTabScope();

  useEffect(() => {
    if (groupBy === "none") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !isFocused() ||
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        (event.key.toLowerCase() !== "t" && !(event.altKey && event.code === "KeyT"))
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input, textarea, select, [role='textbox'], [role='menu'], [role='dialog']",
          ))
      )
        return;
      const focused = document.activeElement;
      const focusedGroup =
        focused instanceof HTMLElement && root.current?.contains(focused)
          ? focused.closest<HTMLElement>("[data-list-group]")?.dataset.listGroup
          : undefined;
      const hoveredGroup =
        root.current?.querySelector<HTMLElement>("[data-list-group]:hover")?.dataset.listGroup;
      const key = hoveredGroup ?? focusedGroup;
      if (!key || !groups.some((group) => group.key === key)) return;
      event.preventDefault();
      // Keep focus available to keyboard navigation if its row is about to disappear.
      if (
        !collapsedGroups.has(key) &&
        (event.altKey || focusedGroup === key) &&
        focused instanceof HTMLElement &&
        root.current?.contains(focused)
      ) {
        focused.closest("[data-list-group]")?.querySelector<HTMLButtonElement>("button")?.focus();
      }
      onGroupsCollapsed(
        event.altKey ? groups.map((group) => group.key) : [key],
        !collapsedGroups.has(key),
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groupBy, groups, collapsedGroups, onGroupsCollapsed, isFocused]);

  if (groupBy === "none") {
    return (
      <div className="flex flex-col gap-1">{groups.map((group) => renderItems(group.items))}</div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      {groups.map((group) => {
        const expanded = !collapsedGroups.has(group.key);
        const contentId = `${id}-${encodeURIComponent(group.key)}`;
        return (
          <section
            key={group.key}
            data-list-group={group.key}
            aria-labelledby={`${contentId}-heading`}
          >
            <h2
              id={`${contentId}-heading`}
              className="sticky top-0 z-30 bg-background"
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={contentId}
                aria-keyshortcuts="T Alt+T ArrowLeft ArrowRight"
                data-keyboard-list-item
                title="Toggle group · T · Alt-click to toggle all groups"
                className={cn(
                  "flex min-h-10 w-full items-center gap-2 rounded-md bg-muted/60 px-3 text-left",
                  "text-ui font-medium text-foreground outline-none transition-colors",
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                )}
                onClick={(event) => {
                  // A double-click should toggle once, just like a click on the chevron.
                  if (event.detail > 1) return;
                  onGroupsCollapsed(
                    event.altKey ? groups.map((item) => item.key) : [group.key],
                    expanded,
                  );
                }}
                onKeyDown={(event) => {
                  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  onGroupsCollapsed([group.key], event.key === "ArrowLeft");
                }}
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                    expanded && "rotate-90",
                  )}
                />
                <span aria-hidden className="flex shrink-0">
                  <GroupIcon group={group} groupBy={groupBy} kind={kind} />
                </span>
                <span className="truncate">{group.label}</span>
                <span className="text-caption font-normal tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </button>
            </h2>
            <div id={contentId} hidden={!expanded}>
              {expanded && (
                <div className="flex flex-col gap-1 pt-1">{renderItems(group.items)}</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GroupIcon<T>({
  group,
  groupBy,
  kind,
}: {
  group: ListGroup<T>;
  groupBy: ListGrouping;
  kind: ListKind;
}) {
  if (group.status) {
    if (kind === "pulls") return <PrStateIcon state={group.status} />;
    const Icon = group.status === "open" ? CircleDot : CheckCircle2;
    return (
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          group.status === "open" ? "text-(--color-success)" : "text-muted-foreground",
        )}
      />
    );
  }
  if ((groupBy === "assignee" || groupBy === "author") && !group.missing) {
    return <Avatar login={group.label} avatarUrl={group.avatarUrl} size="xs" />;
  }
  if (groupBy === "label" && !group.missing) {
    return (
      <span
        aria-hidden
        className="mx-0.5 size-3 shrink-0 rounded-full"
        style={{
          backgroundColor: /^[0-9a-f]{6}$/i.test(group.color ?? "")
            ? `#${group.color}`
            : "var(--color-fg-muted)",
        }}
      />
    );
  }
  const Icon = groupBy === "label" ? Tag : groupBy === "milestone" ? Flag : UserRound;
  return <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />;
}
