import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookMarked,
  CheckCircle2,
  CircleDot,
  Command as CommandIcon,
  FilePlus,
  GitPullRequest,
  Home,
  LogOut,
  type LucideIcon,
  SunMoon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/app/components/ui/command";
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
 * Command palette (`⌘K`).
 *
 * Composed on shadcn's <CommandDialog> — Dialog + cmdk wired together with
 * built-in animations (data-[state=open/closed]), focus management, and
 * semantic-token styling that inherits our theme bridge automatically.
 *
 * Sections (top→bottom): Recent · Actions · Repos · Issues & PRs.
 * Query-mode parsing lives in useCommandPaletteItems:
 *   ">" → Actions · "@" → Repos · "#N" / bare digits → jump-to-number.
 */

type ActionItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  onRun: () => void;
};

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const { close, toggle } = useCommandPalette();
  const navigate = useNavigate();

  // Close on route change
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      useCommandPaletteStore.getState().closePalette();
    }
  }, [pathname]);

  // Parse repo context from URL — drives the "new issue" action + `#N` jump.
  const repoContext = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (["login", "settings", "playground", "w"].includes(parts[0]!)) return null;
    return { owner: parts[0]!, repo: parts[1]! };
  }, [pathname]);

  // Global ⌘K binding — useKeybindings skips dispatch when focus is inside
  // an input/textarea, which is exactly the right behavior: cmdk owns the
  // key once its input has focus (the palette toggles from outside it).
  const shortcutMap = useMemo(() => ({ "⌘k": toggle }), [toggle]);
  useKeybindings(shortcutMap);

  const [query, setQuery] = useState("");
  const mode = parsePaletteQuery(query);
  const recent = useRecentItems(5);
  const repos = useRepos();
  const search = useCommandPaletteSearch(mode.kind === "all" ? mode.query : "");

  // Reset query on close
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = useCallback(
    (item: Omit<RecentItem, "visitedAt">) => {
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
        onRun: () =>
          navigate({
            to: `/${repoContext.owner}/${repoContext.repo}/issues?new=1`,
          }),
      });
    }
    return base;
  }, [navigate, repoContext]);

  const showRecent = mode.kind === "all" && recent.length > 0;
  const showActions = mode.kind === "all" || mode.kind === "actions";
  const showRepos = mode.kind === "all" || mode.kind === "repos";
  const showSearch = mode.kind === "all" && mode.query.length >= 2;
  const numberMode = mode.kind === "number";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search, navigate, or run a command"
      className="max-w-[min(640px,calc(100vw-2rem))]"
    >
      <div
        // Reserve ⌘Enter for peek (P2.G4); number-mode takes Enter itself.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            return;
          }
          if (numberMode && e.key === "Enter") {
            e.preventDefault();
            jumpToNumber(mode.number);
          }
        }}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={
            repoContext
              ? "Search, > actions, @ repos, # issue number…"
              : "Search, > actions, @ repos…"
          }
        />

        <CommandList>
          <CommandEmpty>
            {numberMode
              ? repoContext
                ? `↵ to open #${mode.number} in ${repoContext.owner}/${repoContext.repo}`
                : "Open a repo first to jump to an issue number."
              : "No results."}
          </CommandEmpty>

          {showRecent && (
            <CommandGroup heading="Recent">
              {recent.map((item) => (
                <CommandItem
                  key={`recent-${item.id}`}
                  value={`recent ${item.label} ${item.href} ${item.kind}`}
                  onSelect={() => go(item)}
                >
                  <RecentIcon kind={item.kind} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      (item.kind === "repo" || item.kind === "issue" || item.kind === "pr") &&
                        "font-mono tabular-nums",
                    )}
                  >
                    {item.label}
                  </span>
                  <CommandShortcut>
                    {formatRelativeTime(new Date(item.visitedAt).toISOString())}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showActions && (
            <CommandGroup heading="Actions">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem
                    key={a.id}
                    value={`> ${a.label} ${a.keywords?.join(" ") ?? ""}`}
                    onSelect={() => runAction(a)}
                  >
                    <Icon />
                    <span className="flex-1 truncate">{a.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {showRepos && repos.data && repos.data.length > 0 && (
            <CommandGroup heading="Repos">
              {repos.data.slice(0, 50).map((r) => (
                <CommandItem
                  key={`repo-${r.id}`}
                  value={`@ ${r.fullName} ${r.language ?? ""}`}
                  onSelect={() =>
                    go({
                      id: `repo:${r.fullName}`,
                      kind: "repo",
                      label: r.fullName,
                      href: `/${r.owner.login}/${r.name}`,
                      meta: r.language ?? undefined,
                    })
                  }
                >
                  <BookMarked />
                  <span className="min-w-0 flex-1 truncate font-mono tabular-nums">
                    {r.fullName}
                  </span>
                  <CommandShortcut>
                    {r.language ?? formatRelativeTime(r.pushedAt)}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showSearch && (
            <CommandGroup
              heading={
                <span className="flex items-center justify-between">
                  <span>Issues & PRs</span>
                  {search.isFetching && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      searching…
                    </span>
                  )}
                </span>
              }
            >
              {(search.data ?? []).map((hit) => {
                const Icon =
                  hit.kind === "pr"
                    ? GitPullRequest
                    : hit.state === "open"
                      ? CircleDot
                      : CheckCircle2;
                return (
                  <CommandItem
                    key={`hit-${hit.id}`}
                    value={`${hit.repoFullName} #${hit.number} ${hit.title}`}
                    onSelect={() =>
                      go({
                        id: `${hit.kind}:${hit.repoFullName}#${hit.number}`,
                        kind: hit.kind,
                        label: hit.title,
                        href: hit.href,
                        meta: `${hit.repoFullName} · #${hit.number}`,
                      })
                    }
                  >
                    <Icon
                      className={cn(
                        hit.state === "open" ? "text-success" : "text-muted-foreground",
                      )}
                    />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      #{hit.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                    <CommandShortcut>{hit.repoFullName}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}

function RecentIcon({ kind }: { kind: RecentItem["kind"] }) {
  if (kind === "pr") return <GitPullRequest />;
  if (kind === "issue") return <CircleDot />;
  if (kind === "action") return <CommandIcon />;
  if (kind === "repo") return <BookMarked />;
  return <CommandIcon />;
}
