import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  CheckCircle2,
  CircleDot,
  FilePlus,
  GitPullRequest,
  Home,
  LogOut,
  type LucideIcon,
  SunMoon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parsePaletteQuery,
  useCommandPaletteSearch,
  useRecentItems,
} from "@/app/hooks/useCommandPaletteItems";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useRepos } from "@/app/hooks/useRepos";
import { logout } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { pushRecentItem, type RecentItem } from "@/app/lib/recentItems";
import { formatRelativeTime } from "@/app/lib/time";
import { useCommandPalette, useCommandPaletteStore } from "@/app/stores/commandPalette";
import { useThemeStore } from "@/app/stores/theme";

/**
 * Command palette — P1.T1.b content.
 *
 * Sections (top→bottom): Recent · Actions · Repos · Issues & PRs.
 * Sources live in `useCommandPaletteItems`; rendering + keyboard live here.
 *
 * Palette owns its own `⌘K` binding — this file mounts once at the app
 * root, so a useKeybindings call here is the canonical global registration.
 * The stub in `lib/shortcuts.ts` stays as a no-op for any other consumer
 * who merges GLOBAL_SHORTCUTS; composition-at-component beats mutating the
 * shared registry per the G1 follow-up.
 */

type ActionItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  // Actions that should fall under ">" must not claim to be navigation — we
  // still push them to the MRU store so "Recent" can surface them.
  onRun: () => void;
};

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const { close, toggle } = useCommandPalette();
  const navigate = useNavigate();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      useCommandPaletteStore.getState().closePalette();
    }
  }, [pathname]);

  // Parse the current URL for repo context — used to scope the "new issue"
  // action and the `#123` number jump. Reading from the pathname avoids
  // needing a Route hook (this component lives at the app root, above the
  // `$owner/$repo` route's scope).
  const repoContext = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    // Skip non-repo top-level routes.
    if (["login", "settings", "playground", "w"].includes(parts[0]!)) return null;
    return { owner: parts[0]!, repo: parts[1]! };
  }, [pathname]);

  // Global ⌘K. Toggle, not open — so ⌘K while already open closes it, matching
  // Linear/Raycast. cmdk owns the key internally once focus is in its input,
  // so our listener never fires from inside the palette (editable target check
  // in useKeybindings already filters inputs).
  const shortcutMap = useMemo(() => ({ "⌘k": toggle }), [toggle]);
  useKeybindings(shortcutMap);

  // ─── Sources ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const mode = parsePaletteQuery(query);
  const recent = useRecentItems(5);
  const repos = useRepos();
  const search = useCommandPaletteSearch(mode.kind === "all" ? mode.query : "");

  // Reset query on close so reopening always shows the default view.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // ─── Navigation helpers ────────────────────────────────────────────────────
  const go = useCallback(
    (item: Omit<RecentItem, "visitedAt">) => {
      // Persist to MRU before routing. The navigation itself closes the dialog
      // via the route-change effect above, but we call close() for the
      // same-route case (e.g., re-selecting the current repo) and to preempt
      // the race between TanStack's async transition + the effect firing.
      void pushRecentItem(item);
      close();
      navigate({ to: item.href });
    },
    [close, navigate],
  );

  const runAction = useCallback(
    (action: ActionItem) => {
      void pushRecentItem({
        id: `action:${action.id}`,
        kind: "action",
        label: action.label,
        href: "#action",
        meta: "Action",
      });
      close();
      action.onRun();
    },
    [close],
  );

  // Direct jump on numeric input — fires when user presses Enter while the
  // query parser resolved a bare number. Keeps the palette empty visually
  // (no results section) but Enter still has a meaning.
  const jumpToNumber = useCallback(
    (num: number) => {
      if (!repoContext) return;
      go({
        id: `issue:${repoContext.owner}/${repoContext.repo}#${num}`,
        kind: "issue",
        label: `#${num}`,
        href: `/${repoContext.owner}/${repoContext.repo}/issues?issue=${num}`,
        meta: `${repoContext.owner}/${repoContext.repo}`,
      });
    },
    [repoContext, go],
  );

  // ─── Actions ────────────────────────────────────────────────────────────────
  const actions = useMemo<ActionItem[]>(() => {
    const base: ActionItem[] = [
      {
        id: "toggle-theme",
        label: "Toggle theme",
        icon: SunMoon,
        keywords: ["dark", "light", "appearance", "mode"],
        onRun: () => useThemeStore.getState().cyclePreference(),
      },
      {
        id: "open-inbox",
        label: "Open inbox",
        icon: Home,
        keywords: ["home", "notifications", "triage"],
        onRun: () => navigate({ to: "/" }),
      },
      {
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        keywords: ["logout", "exit"],
        onRun: () => logout(),
      },
    ];
    if (repoContext) {
      base.push({
        id: "new-issue",
        label: `New issue in ${repoContext.owner}/${repoContext.repo}`,
        icon: FilePlus,
        keywords: ["create", "bug", "report"],
        // Issues route will respect `?new=1` post-P2; link is future-safe.
        onRun: () =>
          navigate({
            to: `/${repoContext.owner}/${repoContext.repo}/issues?new=1`,
          }),
      });
    }
    return base;
  }, [navigate, repoContext]);

  // ─── Section filters for mode routing ──────────────────────────────────────
  const showRecent = mode.kind === "all" && recent.length > 0;
  const showActions = mode.kind === "all" || mode.kind === "actions";
  const showRepos = mode.kind === "all" || mode.kind === "repos";
  const showSearch = mode.kind === "all" && mode.query.length >= 2;
  const numberMode = mode.kind === "number";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[color-mix(in_oklab,var(--color-fg)_32%,transparent)]",
            "backdrop-blur-[2px]",
            "[animation:palette-backdrop-in_120ms_cubic-bezier(0.16,1,0.3,1)]",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[22%] z-50",
            "w-[min(640px,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-[var(--radius-lg)]",
            "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
            "shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.22)]",
            "[animation:palette-enter_120ms_cubic-bezier(0.16,1,0.3,1)]",
            // Both :focus and :focus-visible — Radix Dialog auto-focuses the
            // Content on open, which would otherwise light up the global
            // *:focus-visible 2px orange ring.
            "focus:outline-none focus-visible:outline-none",
          )}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          <Command
            label="Command palette"
            className="flex flex-col"
            // For number-mode we take over Enter ourselves, so filtering is
            // irrelevant. Leave cmdk on its defaults for all other modes.
            shouldFilter={!numberMode}
            onKeyDown={(e) => {
              // Reserve ⌘Enter for peek. Stub for now — P2.G4 will wire it.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                // TODO: peek (P2.G4)
                return;
              }
              if (numberMode && e.key === "Enter") {
                e.preventDefault();
                jumpToNumber(mode.number);
              }
            }}
          >
            <div className="flex items-center border-b border-[var(--color-border)] px-4">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Search, or type > for actions, @ for repos, #123 to open an issue…"
                className={cn(
                  "w-full bg-transparent py-3 text-body text-[var(--color-fg)]",
                  "placeholder:text-[var(--color-fg-faint)]",
                  "focus:outline-none",
                )}
              />
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto px-2 py-2">
              <Command.Empty
                className={cn("px-3 py-6 text-center text-ui text-[var(--color-fg-faint)]")}
              >
                {numberMode
                  ? repoContext
                    ? `Press Enter to open #${mode.number} in ${repoContext.owner}/${repoContext.repo}`
                    : "Open a repo first to jump to an issue number."
                  : "No results."}
              </Command.Empty>

              {showRecent && (
                <Section heading="Recent">
                  {recent.map((item) => (
                    <RecentRow key={`recent-${item.id}`} item={item} onRun={() => go(item)} />
                  ))}
                </Section>
              )}

              {showActions && (
                <Section heading="Actions">
                  {actions.map((a) => (
                    <ActionRow key={a.id} action={a} onRun={() => runAction(a)} />
                  ))}
                </Section>
              )}

              {showRepos && repos.data && repos.data.length > 0 && (
                <Section heading="Repos">
                  {repos.data.slice(0, 50).map((r) => (
                    <RepoRow
                      key={`repo-${r.id}`}
                      fullName={r.fullName}
                      language={r.language}
                      pushedAt={r.pushedAt}
                      onRun={() =>
                        go({
                          id: `repo:${r.fullName}`,
                          kind: "repo",
                          label: r.fullName,
                          href: `/${r.owner.login}/${r.name}`,
                          meta: r.language ?? undefined,
                        })
                      }
                    />
                  ))}
                </Section>
              )}

              {showSearch && (
                <Section
                  heading="Issues & PRs"
                  eyebrowRight={
                    search.isFetching ? (
                      <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                        searching…
                      </span>
                    ) : null
                  }
                >
                  {(search.data ?? []).map((hit) => (
                    <SearchRow
                      key={`hit-${hit.id}`}
                      hit={hit}
                      onRun={() =>
                        go({
                          id: `${hit.kind}:${hit.repoFullName}#${hit.number}`,
                          kind: hit.kind,
                          label: hit.title,
                          href: hit.href,
                          meta: `${hit.repoFullName} · #${hit.number}`,
                        })
                      }
                    />
                  ))}
                </Section>
              )}
            </Command.List>

            <div
              className={cn(
                "flex items-center justify-between border-t border-[var(--color-border)]",
                "bg-[var(--color-bg-subtle)] px-3 py-2",
              )}
            >
              <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                {modeLabel(mode)}
              </span>
              <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
                ↵ to open · esc to close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function modeLabel(mode: ReturnType<typeof parsePaletteQuery>): string {
  if (mode.kind === "actions") return "Actions";
  if (mode.kind === "repos") return "Repos";
  if (mode.kind === "number") return `Open #${mode.number}`;
  return "Command palette";
}

