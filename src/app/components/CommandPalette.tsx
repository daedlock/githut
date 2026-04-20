import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookMarked,
  CheckCircle2,
  CircleDot,
  Code2,
  Command as CommandIcon,
  FilePlus,
  GitPullRequest,
  Home,
  LogOut,
  type LucideIcon,
  Palette as PaletteIcon,
  Settings,
  Trash2,
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
import { Kbd } from "@/app/components/ui/kbd";
import {
  parsePaletteQuery,
  useCommandPaletteSearch,
  useRecentItems,
} from "@/app/hooks/useCommandPaletteItems";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useRepos } from "@/app/hooks/useRepos";
import { logout } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { clearRecentItems, pushRecentItem, type RecentItem } from "@/app/lib/recentItems";
import { formatRelativeTime } from "@/app/lib/time";
import { useCommandPalette, useCommandPaletteStore } from "@/app/stores/commandPalette";
import { type Palette, useThemeStore } from "@/app/stores/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type PaletteCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
};

type RepoContext = { owner: string; repo: string } | null;

// ─── Theme definitions ───────────────────────────────────────────────────────
// Mirrors ThemePicker CARDS — kept here to avoid coupling the palette to the
// settings page. Each theme becomes its own command so you can type "lagoon"
// or ">ember" and switch instantly.

const THEME_DEFS: readonly {
  id: string;
  name: string;
  palette: Palette;
  preference: "light" | "dark";
  keywords: string[];
}[] = [
  {
    id: "stone-light",
    name: "Stone Light",
    palette: "stone",
    preference: "light",
    keywords: ["warm", "daylight", "default"],
  },
  {
    id: "stone-dark",
    name: "Stone Dark",
    palette: "stone",
    preference: "dark",
    keywords: ["warm", "night", "default"],
  },
  {
    id: "ember-light",
    name: "Ember Light",
    palette: "ember",
    preference: "light",
    keywords: ["parchment", "ivory"],
  },
  {
    id: "ember",
    name: "Ember",
    palette: "ember",
    preference: "dark",
    keywords: ["coral", "graphite", "spark"],
  },
  {
    id: "ember-soft",
    name: "Ember Soft",
    palette: "ember-soft",
    preference: "dark",
    keywords: ["coral", "soft", "lifted"],
  },
  {
    id: "dune",
    name: "Dune",
    palette: "dune",
    preference: "dark",
    keywords: ["amber", "charcoal", "earth"],
  },
  {
    id: "haze",
    name: "Haze",
    palette: "haze",
    preference: "dark",
    keywords: ["lavender", "mauve", "purple"],
  },
  {
    id: "lagoon",
    name: "Lagoon",
    palette: "lagoon",
    preference: "dark",
    keywords: ["coral", "teal", "reef"],
  },
  {
    id: "matrix",
    name: "Matrix",
    palette: "matrix",
    preference: "dark",
    keywords: ["green", "phosphor", "hacker"],
  },
  {
    id: "moss",
    name: "Moss",
    palette: "moss",
    preference: "dark",
    keywords: ["forest", "earthy", "green"],
  },
  {
    id: "sagecream",
    name: "Sagecream",
    palette: "sagecream",
    preference: "dark",
    keywords: ["sage", "cream", "neutral"],
  },
];

// ─── Command builder ─────────────────────────────────────────────────────────
// Returns a flat array of all available commands. cmdk handles the filtering.

function buildCommands(
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  repoContext: RepoContext,
): { actions: PaletteCommand[]; themes: PaletteCommand[] } {
  const goTo = (path: string) => () => {
    close();
    navigate({ to: path });
  };
  const r = repoContext;
  const base = r ? `/${r.owner}/${r.repo}` : null;
  const repoKw = r ? [r.owner, r.repo] : [];

  const actions: PaletteCommand[] = [
    {
      id: "nav:home",
      label: "Go home",
      icon: Home,
      keywords: ["inbox", "notifications"],
      shortcut: "g h",
      run: goTo("/"),
    },
    {
      id: "nav:settings",
      label: "Settings",
      icon: Settings,
      keywords: ["preferences", "theme", "account"],
      run: goTo("/settings"),
    },
    ...(r && base
      ? [
          {
            id: "nav:issues",
            label: "Issues",
            icon: CircleDot,
            keywords: ["bugs", ...repoKw],
            shortcut: "g i",
            run: goTo(`${base}/issues`),
          },
          {
            id: "nav:pulls",
            label: "Pull requests",
            icon: GitPullRequest,
            keywords: ["prs", "merge", ...repoKw],
            shortcut: "g p",
            run: goTo(`${base}/pulls`),
          },
          {
            id: "nav:code",
            label: "Code",
            icon: Code2,
            keywords: ["source", "files", "tree", ...repoKw],
            shortcut: "g c",
            run: goTo(`${base}/code`),
          },
          {
            id: "action:new-issue",
            label: `New issue in ${r.owner}/${r.repo}`,
            icon: FilePlus,
            keywords: ["create", "bug", "report"],
            run: goTo(`${base}/issues?new=1`),
          },
        ]
      : []),
    {
      id: "action:clear-recent",
      label: "Clear recent items",
      icon: Trash2,
      keywords: ["history", "reset"],
      run: () => {
        void clearRecentItems();
        close();
      },
    },
    {
      id: "action:sign-out",
      label: "Sign out",
      icon: LogOut,
      keywords: ["logout", "exit"],
      run: () => {
        close();
        logout();
      },
    },
  ];

  const themes: PaletteCommand[] = THEME_DEFS.map((t) => ({
    id: `theme:${t.id}`,
    label: t.name,
    icon: PaletteIcon,
    keywords: ["theme", "appearance", "color", ...t.keywords],
    run: () => {
      useThemeStore.getState().setPalette(t.palette);
      useThemeStore.getState().setPreference(t.preference);
      close();
    },
  }));

  return { actions, themes };
}

