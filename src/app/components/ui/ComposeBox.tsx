import {
  CheckCircle2,
  CircleDot,
  Eye,
  GitPullRequest,
  ImagePlus,
  Loader2,
  Pencil,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { type MentionItem, type MentionUser, useMentionSearch } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { useAuthStore } from "@/app/stores/auth";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const MENTION_SKELETON_WIDTHS = ["55%", "40%", "65%", "48%"] as const;

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
  marker.textContent = "​";
  mirror.appendChild(marker);

  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();

  const offsetTop = markerRect.top - mirrorRect.top;
  const offsetLeft = markerRect.left - mirrorRect.left;
  const lineHeight =
    Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.4;

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
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-ui outline-hidden select-none",
        "transition-colors duration-75 hover:bg-(--color-popover-active)",
        selected && "bg-(--color-popover-active) text-foreground",
      )}
    >
      {item.kind === "@" ? (
        <>
          <Avatar login={item.login} avatarUrl={item.avatar} size="sm" />
          <span className="min-w-0 flex-1 truncate text-foreground">{item.login}</span>
        </>
      ) : (
        <>
          {item.isPR ? (
            <GitPullRequest
              aria-hidden
              className={cn(
                "size-3.5 shrink-0",
                item.state === "open" ? "text-(--color-success)" : "text-destructive",
              )}
            />
          ) : item.state === "open" ? (
            <CircleDot aria-hidden className="size-3.5 shrink-0 text-(--color-success)" />
          ) : (
            <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-(--color-pr-merged)" />
          )}
          <span className="font-mono text-caption text-muted-foreground tabular-nums">
            #{item.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
        </>
      )}
    </button>
  );
}

// ─── ComposeBox ─────────────────────────────────────────────────────────────

export interface ComposeBoxProps {
  owner: string;
  repo: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  /** Show the footer Cancel button when `onCancel` is set (Esc cancels either way). */
  showCancel?: boolean;
  submitDisabled?: boolean;
  submitPending?: boolean;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  participants?: MentionUser[];
}