// ─── Section + Row primitives ──────────────────────────────────────────────────
// Kept inline on purpose — §rules item "Don't invent new abstractions."

function Section({
  heading,
  eyebrowRight,
  children,
}: {
  heading: string;
  eyebrowRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  // cmdk auto-hides a group with zero matching children when filtering. The
  // wrapping `Command.Group` handles the "hide heading on empty query" case
  // for us — only visible groups render their heading. The only case we
  // render manually is the eyebrow-right slot for the searching… indicator.
  return (
    <Command.Group
      heading={
        <div className="flex items-baseline justify-between px-2 pt-3 pb-1">
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            {heading}
          </span>
          {eyebrowRight}
        </div>
      }
      className="px-0"
    >
      {children}
    </Command.Group>
  );
}

// Shared row class — centralizes cmdk data-selected styling per §6.
const rowClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-ui",
  "text-[var(--color-fg)]",
  "data-[selected=true]:bg-[var(--color-bg-sunken)]",
);

function RecentRow({ item, onRun }: { item: RecentItem; onRun: () => void }) {
  const monoLabel = item.kind === "repo" || item.kind === "issue" || item.kind === "pr";
  return (
    <Command.Item
      // Include href + kind in value so cmdk's fuzzy filter matches on more
      // than the visible label.
      value={`recent ${item.label} ${item.href} ${item.kind}`}
      onSelect={onRun}
      className={rowClass}
    >
      <RecentIcon kind={item.kind} />
      <span className={cn("min-w-0 flex-1 truncate", monoLabel && "font-mono tabular-nums")}>
        {item.label}
      </span>
      {item.meta && (
        <span className="shrink-0 font-mono text-micro text-[var(--color-fg-faint)] tabular-nums">
          {item.meta}
        </span>
      )}
      <span className="shrink-0 font-mono text-micro text-[var(--color-fg-faint)] tabular-nums">
        {formatRelativeTime(new Date(item.visitedAt).toISOString())}
      </span>
    </Command.Item>
  );
}