// ─── Component ───────────────────────────────────────────────────────────────

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

  // Repo context from URL
  const repoContext = useMemo<RepoContext>(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (["login", "settings", "playground", "w"].includes(parts[0]!)) return null;
    return { owner: parts[0]!, repo: parts[1]! };
  }, [pathname]);

  // ⌘K + vim-style navigation shortcuts
  const shortcuts = useMemo(
    () => ({
      "⌘k": toggle,
      "g h": () => navigate({ to: "/" }),
      "g i": () => {
        if (repoContext) navigate({ to: `/${repoContext.owner}/${repoContext.repo}/issues` });
      },
      "g p": () => {
        if (repoContext) navigate({ to: `/${repoContext.owner}/${repoContext.repo}/pulls` });
      },
      "g c": () => {
        if (repoContext) navigate({ to: `/${repoContext.owner}/${repoContext.repo}/code` });
      },
    }),
    [toggle, navigate, repoContext],
  );
  useKeybindings(shortcuts);

  // Query + mode
  const [query, setQuery] = useState("");
  const mode = parsePaletteQuery(query);
  const hasQuery = query.trim().length > 0;

  // Data sources
  const recent = useRecentItems(5);
  const repos = useRepos();
  const search = useCommandPaletteSearch(mode.kind === "all" ? mode.query : "");
  const { actions, themes } = useMemo(
    () => buildCommands(navigate, close, repoContext),
    [navigate, close, repoContext],
  );

  // Reset query on close
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Navigation helper — push to recents + navigate
  const go = useCallback(
    (item: Omit<RecentItem, "visitedAt">) => {
      void pushRecentItem(item);
      close();
      navigate({ to: item.href });
    },
    [close, navigate],
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

  // Section visibility
  const numberMode = mode.kind === "number";
  const showRecent = mode.kind === "all" && recent.length > 0 && !hasQuery;
  const showCommands = mode.kind === "all" || mode.kind === "actions";
  const showThemes = mode.kind === "actions" || (mode.kind === "all" && hasQuery);
  const showRepos = mode.kind === "all" || mode.kind === "repos";
  const showSearch = mode.kind === "all" && mode.query.length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search, navigate, or run a command"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: cmdk owns focus; we intercept Enter for number-mode jump */}
      <div
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
              ? "Search, > commands, @ repos, #123 issue…"
              : "Search, > commands, @ repos…"
          }
        />

        <CommandList>
          <CommandEmpty>
            {numberMode
              ? repoContext
                ? `Press ↵ to open #${mode.number} in ${repoContext.owner}/${repoContext.repo}`
                : "Open a repo first to jump to an issue number."
              : "No results found."}
          </CommandEmpty>

          {/* ── Recent ── */}
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

          {/* ── Commands ── */}
          {showCommands && (
            <CommandGroup heading="Commands">
              {actions.map((cmd) => (
                <CommandRow key={cmd.id} cmd={cmd} />
              ))}
            </CommandGroup>
          )}

          {/* ── Themes — only with a query or in > mode ── */}
          {showThemes && (
            <CommandGroup heading="Themes">
              {themes.map((cmd) => (
                <CommandRow key={cmd.id} cmd={cmd} />
              ))}
            </CommandGroup>
          )}

          {/* ── Repos ── */}
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
                  <CommandShortcut>{r.language ?? formatRelativeTime(r.pushedAt)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* ── Search results ── */}
          {showSearch && (
            <CommandGroup
              heading={
                <span className="flex items-center justify-between">
                  <span>Issues & PRs</span>
                  {search.isFetching && (
                    <span className="animate-pulse text-micro uppercase tracking-widest text-muted-foreground">
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
                    <span className="font-mono text-caption tabular-nums text-muted-foreground">
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

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 border-t border-border px-3 py-2">
          <FooterHint keys={["↵"]} label="select" />
          <FooterHint keys={["↑", "↓"]} label="navigate" />
          <span className="flex-1" />
          <FooterHint keys={[">"]} label="commands" />
          <FooterHint keys={["@"]} label="repos" />
          {repoContext && <FooterHint keys={["#"]} label="issue" />}
          <FooterHint keys={["esc"]} label="close" />
        </div>
      </div>
    </CommandDialog>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function CommandRow({ cmd }: { cmd: PaletteCommand }) {
  const Icon = cmd.icon;
  return (
    <CommandItem
      value={`> ${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
      onSelect={() => cmd.run()}
    >
      <Icon />
      <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
      {cmd.shortcut && (
        <CommandShortcut>
          <ShortcutKeys chord={cmd.shortcut} />
        </CommandShortcut>
      )}
    </CommandItem>
  );
}

const RECENT_ICONS: Record<string, LucideIcon> = {
  pr: GitPullRequest,
  issue: CircleDot,
  action: CommandIcon,
  repo: BookMarked,
};

function RecentIcon({ kind }: { kind: RecentItem["kind"] }) {
  const Icon = RECENT_ICONS[kind] ?? CommandIcon;
  return <Icon />;
}

function ShortcutKeys({ chord }: { chord: string }) {
  return (
    <span className="inline-flex items-center gap-0.75">
      {chord.split(" ").map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

function FooterHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <span className="text-micro">{label}</span>
    </span>
  );
}
