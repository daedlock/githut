import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookMarked,
  CheckCircle2,
  CircleDot,
  Code2,
  Command as CommandIcon,
  FilePlus,
  FileText,
  Folder,
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
  rankRepoPaths,
  useCodeSearch,
  useCommandPaletteSearch,
  useRecentItems,
  useRepoTree,
} from "@/app/hooks/useCommandPaletteItems";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useRepos } from "@/app/hooks/useRepos";
import { track } from "@/app/lib/analytics";
import { logout } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { clearRecentItems, pushRecentItem, type RecentItem } from "@/app/lib/recentItems";
import { getTabMeta } from "@/app/lib/tabMeta";
import { THEME_OPTIONS } from "@/app/lib/themeCatalog";
import { formatRelativeTime } from "@/app/lib/time";
import { useCommandPalette, useCommandPaletteStore } from "@/app/stores/commandPalette";
import { useSettingsStore } from "@/app/stores/settings";
import { hrefToTabId, useTabsStore } from "@/app/stores/tabs";
import { useThemeStore } from "@/app/stores/theme";

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

// ─── Command builder ─────────────────────────────────────────────────────────
// Returns a flat array of all available commands. cmdk handles the filtering.

/**
 * Navigate to an href — through the tab system if enabled, or direct router
 * navigation if tabs are off.
 */
function openTabOrNavigate(href: string, navigate: ReturnType<typeof useNavigate>) {
  if (useSettingsStore.getState().tabsEnabled) {
    const id = hrefToTabId(href);
    const meta = getTabMeta(id);
    useTabsStore.getState().openTab(href, {
      label: meta.label,
      sublabel: meta.sublabel,
      icon: meta.icon.displayName ?? meta.icon.name ?? "File",
    });
    // Opening a different search result in the same page tab (for example
    // /code?path=a.ts → /code?path=b.ts) keeps the same activeTabId, so the
    // tab-sync subscription will not fire. Navigate directly as well so
    // search-param-only tab updates are applied immediately.
    navigate({ to: href });
    return;
  }

  navigate({ to: href });
}

