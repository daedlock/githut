import { CheckCircle2, CircleDot, Eye, GitPullRequest, ImagePlus, Pencil, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Avatar } from "@/app/components/ui/avatar";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { type MentionItem, type MentionUser, useMentionSearch } from "@/app/hooks/useMentionSearch";
import { cn } from "@/app/lib/cn";
import { useAuthStore } from "@/app/stores/auth";

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
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-hidden select-none",
        "transition-colors duration-75",
        selected ? "bg-[var(--color-popover-active)] text-foreground" : "hover:bg-[var(--color-popover-active)]",
      )}
    >
      {item.kind === "@" ? (
        <>
          <Avatar login={item.login} avatarUrl={item.avatar} size="sm" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{item.login}</span>
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
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            #{item.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{item.title}</span>
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
  submitLabel?: string;
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
  submitLabel = "Comment",
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
    const apiLogins = new Set(api.filter((i): i is MentionUser => i.kind === "@").map((i) => i.login));
    const seed = participants.filter(
      (p) => !apiLogins.has(p.login) && (!q || p.login.toLowerCase().includes(q)),
    );
    return [...seed, ...api];
  }, [items, participants, trigger?.type, debouncedQuery]);

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
  const canSubmit = hasContent && !submitDisabled && !submitPending;

  return (
    <div
      ref={containerRef}
      onFocusCapture={handleFocusCapture}
      className={cn(
        "group/compose flex flex-col rounded-lg border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        focused
          ? "border-[var(--color-border-strong)] ring-1 ring-[var(--color-focus)]/20"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
        className,
      )}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center px-1 py-0.5">
        <div className="relative flex">
          <TabPill active={mode === "write"} onClick={() => setMode("write")}>
            <Pencil className="size-3" />
            Write
          </TabPill>
          <TabPill
            active={mode === "preview"}
            onClick={() => setMode("preview")}
            disabled={!hasContent}
          >
            <Eye className="size-3" />
            Preview
          </TabPill>
        </div>
        <div className="flex-1" />
        <div className={cn(
          "flex items-center gap-2 pr-1 transition-opacity duration-200",
          focused ? "opacity-100" : "opacity-0",
        )}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[var(--color-fg-faint)]",
              "outline-none transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-foreground",
              uploading && "animate-pulse",
            )}
            title="Attach an image"
          >
            <ImagePlus className="size-3" />
            <span className="font-mono text-micro">{uploading ? "Uploading…" : "Attach"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <span className="select-none font-mono text-micro text-[var(--color-fg-faint)]">
            @ mention &middot; # reference
          </span>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <div className="mx-3 border-t border-[var(--color-border)]" />

      {/* ── Write / Preview area ─────────────────────────────────────── */}
      <div className="relative min-h-0">
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
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder={placeholder}
              rows={rows}
              disabled={disabled}
              autoFocus={autoFocus}
              className={cn(
                "w-full resize-y rounded-b-lg bg-transparent px-3 py-2.5 text-body text-foreground",
                "placeholder:text-[var(--color-fg-faint)] placeholder:transition-opacity placeholder:duration-200",
                "focus:outline-none disabled:opacity-50",
                focused ? "placeholder:opacity-100" : "placeholder:opacity-60",
              )}
            />
            <PopoverContent
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              className="w-[280px] gap-0 p-1.5 overflow-hidden data-[state=closed]:[animation-duration:0s]"
            >
              <div className="max-h-[260px] overflow-auto">
                {showSkeleton ? (
                  <div className="flex flex-col gap-0.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                        <Skeleton className="size-5 rounded-full" />
                        <Skeleton className="h-2.5 flex-1 max-w-[60%]" />
                      </div>
                    ))}
                  </div>
                ) : showEmpty ? (
                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">
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
          <div className="animate-in fade-in-0 duration-150 min-h-[80px] px-3 py-2.5">
            {hasContent ? (
              <div className="readme-prose max-w-none text-body">
                <GithubMarkdown>{value}</GithubMarkdown>
              </div>
            ) : (
              <p className="text-body italic text-muted-foreground">Nothing to preview.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {onSubmit && (
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2">

          <span className="font-mono text-micro text-[var(--color-fg-faint)] select-none">
            {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter to submit
          </span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium",
              "outline-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "focus-visible:ring-2 focus-visible:ring-ring/40",
              "disabled:pointer-events-none",
              canSubmit
                ? "bg-primary text-primary-foreground hover:bg-primary/85 active:translate-y-px"
                : "bg-muted text-muted-foreground",
            )}
          >
            {submitPending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting
              </span>
            ) : (
              <>
                <Send className="size-3" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────

function TabPill({
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
        "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-caption font-medium",
        "outline-none transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        active
          ? "bg-[var(--color-popover-active)] text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
