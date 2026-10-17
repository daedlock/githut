import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Checkbox } from "@/app/components/ui/checkbox";
import type { RepoLabel } from "@/app/features/pulls/pickers";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { type BulkNotice, type BulkUser, useBulkActions } from "@/app/features/repo/bulkActions";
import {
  type BulkAction,
  type BulkItem,
  type BulkKind,
  planJobs,
  toggleSelection,
} from "@/app/features/repo/bulkSelection";
import { BulkActionBar } from "@/app/features/repo/components/BulkActionBar";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";
import type { ShortcutMap } from "@/app/lib/shortcuts";
import { useTabScope } from "@/app/lib/tabScope";

// ─── Bulk selection ────────────────────────────────────────────────────────
//
// Linear-style multi-select for list pages. Rows opt in with `useBulkRow`
// and render `<BulkRowCheckbox>` in a reserved left gutter, so revealing the
// checkbox on hover never moves content. Selecting anything turns every row
// into a toggle and raises the floating action bar.
//
//   x / Shift-x   toggle the focused (or hovered) row / extend a range to it
//   Shift-click   extend a range from the last toggled row
//   ⌘A            select every visible row
//   Esc           clear

const ROW = "[data-bulk-row]";

export type BulkContextValue = {
  kind: BulkKind;
  selected: ReadonlySet<number>;
  selectedItems: BulkItem[];
  visibleCount: number;
  toggle: (row: HTMLElement, range: boolean) => void;
  selectAll: () => void;
  clear: () => void;
  apply: (action: BulkAction) => void;
  pending: boolean;
  notice: BulkNotice | null;
  retry: () => void;
  undo: () => void;
  dismiss: () => void;
  labels: readonly RepoLabel[];
  labelsLoading: boolean;
  users: readonly BulkUser[];
  usersLoading: boolean;
};

const BulkContext = createContext<BulkContextValue | null>(null);

export function useBulkContext() {
  const context = useContext(BulkContext);
  if (!context) throw new Error("useBulkContext must be used inside <BulkSelectionProvider>");
  return context;
}

export function BulkSelectionProvider({
  owner,
  repo,
  kind,
  items,
  visible,
  children,
}: {
  owner: string;
  repo: string;
  kind: BulkKind;
  /** Every loaded item, for reading current labels, assignees and status. */
  items: readonly BulkItem[];
  /** Numbers of the rows currently rendered, in display order. */
  visible: readonly number[];
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const [rawSelected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const labelsQuery = useRepoLabels(owner, repo);
  const usersQuery = useRepoCollaborators(owner, repo);
  const labels = labelsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const actions = useBulkActions({ owner, repo, kind }, { labels, users });

  // Rows that leave the view (filters, collapsed groups, closed while viewing
  // open items) leave the selection too: actions only reach what you can see.
  const visibleKey = visible.join(",");
  const selected = useMemo(() => {
    const shown = new Set(visibleKey ? visibleKey.split(",").map(Number) : []);
    const next = new Set([...rawSelected].filter((number) => shown.has(number)));
    return next.size === rawSelected.size ? rawSelected : next;
  }, [rawSelected, visibleKey]);
  useEffect(() => {
    if (selected !== rawSelected) setSelected(selected);
  }, [selected, rawSelected]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.number)),
    [items, selected],
  );

  const toggle = useCallback((row: HTMLElement, range: boolean) => {
    // A grouped item can render more than once; anchor to the row, not its number.
    const rows = Array.from(root.current?.querySelectorAll<HTMLElement>(ROW) ?? []);
    const order = rows.map((element) => Number(element.dataset.bulkRow));
    const index = rows.indexOf(row);
    const from = anchor.current ? rows.indexOf(anchor.current) : null;
    setSelected((previous) => toggleSelection(previous, order, index, from, range));
    anchor.current = row;
  }, []);
  const selectAll = useCallback(
    () => setSelected(new Set(visibleKey ? visibleKey.split(",").map(Number) : [])),
    [visibleKey],
  );
  const clear = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  const { run } = actions;
  const apply = useCallback(
    (action: BulkAction) => void run(planJobs(selectedItems, action)),
    [run, selectedItems],
  );

  const hasRows = visible.length > 0;
  useKeybindings(
    useMemo((): ShortcutMap => {
      if (!hasRows) return {};
      const current = () => {
        const focused = document.activeElement?.closest<HTMLElement>(ROW);
        if (focused && root.current?.contains(focused)) return focused;
        return root.current?.querySelector<HTMLElement>(`${ROW}:hover`) ?? null;
      };
      // Shift-x is listed first: a bare "x" binding also matches shifted presses.
      return {
        "shift+x": () => {
          const row = current();
          if (row) toggle(row, true);
        },
        x: () => {
          const row = current();
          if (row) toggle(row, false);
        },
        "⌘a": selectAll,
      };
    }, [hasRows, toggle, selectAll]),
  );

  const count = selected.size;
  const { isFocused } = useTabScope();
  useEffect(() => {
    if (!count) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !isFocused()) return;
      const target = event.target;
      // Escape belongs to whatever has focus first: inputs, menus, pickers.
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [data-radix-popper-content-wrapper]",
        )
      )
        return;
      clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, clear, isFocused]);

  const value: BulkContextValue = {
    kind,
    selected,
    selectedItems,
    visibleCount: visible.length,
    toggle,
    selectAll,
    clear,
    apply,
    pending: actions.pending,
    notice: actions.notice,
    retry: actions.retry,
    undo: actions.undo,
    dismiss: actions.dismiss,
    labels,
    labelsLoading: labelsQuery.isPending,
    users,
    usersLoading: usersQuery.isPending,
  };

  return (
    <BulkContext value={value}>
      <div ref={root}>
        {children}
        {/* Keep the last rows reachable above the floating bar. */}
        {count > 0 && <div aria-hidden className="h-16" />}
      </div>
      <BulkActionBar />
    </BulkContext>
  );
}