function repoCodeHref(
  owner: string,
  repo: string,
  path: string,
  kind: "file" | "dir",
  query?: string,
) {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (kind === "file") params.set("view", "blob");
  if (query?.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return `/${owner}/${repo}/code${qs ? `?${qs}` : ""}`;
}

function buildCommands(
  close: () => void,
  repoContext: RepoContext,
  navigate: ReturnType<typeof useNavigate>,
): { actions: PaletteCommand[]; themes: PaletteCommand[] } {
  const goTo = (path: string) => () => {
    close();
    openTabOrNavigate(path, navigate);
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

  const themes: PaletteCommand[] = THEME_OPTIONS.map((t) => ({
    id: `theme:${t.id}`,
    label: t.name,
    icon: PaletteIcon,
    keywords: ["theme", "appearance", "color", ...t.keywords],
    run: () => {
      useThemeStore.getState().setTheme(t.palette, t.preference);
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

  // ⌘K + vim-style navigation shortcuts — all go through openTab
  const shortcuts = useMemo(
    () => ({
      "⌘k": toggle,
      "g h": () => openTabOrNavigate("/", navigate),
      "g i": () => {
        if (repoContext)
          openTabOrNavigate(`/${repoContext.owner}/${repoContext.repo}/issues`, navigate);
      },
      "g p": () => {
        if (repoContext)
          openTabOrNavigate(`/${repoContext.owner}/${repoContext.repo}/pulls`, navigate);
      },
      "g c": () => {
        if (repoContext)
          openTabOrNavigate(`/${repoContext.owner}/${repoContext.repo}/code`, navigate);
      },
    }),
    [toggle, repoContext, navigate],
  );
  useKeybindings(shortcuts);

  // Query + mode
  const [query, setQuery] = useState("");
  const mode = parsePaletteQuery(query);
  const hasQuery = query.trim().length > 0;

  // Data sources
  const recent = useRecentItems(5);
  const repos = useRepos();
  const issueQuery = mode.kind === "issues" ? mode.query : "";
  const fileQuery = mode.kind === "files" ? mode.query : "";
  const issueSearchEnabled = mode.kind === "issues";
  const codeSearchEnabled = mode.kind === "files";
  const search = useCommandPaletteSearch(issueQuery, {
    enabled: issueSearchEnabled,
    repoContext: repoContext,
  });
  const repoTree = useRepoTree(repoContext?.owner ?? "", repoContext?.repo ?? "", "HEAD", {
    enabled: !!repoContext && codeSearchEnabled && fileQuery.length > 0,
  });
  const fileResults = useMemo(
    () => rankRepoPaths(repoTree.data, fileQuery, 12),
    [repoTree.data, fileQuery],
  );
  const codeSearch = useCodeSearch(fileQuery, repoContext, { enabled: codeSearchEnabled });
  const repoItems = useMemo(() => {
    const data = repos.data ?? [];
    return hasQuery ? data : data.slice(0, 50);
  }, [repos.data, hasQuery]);
  const { actions, themes } = useMemo(
    () => buildCommands(close, repoContext, navigate),
    [close, repoContext, navigate],
  );

  // Track opens + reset query on close.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) track("command_palette_opened", { hasRepo: !!repoContext });
    wasOpen.current = open;
    if (!open) setQuery("");
  }, [open, repoContext]);

  // Navigation helper — push to recents + open tab
  const go = useCallback(
    (item: Omit<RecentItem, "visitedAt">) => {
      track("command_palette_result_selected", { kind: item.kind });
      void pushRecentItem(item);
      close();
      openTabOrNavigate(item.href, navigate);
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
        href: `/${repoContext.owner}/${repoContext.repo}/issues/${num}`,
        meta: `${repoContext.owner}/${repoContext.repo}`,
      });
    },
    [repoContext, go],
  );

  // Section visibility
  const numberMode = mode.kind === "number";
  const fileMode = mode.kind === "files";
  const showRecent = mode.kind === "all" && recent.length > 0 && !hasQuery;
  const showCommands = mode.kind === "all" || mode.kind === "actions";
  const showThemes = mode.kind === "actions" || (mode.kind === "all" && hasQuery);
  const showRepos = mode.kind === "all" || mode.kind === "repos";
  const showFilePaths =
    fileMode &&
    !!repoContext &&
    (fileResults.length > 0 || repoTree.isFetching || repoTree.isError);
  const showCodeMatches =
    fileMode &&
    !!repoContext &&
    fileQuery.length >= 3 &&
    ((codeSearch.data?.length ?? 0) > 0 || codeSearch.isFetching || codeSearch.isError);
  const showSearch = issueSearchEnabled && issueQuery.length >= 2;
  const shouldFilter = mode.kind === "all" || mode.kind === "actions" || mode.kind === "repos";
  const searchAnnouncement =
    mode.kind === "issues"
      ? search.isFetching
        ? "Searching issues and pull requests…"
        : `${search.data?.length ?? 0} issue and pull request results`
      : mode.kind === "files"
        ? repoTree.isFetching || codeSearch.isFetching
          ? "Searching files and code…"
          : `${fileResults.length + (codeSearch.data?.length ?? 0)} file and code results`
        : "";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search, navigate, or run a command"
      shouldFilter={shouldFilter}
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
              ? "Search, > commands, @ repos, # issues, / code…"
              : "Search, > commands, @ repos, # issues…"
          }
        />
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {searchAnnouncement}
        </span>

        <CommandList>
          <CommandEmpty>
            {numberMode
              ? repoContext
                ? `Press ↵ to open #${mode.number} in ${repoContext.owner}/${repoContext.repo}`
                : "Open a repo first to jump to an issue number."
              : fileMode && !repoContext
                ? "Open a repo first to search files and code."
                : mode.kind === "issues" && mode.query.length < 2
                  ? "Type at least 2 characters to search issues and PRs."
                  : fileMode && fileQuery.length < 1
                    ? "Type a file path or code term."
                    : mode.kind === "all" && hasQuery
                      ? "No commands or repos found. Use # for issues/PRs or / for code."
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
                      (item.kind === "repo" ||
                        item.kind === "issue" ||
                        item.kind === "pr" ||
                        item.kind === "file") &&
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

          {/* ── File paths ── */}
          {showFilePaths && repoContext && (
            <CommandGroup
              forceMount
              heading={
                <span className="flex items-center justify-between">
                  <span>Files</span>
                  {repoTree.isFetching && (
                    <span className="animate-pulse text-micro uppercase tracking-widest text-muted-foreground">
                      indexing…
                    </span>
                  )}
                </span>
              }
            >
              {repoTree.isFetching && fileResults.length === 0 && (
                <StatusCommandItem icon={Folder} label="Indexing repository tree…" />
              )}
              {repoTree.isError && (
                <StatusCommandItem icon={Folder} label="Could not index repository files." />
              )}
              {fileResults.map((hit) => (
                <CommandItem
                  key={`file-${hit.sha}-${hit.path}`}
                  forceMount
                  value={`/ ${hit.path} ${repoContext.owner}/${repoContext.repo}`}
                  onSelect={() =>
                    go({
                      id: `file:${repoContext.owner}/${repoContext.repo}:${hit.path}`,
                      kind: "file",
                      label: hit.path,
                      href: repoCodeHref(repoContext.owner, repoContext.repo, hit.path, hit.kind),
                      meta: `${repoContext.owner}/${repoContext.repo}`,
                    })
                  }
                >
                  {hit.kind === "dir" ? <Folder /> : <FileText />}
                  <span className="min-w-0 flex-1 truncate font-mono text-caption">{hit.path}</span>
                  <CommandShortcut>{hit.kind === "dir" ? "folder" : "file"}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* ── Code matches ── */}
          {showCodeMatches && repoContext && (
            <CommandGroup
              forceMount
              heading={
                <span className="flex items-center justify-between">
                  <span>Code matches</span>
                  {codeSearch.isFetching && (
                    <span className="animate-pulse text-micro uppercase tracking-widest text-muted-foreground">
                      searching…
                    </span>
                  )}
                </span>
              }
            >
              {codeSearch.isFetching && !codeSearch.data?.length && (
                <StatusCommandItem icon={Code2} label="Searching code…" />
              )}
              {codeSearch.isError && (
                <StatusCommandItem icon={Code2} label="Could not search code." />
              )}
              {(codeSearch.data ?? []).map((hit) => (
                <CommandItem
                  key={`code-${hit.id}`}
                  forceMount
                  value={`/ code ${hit.path} ${hit.name} ${hit.repositoryFullName}`}
                  onSelect={() =>
                    go({
                      id: `file:${hit.repositoryFullName}:${hit.path}`,
                      kind: "file",
                      label: hit.path,
                      href: repoCodeHref(
                        repoContext.owner,
                        repoContext.repo,
                        hit.path,
                        "file",
                        fileQuery,
                      ),
                      meta: hit.repositoryFullName,
                    })
                  }
                >
                  <Code2 />
                  <span className="min-w-0 flex-1 truncate font-mono text-caption">{hit.path}</span>
                  <CommandShortcut>{hit.repositoryFullName}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* ── Repos ── */}
          {showRepos && repoItems.length > 0 && (
            <CommandGroup heading="Repos">
              {repoItems.map((r) => (
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
              forceMount
              heading={
                <span className="flex items-center justify-between">
                  <span>
                    {repoContext && mode.kind === "issues"
                      ? "Current repo issues & PRs"
                      : "Issues & PRs"}
                  </span>
                  {search.isFetching && (
                    <span className="animate-pulse text-micro uppercase tracking-widest text-muted-foreground">
                      searching…
                    </span>
                  )}
                </span>
              }
            >
              {search.isFetching && !search.data?.length && (
                <StatusCommandItem icon={CircleDot} label="Searching issues and PRs…" />
              )}
              {search.isError && (
                <StatusCommandItem icon={CircleDot} label="Could not search issues and PRs." />
              )}
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
                    forceMount
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
          <FooterHint keys={["#"]} label="issues" />
          {repoContext && <FooterHint keys={["/"]} label="code" />}
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
      onSelect={() => {
        track("command_palette_command_selected", { id: cmd.id });
        cmd.run();
      }}
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

function StatusCommandItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <CommandItem forceMount disabled value={`status ${label}`}>
      <Icon />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
    </CommandItem>
  );
}

const RECENT_ICONS: Record<string, LucideIcon> = {
  pr: GitPullRequest,
  issue: CircleDot,
  action: CommandIcon,
  repo: BookMarked,
  file: FileText,
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