export function ComposeBox({
  owner,
  repo,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Comment",
  cancelLabel = "Cancel",
  showCancel = true,
  submitDisabled,
  submitPending,
  placeholder = "Leave a comment",
  rows = 5,
  disabled,
  autoFocus,
  className,
  participants,
}: ComposeBoxProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const dropdownItems = useMemo((): MentionItem[] => {
    const api = items ?? [];
    if (!participants?.length || trigger?.type !== "@") return api;
    const q = debouncedQuery.toLowerCase();
    const apiLogins = new Set(
      api.filter((i): i is MentionUser => i.kind === "@").map((i) => i.login),
    );
    const seed = participants.filter(
      (p) => !apiLogins.has(p.login) && (!q || p.login.toLowerCase().includes(q)),
    );
    return [...seed, ...api];
  }, [items, participants, trigger?.type, debouncedQuery]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the highlight whenever the suggestions change
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

  const valueRef = useRef(value);
  valueRef.current = value;

  const uploadFile = useCallback(
    async (file: File) => {
      const token = useAuthStore.getState().token;
      if (!token || !file.type.startsWith("image/")) return;

      setUploading(true);
      const ta = textareaRef.current;
      const cursor = ta?.selectionStart ?? valueRef.current.length;
      const placeholder = `![Uploading ${file.name}…]()`;
      const before = valueRef.current.slice(0, cursor);
      const after = valueRef.current.slice(cursor);
      onChange(before + placeholder + after);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
          body: await file.arrayBuffer(),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { url } = (await res.json()) as { url: string };
        const markdown = `![${file.name}](${url})`;
        onChange(valueRef.current.replace(placeholder, markdown));
      } catch {
        onChange(valueRef.current.replace(placeholder, ""));
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadFile(file);
        return;
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file?.type.startsWith("image/")) {
        e.preventDefault();
        uploadFile(file);
        return;
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const pos = e.target.selectionStart ?? next.length;
    setTrigger(detectTrigger(next, pos));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (!trigger) {
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setTrigger(null);
      return;
    }
    if (dropdownItems.length === 0) return;
    const ctrlOnly = e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    const key = e.key.toLowerCase();
    if (e.key === "ArrowDown" || (ctrlOnly && (key === "n" || key === "j"))) {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % dropdownItems.length);
    } else if (e.key === "ArrowUp" || (ctrlOnly && (key === "p" || key === "k"))) {
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

  function handleBlur(e: React.FocusEvent) {
    setTimeout(() => setTrigger(null), 150);
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setFocused(false);
    }
  }

  function handleFocusCapture() {
    setFocused(true);
  }

  const showSkeleton = !!trigger && isFetching && dropdownItems.length === 0;
  const showEmpty = !!trigger && !isFetching && dropdownItems.length === 0;
  const hasContent = value.trim().length > 0;
  const canSubmit = hasContent && !submitDisabled;
  const mod = IS_MAC ? "⌘" : "Ctrl";

  return (
    <div
      ref={containerRef}
      onFocusCapture={handleFocusCapture}
      className={cn(
        "group/compose @container/compose flex min-w-0 flex-col rounded-lg border border-input bg-(--color-control-bg) transition-colors",
        focused &&
          "border-(--color-control-border-active) bg-(--color-control-bg-active) ring-1 ring-(--color-control-ring)",
        className,
      )}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5">
        <ToggleGroup
          type="single"
          size="sm"
          spacing={1}
          value={mode}
          onValueChange={(next) => {
            if (next === "write" || next === "preview") setMode(next);
          }}
          aria-label="Editor mode"
        >
          <ToggleGroupItem value="write">
            <Pencil data-icon="inline-start" aria-hidden />
            Write
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" disabled={!hasContent}>
            <Eye data-icon="inline-start" aria-hidden />
            Preview
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-focus-within/compose:opacity-100 group-hover/compose:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
          <span className="hidden select-none text-caption text-muted-foreground @min-[28rem]/compose:inline">
            @ to mention · # to reference
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 data-icon="inline-start" className="motion-safe:animate-spin" />
                ) : (
                  <ImagePlus data-icon="inline-start" />
                )}
                Attach
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach an image, or paste or drop one</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* ── Write / Preview area ─────────────────────────────────────── */}
      <div className="relative min-h-0">
        {mode === "write" && (
          <Popover open={!!trigger}>
            <PopoverAnchor virtualRef={virtualAnchorRef} />
            <textarea
              ref={textareaRef}
              aria-label={placeholder}
              aria-keyshortcuts={onSubmit ? `${IS_MAC ? "Meta" : "Control"}+Enter` : undefined}
              name="comment-body"
              autoComplete="off"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onBlur={handleBlur}
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder={placeholder}
              rows={rows}
              disabled={disabled}
              // biome-ignore lint/a11y/noAutofocus: callers opt in when the composer opens on demand
              autoFocus={autoFocus}
              className={cn(
                "block w-full resize-y rounded-b-lg bg-transparent px-3 py-2 text-body text-foreground",
                "placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
              )}
            />
            <PopoverContent
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              className="w-72 gap-0 overflow-hidden p-1 data-[state=closed]:[animation-duration:0s]"
            >
              <div role="listbox" aria-label="Suggestions" className="max-h-64 overflow-auto">
                {showSkeleton ? (
                  <div className="flex flex-col">
                    {MENTION_SKELETON_WIDTHS.map((width) => (
                      <div key={width} className="flex h-8 items-center gap-2.5 px-2">
                        <Skeleton className="size-5 shrink-0 rounded-full" />
                        <Skeleton className="h-3" style={{ width }} />
                      </div>
                    ))}
                  </div>
                ) : showEmpty ? (
                  <div className="px-2 py-4 text-center text-ui text-muted-foreground">
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
          <div className="min-h-20 px-3 py-2">
            {hasContent ? (
              <div className="readme-prose max-w-none text-body">
                <GithubMarkdown repoContext={{ owner, repo }}>{value}</GithubMarkdown>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">Nothing to preview.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {onSubmit && (
        <div className="flex flex-wrap items-center justify-end gap-2 px-2 pb-2">
          <span className="mr-auto hidden select-none items-center gap-1 pl-1 text-caption text-muted-foreground @min-[24rem]/compose:inline-flex">
            <Kbd>{mod}</Kbd>
            <Kbd>Enter</Kbd>
            to submit
          </span>
          {onCancel && showCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitPending}
              aria-keyshortcuts="Escape"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            aria-busy={submitPending || undefined}
            onClick={() => {
              if (!submitPending) onSubmit();
            }}
          >
            {submitPending ? (
              <Loader2 data-icon="inline-start" className="motion-safe:animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