// ─── Rows ──────────────────────────────────────────────────────────────────

export type BulkRow = {
  selected: boolean;
  /** Surface classes for the row's outermost element. */
  className: string;
  /** Spread onto the row's outermost element. */
  rowProps: {
    "data-bulk-row": number;
    "data-selected"?: true;
    onClickCapture: (event: MouseEvent<HTMLElement>) => void;
    onMouseDown: (event: MouseEvent<HTMLElement>) => void;
  };
};

/** Selection wiring for one row; `null` outside a `<BulkSelectionProvider>`. */
export function useBulkRow(number: number): BulkRow | null {
  const context = useContext(BulkContext);
  if (!context) return null;
  const { selected, toggle } = context;
  const isSelected = selected.has(number);
  const active = selected.size > 0;
  return {
    selected: isSelected,
    className: cn(
      "group/bulk group relative rounded-lg transition-colors",
      isSelected
        ? // Adjacent selected rows read as one block: square the shared edges
          // and fill the gap between them with the same surface.
          "bg-accent [&:has(+[data-selected])]:rounded-b-none [&:has(+[data-selected])]:shadow-[0_4px_0_var(--color-accent)] [[data-selected]+&]:rounded-t-none"
        : "hover:bg-muted",
    ),
    rowProps: {
      "data-bulk-row": number,
      "data-selected": isSelected || undefined,
      onMouseDown: (event) => {
        // Shift-click extends the selection, not a text highlight. The checkbox
        // still takes focus, so the previous one doesn't keep a focus ring.
        const target = event.target as HTMLElement;
        if (event.shiftKey && !target.closest("[data-slot=checkbox]")) event.preventDefault();
      },
      onClickCapture: (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return;
        if (!event.shiftKey && !active) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-slot=checkbox]")) return;
        // Nested links (author, labels) keep working; the row link becomes a toggle.
        if (!target.closest("a[data-keyboard-list-item]") && target.closest("a, button")) return;
        event.preventDefault();
        event.stopPropagation();
        toggle(event.currentTarget, event.shiftKey);
      },
    },
  };
}

/** The row's checkbox, absolutely placed in the gutter rows reserve with `pl-10`. */
export function BulkRowCheckbox({ number, label }: { number: number; label: string }) {
  const { selected, toggle } = useBulkContext();
  const checked = selected.has(number);
  return (
    <div
      className={cn(
        "absolute top-3 left-3 z-20 flex transition-opacity duration-150 motion-reduce:transition-none",
        selected.size > 0
          ? "opacity-100"
          : "opacity-0 group-hover/bulk:opacity-100 group-focus-within/bulk:opacity-100 [@media(hover:none)]:opacity-100",
      )}
    >
      <Checkbox
        checked={checked}
        aria-label={label}
        onClick={(event) => {
          // Controlled: the provider owns the state so Shift can extend a range.
          event.preventDefault();
          const row = event.currentTarget.closest<HTMLElement>(ROW);
          if (row) toggle(row, event.shiftKey);
        }}
      />
    </div>
  );
}
