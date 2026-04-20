import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { CheckCircle2, CircleDot, Eye, GitPullRequest, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { type MentionItem, useMentionSearch } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";

// ─── Trigger detection ───────────────────────────────────────────────────────

type Trigger = {
  type: "@" | "#";
  query: string;
  startIndex: number;
};

function detectTrigger(text: string, cursorPos: number): Trigger | null {
  let i = cursorPos - 1;
  while (i >= 0 && !/[\s\n]/.test(text[i] ?? "")) i--;
  const wordStart = i + 1;
  const word = text.slice(wordStart, cursorPos);
  if (word.startsWith("@")) return { type: "@", query: word.slice(1), startIndex: wordStart };
  if (word.startsWith("#")) return { type: "#", query: word.slice(1), startIndex: wordStart };
  return null;
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({
  anchor,
  items,
  isPending,
  selectedIdx,
  onSelect,
}: {
  anchor: HTMLTextAreaElement | null;
  items: MentionItem[];
  isPending: boolean;
  selectedIdx: number;
  onSelect: (item: MentionItem) => void;
}) {
  const { refs, floatingStyles, placement } = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      // Flip to top-start when bottom is clipped. We keep the fallback set small
      // and aligned to the same horizontal anchor so the dropdown feels stable.
      flip({ fallbackPlacements: ["top-start"], padding: 8 }),
      shift({ padding: 8, crossAxis: true }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(260, Math.min(rects.reference.width, 440))}px`,
            maxHeight: `${Math.min(availableHeight, 300)}px`,
          });
        },
      }),
    ],
  });

  useEffect(() => {
    refs.setReference(anchor);
  }, [anchor, refs]);

  const showSkeleton = isPending && items.length === 0;
  const showEmpty = !isPending && items.length === 0;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 9999 }}
        data-placement={placement}
        className={cn(
          "popover-enter",
          "overflow-hidden rounded-[var(--radius-md)]",
          "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
          // Crisp 2-layer shadow — a tight ring + a softer drop.
          // Avoids the generic shadow-xl look; feels more deliberate.
          "shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.18)]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            {items[0]?.kind === "@" || (showSkeleton && selectedIdx === 0)
              ? "Mention a user"
              : "Reference an issue or PR"}
          </span>
          {isPending && items.length > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
                searching
              </span>
            </span>
          )}
        </div>

        <div className="max-h-[260px] overflow-auto">
          {showSkeleton ? (
            <div className="flex flex-col py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3.5 flex-1 max-w-[60%]" />
                </div>
              ))}
            </div>
          ) : showEmpty ? (
            <div className="px-3 py-3 font-mono text-xs text-[var(--color-fg-faint)]">
              No matches
            </div>
          ) : (
            items.map((item, i) => (
              <Row
                key={item.id}
                item={item}
                selected={i === selectedIdx}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
    </FloatingPortal>
  );
}

function Row({
  item,
  selected,
  onSelect,
}: {
  item: MentionItem;
  selected: boolean;
  onSelect: (item: MentionItem) => void;
}) {
  return (
    <button
      type="button"
      // mousedown fires before blur, so we can intercept before focus leaves textarea
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      className={cn(
        "group relative flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
        "transition-[background-color,transform] duration-75",
        selected
          ? "bg-[var(--color-bg-sunken)]"
          : "hover:bg-[var(--color-bg-subtle)] active:translate-x-px",
      )}
    >
      {/* Selected indicator — sharp accent bar on the left edge */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-0 w-[2px] rounded-full transition-opacity duration-75",
          selected ? "bg-[var(--color-accent)] opacity-100" : "opacity-0",
        )}
      />

      {item.kind === "@" ? (
        <>
          <img
            src={item.avatar}
            alt=""
            className="h-5 w-5 flex-shrink-0 rounded-full border border-[var(--color-border)]"
          />
          <span className="truncate font-medium text-[var(--color-fg)]">{item.login}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            member
          </span>
        </>
      ) : (
        <>
          {item.isPR ? (
            <GitPullRequest
              className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                item.state === "open"
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-fg-faint)]",
              )}
            />
          ) : item.state === "open" ? (
            <CircleDot className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-success)]" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-fg-faint)]" />
          )}
          <span className="font-mono text-xs text-[var(--color-fg-faint)] tabular-nums">
            #{item.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">{item.title}</span>
          {item.isPR && (
            <span className="ml-auto shrink-0 rounded border border-[var(--color-border)] px-1 py-px font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-faint)]">
              PR
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─── CommentBox ───────────────────────────────────────────────────────────────

export interface CommentBoxProps {
  owner: string;
  repo: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function CommentBox({
  owner,
  repo,
  value,
  onChange,
  placeholder = "Leave a comment",
  rows = 5,
  disabled,
  autoFocus,
  className,
}: CommentBoxProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounce the search query — 180ms of quiet before hitting GraphQL.
  // Keeps typing snappy (no fetch per keystroke) while still feeling live.
  const debouncedQuery = useDebouncedValue(trigger?.query ?? "", 180);

  const { data: items, isFetching } = useMentionSearch(
    owner,
    repo,
    trigger?.type ?? null,
    debouncedQuery,
  );

  const dropdownItems = items ?? [];

  useEffect(() => setSelectedIdx(0), [dropdownItems]);

  const insertCompletion = useCallback(
    (item: MentionItem) => {
      if (!textareaRef.current || !trigger) return;
      const cursorPos = textareaRef.current.selectionStart ?? value.length;
      const before = value.slice(0, trigger.startIndex);
      const after = value.slice(cursorPos);
      const insertion = item.kind === "@" ? `@${item.login} ` : `#${item.number} `;
      const next = before + insertion + after;
      onChange(next);
      setTrigger(null);
      const newCursor = before.length + insertion.length;
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursor, newCursor);
      });
    },
    [trigger, value, onChange],
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const pos = e.target.selectionStart ?? next.length;
    setTrigger(detectTrigger(next, pos));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!trigger) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setTrigger(null);
      return;
    }
    if (dropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % dropdownItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + dropdownItems.length) % dropdownItems.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const item = dropdownItems[selectedIdx];
      if (!item) return;
      e.preventDefault();
      insertCompletion(item);
    }
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setTrigger(detectTrigger(el.value, el.selectionStart ?? el.value.length));
  }

  function handleBlur() {
    // Delay so onMouseDown in dropdown can fire first and intercept selection
    setTimeout(() => setTrigger(null), 150);
  }

  const isSearching =
    isFetching &&
    // Only show "searching" indicator when a query is pending but we have prior results.
    // If there are no prior results, the skeleton state handles visual feedback.
    dropdownItems.length > 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center border-b border-[var(--color-border)]">
        <TabBtn active={mode === "write"} onClick={() => setMode("write")}>
          <Pencil className="h-3 w-3" />
          Write
        </TabBtn>
        <TabBtn
          active={mode === "preview"}
          onClick={() => setMode("preview")}
          disabled={!value.trim()}
        >
          <Eye className="h-3 w-3" />
          Preview
        </TabBtn>
        <span className="ml-auto select-none pr-3 font-mono text-[10px] text-[var(--color-fg-faint)]">
          @ mention &nbsp;·&nbsp; # reference
        </span>
      </div>

      {mode === "write" && (
        <>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            autoFocus={autoFocus}
            className="w-full resize-y bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none disabled:opacity-50"
          />

          {trigger && (
            <Dropdown
              anchor={textareaRef.current}
              items={dropdownItems}
              isPending={isFetching || isSearching}
              selectedIdx={selectedIdx}
              onSelect={insertCompletion}
            />
          )}
        </>
      )}

      {mode === "preview" && (
        <div className="min-h-[80px] px-3 py-2.5">
          {value.trim() ? (
            <div className="readme-prose max-w-none text-sm">
              <GithubMarkdown>{value}</GithubMarkdown>
            </div>
          ) : (
            <p className="text-sm italic text-[var(--color-fg-faint)]">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-[var(--color-accent)] text-[var(--color-fg)]"
          : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
