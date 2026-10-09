import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleDot, Loader2, Tag, UserRound, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { issueKeys } from "@/app/features/issues/hooks";
import { pullsKeys } from "@/app/features/pulls/hooks";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { runBulkUpdate, toggleSelection } from "@/app/features/repo/bulkSelection";
import { cn } from "@/app/lib/cn";
import { getGitHubClient } from "@/app/lib/github/client";

type Item = { number: number; state: string; pull_request?: { merged_at?: string | null } | null };
type Action =
  | { type: "state"; value: "open" | "closed" }
  | { type: "label" | "assignee"; value: string; remove: boolean };
type Selection = {
  selected: ReadonlySet<number>;
  busy: boolean;
  toggle: (number: number, range: boolean, row: HTMLElement) => void;
};
const SelectionContext = createContext<Selection | null>(null);

export function BulkSelection({
  owner,
  repo,
  scope,
  kind,
  items,
  order,
  children,
}: {
  owner: string;
  repo: string;
  scope: string;
  kind: "issues" | "pulls";
  items: Item[];
  order: number[];
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const labels = useRepoLabels(owner, repo);
  const assignees = useRepoCollaborators(owner, repo);
  const [selected, setSelected] = useState(new Set<number>());
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const anchor = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<{ number: number; message: string }[]>([]);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
    setSelected(new Set());
    anchor.current = null;
    if (!locked.current) {
      setMessage("");
      setFailures([]);
    }
  }, [scope]);
  const orderKey = order.join(",");
  useEffect(() => {
    const visible = new Set(orderKey.split(",").map(Number));
    setSelected((previous) => {
      const next = new Set([...previous].filter((number) => visible.has(number)));
      return next.size === previous.size ? previous : next;
    });
  }, [orderKey]);
  const visible = new Set(order);
  const effective = new Set([...selected].filter((number) => visible.has(number)));
  const clear = () => {
    if (!locked.current) {
      setSelected(new Set());
      anchor.current = null;
    }
  };
  const toggleWithAnchor = (_number: number, range: boolean, row: HTMLElement) => {
    if (locked.current) return;
    // A grouped item can appear more than once. Anchor to its actual row, not its number.
    const rows = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-bulk-row]") ?? []);
    const rowOrder = rows.map((item) => Number(item.dataset.bulkRow));
    const index = rows.indexOf(row);
    const previousAnchor = anchor.current ? rows.indexOf(anchor.current) : null;
    setSelected((previous) => toggleSelection(previous, rowOrder, index, previousAnchor, range));
    anchor.current = row;
  };

  async function apply(action: Action, targets = [...effective]) {
    if (locked.current || !targets.length) return;
    locked.current = true;
    setBusy(true);
    setProgress(0);
    setMessage("");
    setFailures([]);
    setLastAction(action);
    try {
      const client = getGitHubClient();
      const failed = await runBulkUpdate(
        targets,
        async (number) => {
          const params = { owner, repo, issue_number: number };
          if (action.type === "state") {
            if (kind === "pulls")
              await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
                owner,
                repo,
                pull_number: number,
                state: action.value,
              });
            else
              await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
                ...params,
                state: action.value,
              });
          } else if (action.type === "label") {
            if (action.remove) {
              try {
                await client.request(
                  "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
                  { ...params, name: action.value },
                );
              } catch (error) {
                // GitHub reports an absent label as 404; other failures must remain retryable.
                if (
                  !(
                    error instanceof Error &&
                    "status" in error &&
                    error.status === 404 &&
                    /label does not exist/i.test(error.message)
                  )
                )
                  throw error;
              }
            } else
              await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
                ...params,
                labels: [action.value],
              });
          } else {
            const result = await client.request(
              action.remove
                ? "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees"
                : "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
              { ...params, assignees: [action.value] },
            );
            const assigned = result.data.assignees?.some(
              (user: { login: string }) => user.login.toLowerCase() === action.value.toLowerCase(),
            );
            if (assigned === !action.remove) return;
            throw new Error(
              "GitHub did not apply the assignee change. Check repository permissions.",
            );
          }
        },
        setProgress,
      );
      setFailures(failed);
      setSelected(new Set(scopeRef.current === scope ? failed.map((item) => item.number) : []));
      setMessage(
        `${targets.length - failed.length} of ${targets.length} updated${failed.length ? ` · ${failed.length} failed` : ""}`,
      );
      await Promise.allSettled([
        qc.invalidateQueries({ queryKey: issueKeys.all(owner, repo) }),
        qc.invalidateQueries({ queryKey: pullsKeys.lists(owner, repo) }),
        qc.invalidateQueries({ queryKey: pullsKeys.counts(owner, repo) }),
        ...targets.map((number) =>
          qc.invalidateQueries({ queryKey: issueKeys.detail(owner, repo, number) }),
        ),
        ...targets.map((number) =>
          qc.invalidateQueries({ queryKey: pullsKeys.detail(owner, repo, number) }),
        ),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the bulk update.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const chosen = items.filter((item) => effective.has(item.number));
  const canClose = chosen.length > 0 && chosen.every((item) => item.state === "open");
  const canReopen =
    chosen.length > 0 &&
    chosen.every((item) => item.state === "closed" && !item.pull_request?.merged_at);
  const allSelected = visible.size > 0 && effective.size === visible.size;
  return (
    <SelectionContext value={{ selected: effective, busy, toggle: toggleWithAnchor }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: handles events from list controls. */}
      <div
        ref={root}
        className={cn((effective.size > 0 || message) && "pb-28")}
        onKeyDown={(event) => {
          if (
            event.defaultPrevented ||
            (event.target instanceof HTMLElement &&
              event.target.closest(
                "input:not([type=checkbox]), textarea, select, [contenteditable=true], [role=dialog]",
              ))
          )
            return;
          if (event.key === "Escape" && effective.size) {
            event.preventDefault();
            clear();
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "a" &&
            effective.size &&
            !busy
          ) {
            event.preventDefault();
            setSelected(new Set(order));
          }
        }}
      >
        {children}
        {(effective.size > 0 || busy || message) && (
          <div className="fixed inset-x-3 bottom-5 z-40 mx-auto w-fit max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover/95 p-2 text-popover-foreground shadow-xl backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
            <fieldset
              className="flex flex-wrap items-center justify-center gap-1"
              aria-label="Bulk actions"
              aria-busy={busy}
            >
              {busy ? (
                <span className="flex items-center gap-2 px-3 text-ui" role="status">
                  <Loader2 className="size-4 animate-spin" />
                  Updating · {progress} completed
                </span>
              ) : effective.size > 0 ? (
                <>
                  <span
                    className="flex items-center gap-2 px-2 text-ui font-medium tabular-nums"
                    role="status"
                  >
                    <Check className="size-3.5" />
                    {effective.size} selected
                  </span>
                  {!allSelected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(new Set(order))}
                      title="Select all visible, loaded items · Ctrl/⌘ A"
                    >
                      Select all {visible.size}
                    </Button>
                  )}
                  <span className="mx-1 h-5 w-px bg-border" />
                  <ActionPicker
                    title="Status"
                    icon={<CircleDot className="size-3.5" />}
                    options={[
                      ...(canClose ? [{ value: "closed", label: "Close selected" }] : []),
                      ...(canReopen ? [{ value: "open", label: "Reopen selected" }] : []),
                    ]}
                    empty="Select only open or only unmerged closed items."
                    onSelect={(value) =>
                      void apply({ type: "state", value: value as "open" | "closed" })
                    }
                  />
                  <ActionPicker
                    title="Labels"
                    icon={<Tag className="size-3.5" />}
                    options={(labels.data ?? []).flatMap((label) => [
                      { value: `add:${label.name}`, label: `Add ${label.name}` },
                      { value: `remove:${label.name}`, label: `Remove ${label.name}` },
                    ])}
                    empty={
                      labels.isPending
                        ? "Loading labels…"
                        : labels.isError
                          ? "Could not load labels."
                          : "No labels found."
                    }
                    onSelect={(value) =>
                      void apply({
                        type: "label",
                        value: value.slice(value.indexOf(":") + 1),
                        remove: value.startsWith("remove:"),
                      })
                    }
                  />
                  <ActionPicker
                    title="Assignees"
                    icon={<UserRound className="size-3.5" />}
                    options={(assignees.data ?? []).flatMap((user) => [
                      { value: `add:${user.login}`, label: `Assign ${user.login}` },
                      { value: `remove:${user.login}`, label: `Unassign ${user.login}` },
                    ])}
                    empty={
                      assignees.isPending
                        ? "Loading assignees…"
                        : assignees.isError
                          ? "Could not load collaborators. Check repository access."
                          : "No assignees found."
                    }
                    onSelect={(value) =>
                      void apply({
                        type: "assignee",
                        value: value.slice(value.indexOf(":") + 1),
                        remove: value.startsWith("remove:"),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear selection"
                    title="Clear selection · Esc"
                    onClick={clear}
                  >
                    <X />
                  </Button>
                </>
              ) : null}
              {!busy && message && (
                <>
                  <span className="px-2 text-ui" role="status">
                    {message}
                  </span>
                  {failures.length > 0 && lastAction && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void apply(
                          lastAction,
                          failures.map((item) => item.number),
                        )
                      }
                    >
                      Retry failed
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Dismiss update result"
                    onClick={() => {
                      setMessage("");
                      setFailures([]);
                    }}
                  >
                    <X />
                  </Button>
                </>
              )}
            </fieldset>
            {failures.length > 0 && (
              <details className="max-w-lg px-3 pb-1 text-caption text-destructive">
                <summary className="cursor-pointer">View failed updates</summary>
                <ul className="max-h-32 overflow-auto">
                  {failures.map((item) => (
                    <li key={item.number}>
                      #{item.number}: {item.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {effective.size > 0 && !busy && !message && (
              <p className="px-3 pt-1 text-center text-micro text-muted-foreground">
                Shift-click for a range · Ctrl/⌘ A selects visible items · Esc clears
              </p>
            )}
          </div>
        )}
      </div>
    </SelectionContext>
  );
}

export function SelectableRow({ number, children }: { number: number; children: ReactNode }) {
  const selection = useContext(SelectionContext);
  if (!selection) return children;
  const checked = selection.selected.has(number);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegates events from native links and checkboxes.
    <div
      data-bulk-row={number}
      className={cn(
        "group/selection relative rounded-lg",
        checked && "bg-primary/10 ring-1 ring-inset ring-primary/20",
      )}
      onClickCapture={(event) => {
        if (
          selection.selected.size &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          event.target instanceof HTMLElement &&
          event.target.closest("a[data-keyboard-list-item]")
        ) {
          event.preventDefault();
          event.stopPropagation();
          selection.toggle(number, event.shiftKey, event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        if (
          event.key === " " &&
          event.target instanceof HTMLElement &&
          event.target.matches("a[data-keyboard-list-item]")
        ) {
          event.preventDefault();
          selection.toggle(number, event.shiftKey, event.currentTarget);
        }
      }}
    >
      <label
        className={cn(
          "absolute -left-5 top-2 z-30 flex size-6 cursor-pointer items-center justify-center rounded-md transition-opacity group-hover/selection:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
          selection.selected.size ? "opacity-100" : "opacity-0",
        )}
      >
        <input
          type="checkbox"
          aria-label={`Select #${number}`}
          checked={checked}
          disabled={selection.busy}
          onChange={() => {}}
          onClick={(event) => {
            const row = event.currentTarget.closest<HTMLElement>("[data-bulk-row]");
            if (row) selection.toggle(number, event.shiftKey, row);
          }}
          className="size-3.5 cursor-pointer rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-ring"
        />
      </label>
      {children}
    </div>
  );
}

function ActionPicker({
  title,
  icon,
  options,
  empty,
  onSelect,
}: {
  title: string;
  icon: ReactNode;
  options: { value: string; label: string }[];
  empty: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          {icon}
          {title}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-0">
        <Command>
          <CommandInput
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}…`}
          />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    setOpen(false);
                    onSelect(option.value);
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
