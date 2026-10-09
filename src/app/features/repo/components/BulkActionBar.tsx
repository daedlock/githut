import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Loader2,
  type LucideIcon,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ShortcutHint } from "@/app/components/ShortcutHint";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Separator } from "@/app/components/ui/separator";
import { TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { type PickerItem, SidebarPicker } from "@/app/features/pulls/components/SidebarPicker";
import type { BulkNotice } from "@/app/features/repo/bulkActions";
import {
  type BulkItem,
  type BulkStatus,
  type Coverage,
  coverage,
  sameLogin,
} from "@/app/features/repo/bulkSelection";
import { useBulkContext } from "@/app/features/repo/components/BulkSelection";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";

// ─── Floating bulk action bar ──────────────────────────────────────────────
//
//   [▣ 3 selected] │ ◌ Status  ⌗ Labels  ◯ Assignees │ ✕
//
// Pickers are the same SidebarPicker the detail pages use, with a dash for
// values only some of the selection has. Choosing a value applies it to the
// whole selection; choosing a fully-applied label or assignee removes it.
// Results surface in a notice above the bar, with undo or a targeted retry.

type PickerId = "status" | "labels" | "assignees";

const ISSUE_STATUSES: { value: BulkStatus; label: string; icon: ReactNode }[] = [
  { value: "open", label: "Open", icon: <CircleDot className="size-4 text-(--color-success)" /> },
  {
    value: "closed",
    label: "Closed",
    icon: <CheckCircle2 className="size-4 text-(--color-pr-merged)" />,
  },
  {
    value: "not_planned",
    label: "Closed as not planned",
    icon: <CircleSlash className="size-4 text-(--color-fg-faint)" />,
  },
];

const PULL_STATUSES: { value: BulkStatus; label: string; icon: ReactNode }[] = [
  { value: "open", label: "Open", icon: <PrStateIcon state="open" /> },
  { value: "closed", label: "Closed", icon: <PrStateIcon state="closed" /> },
];

// DESIGN.md micro-interaction curve.
const EASE = [0.16, 1, 0.3, 1] as const;

export function BulkActionBar() {
  const { selected, notice } = useBulkContext();
  const reduced = useReducedMotion();
  const hidden = { opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.98 };
  const presence = {
    layout: !reduced,
    initial: hidden,
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: hidden,
    transition: { duration: 0.16, ease: EASE },
    className: "max-w-full",
  };
  // Exiting children keep the props they last rendered with, so the bar and
  // notice animate out showing what they showed, not an emptied state.
  return (
    <TooltipProvider delayDuration={500}>
      <div
        data-bulk-bar={selected.size > 0 || notice ? "" : undefined}
        className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence mode="popLayout">
          {notice && (
            <motion.div key={`notice-${notice.id}`} {...presence}>
              <Notice notice={notice} />
            </motion.div>
          )}
          {selected.size > 0 && (
            <motion.div key="toolbar" {...presence}>
              <Toolbar count={selected.size} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

// design-lint-ignore: the bar and its notices are overlays, so they carry the overlay shadow.
const surface =
  "pointer-events-auto max-w-full rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10";

function Toolbar({ count }: { count: number }) {
  const { visibleCount, selectAll, clear, pending } = useBulkContext();
  const [picker, setPicker] = useState<PickerId | null>(null);
  useKeybindings(
    useMemo(
      () => ({
        s: () => setPicker("status"),
        l: () => setPicker("labels"),
        a: () => setPicker("assignees"),
      }),
      [],
    ),
  );
  const pickerProps = (id: PickerId) => ({
    open: picker === id,
    onOpenChange: (open: boolean) => setPicker(open ? id : null),
  });
  const all = count >= visibleCount;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(surface, "flex h-11 items-center p-1.5")}
    >
      <div className="flex h-8 items-center gap-2.5 pr-2 pl-2.5">
        {pending ? (
          // Same footprint as the checkbox, so the bar never shifts while saving.
          <span
            role="status"
            aria-label="Saving changes"
            className="flex size-4 items-center justify-center"
          >
            <Loader2 aria-hidden className="size-3.5 animate-spin text-muted-foreground" />
          </span>
        ) : (
          <Checkbox
            checked={all ? true : "indeterminate"}
            onCheckedChange={() => (all ? clear() : selectAll())}
            aria-label={all ? "Deselect all" : `Select all ${visibleCount}`}
          />
        )}
        <span className="whitespace-nowrap text-ui font-medium tabular-nums text-foreground">
          {count} selected
        </span>
      </div>
      <Separator orientation="vertical" className="mx-1 h-4 w-px" />
      <StatusPicker {...pickerProps("status")} />
      <LabelsPicker {...pickerProps("labels")} />
      <AssigneesPicker {...pickerProps("assignees")} />
      <Separator orientation="vertical" className="mx-1 h-4 w-px" />
      <ShortcutHint side="top" sideOffset={10} label="Clear selection" shortcut="Esc">
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={clear}>
          <X />
        </Button>
      </ShortcutHint>
    </div>
  );
}

// ─── Pickers ───────────────────────────────────────────────────────────────

type ControlledPicker = { open: boolean; onOpenChange: (open: boolean) => void };

function idsWith(values: readonly string[], cover: (value: string) => Coverage, want: Coverage) {
  return new Set(values.filter((value) => cover(value) === want));
}

function StatusPicker(props: ControlledPicker) {
  const { kind, selectedItems, apply } = useBulkContext();
  // Merged pull requests are final; status changes skip them.
  const eligible = selectedItems.filter((item) => !item.merged);
  const statuses = kind === "issues" ? ISSUE_STATUSES : PULL_STATUSES;
  const cover = (value: string) => coverage(eligible, (item) => item.status === value);
  const values = statuses.map((status) => status.value);
  return (
    <ActionPicker
      {...props}
      id="status"
      icon={CircleDashed}
      label="Status"
      hint="Change status"
      shortcut="S"
      disabled={eligible.length === 0}
      disabledHint="Merged pull requests can't change status"
      placeholder="Change status…"
      items={statuses.map((status) => ({
        id: status.value,
        label: status.label,
        icon: status.icon,
      }))}
      selectedIds={idsWith(values, cover, "all")}
      mixedIds={idsWith(values, cover, "some")}
      closeOnSelect
      onToggle={(value) => apply({ type: "status", value: value as BulkStatus })}
    />
  );
}

function LabelsPicker(props: ControlledPicker) {
  const { selectedItems, labels, labelsLoading, apply } = useBulkContext();
  const items = useMemo<PickerItem[]>(() => {
    const known = labels.map((label) => ({
      id: label.name,
      label: label.name,
      color: label.color,
    }));
    const extra = [...new Set(selectedItems.flatMap((item) => item.labels))]
      .filter((name) => !labels.some((label) => label.name === name))
      .map((name) => ({ id: name, label: name, color: "d4d4d8" }));
    return [...known, ...extra];
  }, [labels, selectedItems]);
  const cover = (name: string) => coverage(selectedItems, (item) => item.labels.includes(name));
  const values = items.map((item) => item.id);
  return (
    <ActionPicker
      {...props}
      id="labels"
      icon={Tag}
      label="Labels"
      hint="Add or remove labels"
      shortcut="L"
      placeholder="Add or remove labels…"
      emptyText="No labels"
      loading={labelsLoading}
      items={items}
      selectedIds={idsWith(values, cover, "all")}
      mixedIds={idsWith(values, cover, "some")}
      onToggle={(name) => apply({ type: "label", value: name, add: cover(name) !== "all" })}
    />
  );
}

function AssigneesPicker(props: ControlledPicker) {
  const { selectedItems, users, usersLoading, apply } = useBulkContext();
  const items = useMemo<PickerItem[]>(() => {
    const known = users.map((user) => ({
      id: user.login,
      label: user.login,
      avatarUrl: user.avatar_url,
    }));
    const extra = [...new Set(selectedItems.flatMap((item) => item.assignees))]
      .filter((login) => !users.some((user) => sameLogin(user.login, login)))
      .map((login) => ({ id: login, label: login }));
    return [...known, ...extra];
  }, [users, selectedItems]);
  const has = (item: BulkItem, login: string) =>
    item.assignees.some((assignee) => sameLogin(assignee, login));
  const cover = (login: string) => coverage(selectedItems, (item) => has(item, login));
  const values = items.map((item) => item.id);
  return (
    <ActionPicker
      {...props}
      id="assignees"
      icon={UserRound}
      label="Assignees"
      hint="Assign or unassign"
      shortcut="A"
      placeholder="Assign to…"
      emptyText="No collaborators"
      loading={usersLoading}
      items={items}
      selectedIds={idsWith(values, cover, "all")}
      mixedIds={idsWith(values, cover, "some")}
      onToggle={(login) => apply({ type: "assignee", value: login, add: cover(login) !== "all" })}
    />
  );
}

function ActionPicker({
  id,
  icon: Icon,
  label,
  hint,
  shortcut,
  disabled,
  disabledHint,
  open,
  onOpenChange,
  placeholder,
  emptyText,
  loading,
  items,
  selectedIds,
  mixedIds,
  closeOnSelect,
  onToggle,
}: ControlledPicker & {
  id: PickerId;
  icon: LucideIcon;
  label: string;
  hint: string;
  shortcut: string;
  disabled?: boolean;
  disabledHint?: string;
  placeholder: string;
  emptyText?: string;
  loading?: boolean;
  items: PickerItem[];
  selectedIds: ReadonlySet<string>;
  mixedIds: ReadonlySet<string>;
  closeOnSelect?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <ShortcutHint
      side="top"
      sideOffset={10}
      label={disabled && disabledHint ? disabledHint : hint}
      shortcut={disabled ? undefined : shortcut}
      suppressed={open}
    >
      <SidebarPicker
        title={label}
        ariaLabel={label}
        open={open && !disabled}
        onOpenChange={onOpenChange}
        side="top"
        align="center"
        placeholder={placeholder}
        emptyText={emptyText}
        loading={loading}
        items={items}
        selectedIds={selectedIds}
        mixedIds={mixedIds}
        closeOnSelect={closeOnSelect}
        onToggle={(value) => onToggle(value)}
        trigger={
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-bulk-action={id}
              aria-label={label}
              aria-keyshortcuts={shortcut}
              aria-disabled={disabled || undefined}
              className="aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-sm:w-8 max-sm:px-0"
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
            >
              <Icon data-icon="inline-start" aria-hidden />
              <span className="max-sm:sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
        }
      />
    </ShortcutHint>
  );
}

// ─── Result notice ─────────────────────────────────────────────────────────

function Notice({ notice }: { notice: BulkNotice }) {
  const { undo, retry, dismiss } = useBulkContext();
  const { tone } = notice;
  useEffect(() => {
    if (tone !== "success") return;
    const timer = setTimeout(dismiss, 6000);
    return () => clearTimeout(timer);
  }, [tone, dismiss]);
  const error = notice.tone === "error";
  const action = error ? retry : notice.undo ? undo : null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(surface, "flex h-10 items-center gap-2.5 pr-1.5 pl-3")}
    >
      {error ? (
        <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
      ) : (
        <CircleCheck aria-hidden className="size-4 shrink-0 text-(--color-success)" />
      )}
      <p className="min-w-0 truncate text-ui text-foreground">
        <span>{notice.message}</span>
        {error && notice.detail && (
          <span className="text-muted-foreground"> · {notice.detail}</span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-0.5">
        {action && (
          <Button variant="ghost" size="xs" className="text-foreground" onClick={action}>
            {error ? "Retry" : "Undo"}
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={dismiss}>
          <X />
        </Button>
      </div>
    </div>
  );
}
