import { CheckCircle2, CircleDot, Eye, GitPullRequest, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { Skeleton } from "@/app/components/ui/skeleton";
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

// ─── Caret pixel coords (mirror-div technique) ───────────────────────────────
// Textareas don't expose a native "where is the caret in screen space" API.
// We create an off-screen div with the textarea's computed text styles, fill
// it with the text up to the caret, drop a marker span, and read the marker's
// bounding rect. Returns a DOMRect in viewport coordinates — what Radix
// Popover's virtualRef expects from getBoundingClientRect().

const CARET_STYLE_PROPS = [
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

function getCaretCoords(textarea: HTMLTextAreaElement, position: number): DOMRect {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  const target = mirror.style as unknown as Record<string, string>;
  for (const prop of CARET_STYLE_PROPS) {
    target[prop] = computed[prop];
  }
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    overflowWrap: "break-word",
    overflow: "hidden",
    width: `${textarea.clientWidth}px`,
    height: "auto",
  });

  document.body.appendChild(mirror);
  mirror.textContent = textarea.value.slice(0, position);

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);

  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();

  const offsetTop = markerRect.top - mirrorRect.top;
  const offsetLeft = markerRect.left - mirrorRect.left;
  const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.4;

  document.body.removeChild(mirror);

  return new DOMRect(
    textareaRect.left + offsetLeft,
    textareaRect.top + offsetTop - textarea.scrollTop,
    1,
    lineHeight,
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

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
        "group relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none",
        "transition-colors duration-75",
        selected ? "bg-[var(--color-bg-sunken)] text-[var(--color-fg)]" : "hover:bg-[var(--color-bg-sunken)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-opacity duration-75",
          selected ? "bg-primary opacity-100" : "opacity-0",
        )}
      />

      {item.kind === "@" ? (
        <>
          <Avatar login={item.login} avatarUrl={item.avatar} size="sm" />
          <span className="truncate font-medium text-foreground">{item.login}</span>
          <Badge variant="secondary" className="ml-auto font-mono uppercase tracking-widest">
            member
          </Badge>
        </>
      ) : (
        <>
          {item.isPR ? (
            <GitPullRequest
              className={cn(
                "size-3.5 shrink-0",
                item.state === "open" ? "text-[var(--color-success)]" : "text-muted-foreground",
              )}
            />
          ) : item.state === "open" ? (
            <CircleDot className="size-3.5 shrink-0 text-[var(--color-success)]" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="font-mono text-ui text-muted-foreground tabular-nums">
            #{item.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
          {item.isPR && (
            <Badge variant="outline" className="ml-auto font-mono uppercase tracking-wider">
              PR
            </Badge>
          )}
        </>
      )}
    </button>
  );
}

// ─── CommentBox ─────────────────────────────────────────────────────────────

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

  // Virtual anchor for Radix Popover — resolves to the caret's viewport rect
  // at position-time. Mutable ref-object, NOT React state, so updates to
  // `trigger` don't re-render the popover; Radix only calls
  // getBoundingClientRect() when it needs to position.
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;
  const virtualAnchorRef = useRef<{ getBoundingClientRect(): DOMRect }>({
    getBoundingClientRect: () => {
      const t = triggerRef.current;
      const ta = textareaRef.current;
      if (!t || !ta) return new DOMRect(0, 0, 0, 0);
      return getCaretCoords(ta, t.startIndex);
    },
  });

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
    // Delay so onMouseDown inside the popover can fire first
    setTimeout(() => setTrigger(null), 150);
  }

  const isSearching = isFetching && dropdownItems.length > 0;
  const showSkeleton = !!trigger && isFetching && dropdownItems.length === 0;
  const showEmpty = !!trigger && !isFetching && dropdownItems.length === 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center border-b border-border">
        <TabBtn active={mode === "write"} onClick={() => setMode("write")}>
          <Pencil className="size-3" />
          Write
        </TabBtn>
        <TabBtn
          active={mode === "preview"}
          onClick={() => setMode("preview")}
          disabled={!value.trim()}
        >
          <Eye className="size-3" />
          Preview
        </TabBtn>
        <span className="ml-auto select-none pr-3 font-mono text-micro text-[var(--color-fg-faint)]">
          @ mention &nbsp;·&nbsp; # reference
        </span>
      </div>

      {mode === "write" && (
        <Popover open={!!trigger}>
          <PopoverAnchor virtualRef={virtualAnchorRef} />
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
            className="w-full resize-y bg-background px-3 py-2.5 text-body text-foreground placeholder:text-[var(--color-fg-faint)] focus:outline-none disabled:opacity-50"
          />
          <PopoverContent
            align="start"
            sideOffset={4}
            // Don't steal focus from the textarea when the popover opens —
            // the user is still typing their query.
            onOpenAutoFocus={(e) => e.preventDefault()}
            // Keep popover open across textarea interactions; we manage
            // dismissal via trigger state (blur / Escape / selection).
            onInteractOutside={(e) => e.preventDefault()}
            className="w-[320px] gap-0 p-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
              <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
                {trigger?.type === "@" ? "Mention a user" : "Reference an issue or PR"}
              </span>
              {isSearching && (
                <span className="ml-auto flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
                    searching
                  </span>
                </span>
              )}
            </div>

            <div className="max-h-[260px] overflow-auto p-1">
              {showSkeleton ? (
                <div className="flex flex-col gap-0.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="h-3.5 flex-1 max-w-[60%]" />
                    </div>
                  ))}
                </div>
              ) : showEmpty ? (
                <div className="px-2 py-3 font-mono text-ui text-muted-foreground text-center">
                  No matches
                </div>
              ) : (
                dropdownItems.map((item, i) => (
                  <Row
                    key={item.id}
                    item={item}
                    selected={i === selectedIdx}
                    onSelect={insertCompletion}
                  />
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {mode === "preview" && (
        <div className="min-h-[80px] px-3 py-2.5">
          {value.trim() ? (
            <div className="readme-prose max-w-none text-body">
              <GithubMarkdown>{value}</GithubMarkdown>
            </div>
          ) : (
            <p className="text-body italic text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab button ─────────────────────────────────────────────────────────────

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
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-ui font-medium",
        "outline-none transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
