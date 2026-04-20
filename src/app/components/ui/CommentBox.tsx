import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, Eye, GitPullRequest, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { cn } from "@/app/lib/cn";
import { getGitHubClient } from "@/app/lib/github/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Trigger = {
  type: "@" | "#";
  query: string;
  startIndex: number;
};

type MentionItem = {
  kind: "@";
  id: string;
  login: string;
  avatar: string;
};

type RefItem = {
  kind: "#";
  id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  isPR: boolean;
};

type DropdownItem = MentionItem | RefItem;

// ─── Data hooks ──────────────────────────────────────────────────────────────

const AssigneeSchema = z.array(z.object({ login: z.string(), avatar_url: z.string() }));

const IssueRefSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    state: z.enum(["open", "closed"]),
    pull_request: z.object({}).optional(),
  }),
);

function useAssignees(owner: string, repo: string, enabled: boolean) {
  return useQuery({
    queryKey: ["repo-assignees", owner, repo],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/assignees", {
        owner,
        repo,
        per_page: 50,
      });
      return AssigneeSchema.parse(res.data);
    },
  });
}

function useIssueRefs(owner: string, repo: string, enabled: boolean) {
  return useQuery({
    queryKey: ["repo-issue-refs", owner, repo],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        state: "all",
        per_page: 100,
        sort: "updated",
      });
      return IssueRefSchema.parse(res.data);
    },
  });
}

// ─── Trigger detection ───────────────────────────────────────────────────────

function detectTrigger(text: string, cursorPos: number): Trigger | null {
  // Walk back from cursor to find the start of the current word
  let i = cursorPos - 1;
  while (i >= 0 && !/[\s\n]/.test(text[i] ?? " ")) i--;
  const wordStart = i + 1;
  const word = text.slice(wordStart, cursorPos);
  if (word.startsWith("@")) return { type: "@", query: word.slice(1), startIndex: wordStart };
  if (word.startsWith("#")) return { type: "#", query: word.slice(1), startIndex: wordStart };
  return null;
}

// ─── Dropdown (portal) ───────────────────────────────────────────────────────

function Dropdown({
  anchorRef,
  items,
  selectedIdx,
  onSelect,
}: {
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
  items: DropdownItem[];
  selectedIdx: number;
  onSelect: (item: DropdownItem) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Recompute position on each render while visible
  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: Math.min(r.width, 380) });
  });

  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] shadow-xl"
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          // mousedown fires before blur, so we can intercept before focus leaves textarea
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
            i === selectedIdx
              ? "bg-[var(--color-bg-sunken)]"
              : "hover:bg-[var(--color-bg-subtle)]",
          )}
        >
          {item.kind === "@" ? (
            <>
              <img
                src={item.avatar}
                alt={item.login}
                className="h-5 w-5 flex-shrink-0 rounded-full border border-[var(--color-border)]"
              />
              <span className="font-medium text-[var(--color-fg)]">{item.login}</span>
              <span className="ml-auto text-[11px] text-[var(--color-fg-faint)]">member</span>
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
              <span className="font-mono text-xs text-[var(--color-fg-faint)]">
                #{item.number}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">{item.title}</span>
              {item.isPR && (
                <span className="ml-auto flex-shrink-0 rounded border border-[var(--color-border)] px-1 py-px font-mono text-[9px] uppercase tracking-wider text-[var(--color-fg-faint)]">
                  PR
                </span>
              )}
            </>
          )}
        </button>
      ))}
    </div>,
    document.body,
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

  // Prefetch data as soon as the box mounts (staleTime ensures single request)
  const { data: assignees } = useAssignees(owner, repo, true);
  const { data: issueRefs } = useIssueRefs(owner, repo, true);

  const dropdownItems = useMemo((): DropdownItem[] => {
    if (!trigger) return [];

    if (trigger.type === "@") {
      const q = trigger.query.toLowerCase();
      return (assignees ?? [])
        .filter((a) => !q || a.login.toLowerCase().includes(q))
        .slice(0, 7)
        .map((a) => ({ kind: "@" as const, id: a.login, login: a.login, avatar: a.avatar_url }));
    }

    const q = trigger.query.toLowerCase();
    const all = issueRefs ?? [];
    const filtered = q
      ? all.filter(
          (i) => String(i.number).startsWith(q) || i.title.toLowerCase().includes(q),
        )
      : all;
    return filtered.slice(0, 7).map((i) => ({
      kind: "#" as const,
      id: String(i.number),
      number: i.number,
      title: i.title,
      state: i.state,
      isPR: !!i.pull_request,
    }));
  }, [trigger, assignees, issueRefs]);

  // Reset selection when items change
  useEffect(() => setSelectedIdx(0), [dropdownItems]);

  const insertCompletion = useCallback(
    (item: DropdownItem) => {
      if (!textareaRef.current || !trigger) return;
      const cursorPos = textareaRef.current.selectionStart ?? value.length;
      const before = value.slice(0, trigger.startIndex);
      const after = value.slice(cursorPos);
      const insertion =
        item.kind === "@" ? `@${item.login} ` : `#${item.number} `;
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
    if (!trigger || dropdownItems.length === 0) return;
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
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTrigger(null);
    }
  }

  // Re-detect trigger when cursor moves (click, keyboard navigation)
  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setTrigger(detectTrigger(el.value, el.selectionStart ?? el.value.length));
  }

  function handleBlur() {
    // Slight delay so onMouseDown in dropdown fires first
    setTimeout(() => setTrigger(null), 150);
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab bar */}
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

      {/* Write mode */}
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

          {trigger && dropdownItems.length > 0 && (
            <Dropdown
              anchorRef={textareaRef}
              items={dropdownItems}
              selectedIdx={selectedIdx}
              onSelect={insertCompletion}
            />
          )}
        </>
      )}

      {/* Preview mode */}
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