function RecentIcon({ kind }: { kind: RecentItem["kind"] }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-[var(--color-fg-faint)]";
  if (kind === "pr") return <GitPullRequest className={cls} />;
  if (kind === "issue") return <CircleDot className={cls} />;
  if (kind === "action") return <SunMoon className={cls} />;
  // repo + file share a neutral dot
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-fg-faint)] ml-1 mr-1"
    />
  );
}

function ActionRow({ action, onRun }: { action: ActionItem; onRun: () => void }) {
  const Icon = action.icon;
  return (
    <Command.Item
      value={`> ${action.label} ${action.keywords?.join(" ") ?? ""}`}
      onSelect={onRun}
      className={rowClass}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)]" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      <span className="shrink-0 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
        Action
      </span>
    </Command.Item>
  );
}

function RepoRow({
  fullName,
  language,
  pushedAt,
  onRun,
}: {
  fullName: string;
  language: string | null;
  pushedAt: string;
  onRun: () => void;
}) {
  return (
    <Command.Item value={`@ ${fullName} ${language ?? ""}`} onSelect={onRun} className={rowClass}>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-fg-faint)] ml-1 mr-1"
      />
      <span className="min-w-0 flex-1 truncate font-mono tabular-nums">{fullName}</span>
      {language && (
        <span className="shrink-0 text-micro text-[var(--color-fg-faint)]">{language}</span>
      )}
      <span className="shrink-0 font-mono text-micro text-[var(--color-fg-faint)] tabular-nums">
        {formatRelativeTime(pushedAt)}
      </span>
    </Command.Item>
  );
}

function SearchRow({
  hit,
  onRun,
}: {
  hit: {
    kind: "issue" | "pr";
    state: "open" | "closed";
    number: number;
    title: string;
    repoFullName: string;
  };
  onRun: () => void;
}) {
  // Icon choice encodes both kind and state — matches the CommentBox pattern.
  const Icon = hit.kind === "pr" ? GitPullRequest : hit.state === "open" ? CircleDot : CheckCircle2;
  const iconColor =
    hit.state === "open" ? "text-[var(--color-success)]" : "text-[var(--color-fg-faint)]";
  return (
    <Command.Item
      value={`${hit.repoFullName} #${hit.number} ${hit.title}`}
      onSelect={onRun}
      className={rowClass}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
      <span className="shrink-0 font-mono text-ui text-[var(--color-fg-faint)] tabular-nums">
        #{hit.number}
      </span>
      <span className="min-w-0 flex-1 truncate">{hit.title}</span>
      <span className="shrink-0 font-mono text-micro text-[var(--color-fg-faint)] tabular-nums">
        {hit.repoFullName}
      </span>
    </Command.Item>
  );
}
