import {
  CodeIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, CircleDot, CircleSlash, GitBranch } from "lucide-react";
import { type MouseEvent, memo, type ReactNode } from "react";

import { OpenInGithubLink } from "@/app/components/OpenInGithubLink";
import { RepoMark } from "@/app/components/shell/RepoMark";
import {
  type OpenMode,
  type PickerData,
  type PickerItem,
  PickerLabel,
  type PickerStatus,
  SiblingPicker,
} from "@/app/components/shell/SiblingPicker";
import { TONE_CLASS, useTabDisplay } from "@/app/components/shell/TabStrip";
import { Button } from "@/app/components/ui/button";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { repoIssuesQueryOptions } from "@/app/features/issues/hooks";
import { PrStateIcon } from "@/app/features/pulls/components/PrStatePill";
import { pullsQueryOptions } from "@/app/features/pulls/hooks";
import { useYourRepositories } from "@/app/hooks/sidebarRepositories";
import { useRepo } from "@/app/hooks/useRepo";
import { repoBranchesQueryOptions } from "@/app/hooks/useRepoBranches";
import {
  type Breadcrumbs,
  branchOf,
  breadcrumbsFor,
  repoSwitchHref,
  sectionHref,
  siblingItemHref,
  withBranch,
} from "@/app/lib/breadcrumbs";
import { cn } from "@/app/lib/cn";
import { navigateTab, openInNewTab, openToSide } from "@/app/lib/tabActions";
import { getTabMeta, type RepoSection } from "@/app/lib/tabMeta";
import { useAuthStore } from "@/app/stores/auth";
import { hrefPathname, type Island, selectedTab, type Tab } from "@/app/workspace/model";

// ─── BreadcrumbRow ─────────────────────────────────────────────────────────
//
// The island's "you are here" line, under its tabs:
//
//   [mark] owner / repo ⌄ › Section ⌄ › #n Title ⌄        ⎇ branch ⌄  ↗
//
// Crumbs are links that navigate the island's selected tab (⇧-click new tab
// and ⌥-click to the side come from TabShortcuts, like any in-app link).
// Each chevron lists the crumb's siblings (SiblingPicker). The branch chip
// shows on branch-aware pages only. Unfocused islands dim the row; narrow
// islands (container ≤480px) drop the owner and the item title.

const SECTIONS: readonly { id: RepoSection; label: string; icon: typeof CodeIcon }[] = [
  { id: "code", label: "Code", icon: CodeIcon },
  { id: "commits", label: "Commits", icon: GitCommitIcon },
  { id: "pulls", label: "Pull requests", icon: GitPullRequestIcon },
  { id: "issues", label: "Issues", icon: IssueOpenedIcon },
  { id: "actions", label: "Actions", icon: PlayIcon },
];

export const BreadcrumbRow = memo(function BreadcrumbRow({
  island,
  focused,
}: {
  island: Island;
  focused: boolean;
}) {
  const tab = selectedTab(island);
  const crumbs = breadcrumbsFor(tab.href);
  const branch = branchOf(tab.href);

  const open = (href: string, mode: OpenMode) => {
    if (mode === "tab") openInNewTab(href, { islandId: island.id });
    else if (mode === "side") openToSide(href, island.id);
    else navigateTab(tab, href);
  };

  return (
    <div
      data-link-menu="off"
      data-breadcrumbs
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 pr-1.5 pl-2 text-ui text-muted-foreground transition-opacity duration-150",
        !focused && "opacity-65",
      )}
    >
      <nav
        aria-label="Location"
        className="flex min-w-0 flex-1 items-center gap-px overflow-hidden"
      >
        {crumbs ? <RepoTrail tab={tab} crumbs={crumbs} open={open} /> : <PageCrumb tab={tab} />}
      </nav>
      {crumbs && branch && (
        <BranchChip tab={tab} repo={crumbs.repo} branch={branch.branch} open={open} />
      )}
      <OpenInGithubLink href={tab.href} />
    </div>
  );
});

type Open = (href: string, mode: OpenMode) => void;

// ─── Crumbs ────────────────────────────────────────────────────────────────

function RepoTrail({ tab, crumbs, open }: { tab: Tab; crumbs: Breadcrumbs; open: Open }) {
  const pathname = hrefPathname(tab.href);
  const [owner, name] = crumbs.repo.split("/") as [string, string];
  const section = SECTIONS.find((s) => s.id === crumbs.section)!;
  // Anything deeper than the section's own list is an item: a PR, an
  // issue, a commit, a run, or a file in Code.
  const filePath =
    crumbs.section === "code"
      ? new URL(tab.href, "https://x.invalid").searchParams.get("path")
      : null;
  const atSection =
    !filePath && (pathname === crumbs.sectionHref || pathname === `/${crumbs.repo}`);

  return (
    <>
      <CrumbGroup className="max-w-[45%]">
        <Crumb href={crumbs.repoHref} current={false} open={open}>
          <RepoMark repo={crumbs.repo} size="sm" />
          <span className="min-w-0 truncate">
            <span className="text-(--color-fg-faint) @max-[480px]:hidden">{owner} / </span>
            {name}
          </span>
        </Crumb>
        <RepoPicker tab={tab} repo={crumbs.repo} open={open} />
      </CrumbGroup>
      <Separator />
      <CrumbGroup>
        <Crumb href={crumbs.sectionHref} current={atSection} open={open}>
          <span className="truncate">{section.label}</span>
        </Crumb>
        <SiblingPicker
          label={`${name} sections`}
          placeholder="Go to section…"
          items={SECTIONS.map((s) => ({
            href: sectionHref(crumbs.repo, s.id),
            text: s.label,
            current: s.id === crumbs.section,
            content: (
              <>
                <s.icon aria-hidden size={16} className="text-muted-foreground" />
                <PickerLabel>{s.label}</PickerLabel>
              </>
            ),
          }))}
          onPick={open}
        />
      </CrumbGroup>
      {!atSection && (
        <>
          <Separator />
          <CrumbGroup className="min-w-18 shrink">
            <ItemCrumb tab={tab} item={crumbs.item} filePath={filePath} />
            {crumbs.item && (
              <ItemPicker tab={tab} repo={crumbs.repo} item={crumbs.item} open={open} />
            )}
          </CrumbGroup>
        </>
      )}
    </>
  );
}

/** App-wide pages (Inbox, profiles): one crumb naming the page. */
function PageCrumb({ tab }: { tab: Tab }) {
  const meta = getTabMeta(hrefPathname(tab.href));
  const Icon = meta.icon;
  return (
    <span
      aria-current="page"
      className="flex h-6 min-w-0 items-center gap-1.5 px-1.5 font-medium text-foreground"
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function CrumbGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex min-w-0 shrink-0 items-center rounded-md transition-colors hover:bg-accent/60",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Separator() {
  return (
    <span aria-hidden className="shrink-0 px-0.5 text-(--color-fg-faint) select-none">
      ›
    </span>
  );
}

/**
 * A link to `href` that navigates the island's tab. Modified clicks keep
 * link semantics: ⇧/⌥ are handled globally (TabShortcuts), ⌘/Ctrl and
 * middle-click go to the browser.
 */
function Crumb({
  href,
  current,
  open,
  children,
}: {
  href: string;
  current: boolean;
  open: Open;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!current) open(href, "here");
  };
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1.5 rounded-md pr-1 pl-1.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        current && "font-medium text-foreground",
      )}
    >
      {children}
    </a>
  );
}

function ItemCrumb({
  tab,
  item,
  filePath,
}: {
  tab: Tab;
  item: Breadcrumbs["item"];
  filePath: string | null;
}) {
  const display = useTabDisplay(tab.href, tab.id);
  let content: ReactNode;
  if (item) {
    // The title is known once the page, a list, or a past visit has seen it.
    const known = !!display.prefix;
    content = (
      <>
        <span className="shrink-0 font-mono text-caption text-(--color-fg-faint)">
          #{item.number}
        </span>
        {known ? (
          <span className="min-w-0 truncate @max-[480px]:hidden">{display.label}</span>
        ) : (
          <SkeletonGroup label="Loading title" className="@max-[480px]:hidden">
            <Skeleton className="h-3 w-36" />
          </SkeletonGroup>
        )}
      </>
    );
  } else {
    content = (
      <span className={cn("min-w-0 truncate", filePath && "font-mono text-code")}>
        {filePath ? filePath.split("/").pop() : display.label}
      </span>
    );
  }
  return (
    <span
      aria-current="page"
      title={filePath ?? display.title}
      className="flex h-6 min-w-0 items-center gap-1.5 pr-1 pl-1.5 font-medium text-foreground"
    >
      {content}
    </span>
  );
}

// ─── Remote pickers ────────────────────────────────────────────────────────

/** Loading only before anything is cached; failures only matter with nothing to show. */
function statusOf(q: { isPending: boolean; isError: boolean }, count: number): PickerStatus {
  if (count > 0) return "ready";
  if (q.isError) return "error";
  return q.isPending ? "loading" : "ready";
}

function RepoPicker({ tab, repo, open }: { tab: Tab; repo: string; open: Open }) {
  return (
    <SiblingPicker
      label="Other repositories"
      placeholder="Find a repository…"
      load={(render) => <RepoItems tab={tab} repo={repo} render={render} />}
      onPick={open}
    />
  );
}

type Render = (data: PickerData) => ReactNode;

function RepoItems({ tab, repo, render }: { tab: Tab; repo: string; render: Render }) {
  return render(useRepoItems(tab, repo));
}

function PullItems(p: { tab: Tab; repo: string; current: number; render: Render }) {
  return p.render(usePullItems(p.tab, p.repo, p.current));
}

function IssueItems(p: { tab: Tab; repo: string; current: number; render: Render }) {
  return p.render(useIssueItems(p.tab, p.repo, p.current));
}

function BranchItems(p: {
  tab: Tab;
  repo: string;
  defaultBranch: string | undefined;
  shown: string | null | undefined;
  actions: boolean;
  render: Render;
}) {
  return p.render(useBranchItems(p.tab, p.repo, p.defaultBranch, p.shown, p.actions));
}

/**
 * Your repos, shared with the sidebar's list (same query), grouped by owner
 * with the current repo's owner first. The current repo is always listed.
 */
function useRepoItems(tab: Tab, repo: string): PickerData {
  const list = useYourRepositories();
  const names = list.items.map((r) => r.full_name);
  if (!names.some((n) => n.toLowerCase() === repo.toLowerCase())) names.unshift(repo);
  const owner = repo.split("/")[0]!;
  const owners = [owner, ...new Set(names.map((n) => n.split("/")[0]!))].filter(
    (o, i, all) => all.indexOf(o) === i,
  );
  const items = owners.flatMap((o) =>
    names
      .filter((n) => n.split("/")[0] === o)
      .map((n) => ({
        href: repoSwitchHref(tab.href, n),
        text: n,
        group: o,
        current: n.toLowerCase() === repo.toLowerCase(),
        content: (
          <>
            <RepoMark repo={n} size="sm" />
            <PickerLabel>{n.split("/")[1]}</PickerLabel>
          </>
        ),
      })),
  );
  return {
    items: list.items.length ? items : [],
    status: statusOf(list, list.items.length),
    onRetry: list.refetch,
  };
}

function ItemPicker({
  tab,
  repo,
  item,
  open,
}: {
  tab: Tab;
  repo: string;
  item: NonNullable<Breadcrumbs["item"]>;
  open: Open;
}) {
  const isPull = item.kind === "pull";
  return (
    <SiblingPicker
      label={isPull ? "Other pull requests" : "Other issues"}
      placeholder={isPull ? "Find a pull request…" : "Find an issue…"}
      load={(render) =>
        isPull ? (
          <PullItems tab={tab} repo={repo} current={item.number} render={render} />
        ) : (
          <IssueItems tab={tab} repo={repo} current={item.number} render={render} />
        )
      }
      onPick={open}
    />
  );
}

type Row = { number: number; title: string; icon: ReactNode };

function itemRows(tab: Tab, rows: Row[], current: number): PickerItem[] {
  return rows.map((r) => ({
    href: siblingItemHref(tab.href, r.number),
    text: `#${r.number} ${r.title}`,
    current: r.number === current,
    content: (
      <>
        {r.icon}
        <span className="shrink-0 font-mono text-caption text-(--color-fg-faint)">#{r.number}</span>
        <PickerLabel>{r.title}</PickerLabel>
      </>
    ),
  }));
}

/** Open PRs, newest first: the PR list page's default query, so they share a cache. */
function usePullItems(tab: Tab, repo: string, current: number) {
  const [owner, name] = repo.split("/") as [string, string];
  const signedIn = useAuthStore((s) => !!s.token);
  const query = useInfiniteQuery({
    ...pullsQueryOptions(owner, name, { state: "open", sort: "newest" }),
    enabled: signedIn,
  });
  const rows: Row[] = (query.data?.pages.flat() ?? []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    icon: (
      <PrStateIcon
        state={
          pr.pull_request?.merged_at
            ? "merged"
            : pr.state === "closed"
              ? "closed"
              : pr.draft
                ? "draft"
                : "open"
        }
      />
    ),
  }));
  return useWithCurrent(tab, query, rows, current);
}

/** Recently updated issues: the issue list page's query. */
function useIssueItems(tab: Tab, repo: string, current: number) {
  const [owner, name] = repo.split("/") as [string, string];
  const signedIn = useAuthStore((s) => !!s.token);
  const query = useQuery({ ...repoIssuesQueryOptions(owner, name), enabled: signedIn });
  const rows: Row[] = (query.data ?? []).map((issue) => ({
    number: issue.number,
    title: issue.title,
    icon:
      issue.state === "open" ? (
        <CircleDot aria-label="Open" className="size-4 text-(--color-success)" />
      ) : issue.state_reason === "not_planned" ? (
        <CircleSlash
          aria-label="Closed as not planned"
          className="size-4 text-(--color-fg-faint)"
        />
      ) : (
        <CheckCircle2 aria-label="Closed" className="size-4 text-(--color-fg-faint)" />
      ),
  }));
  return useWithCurrent(tab, query, rows, current);
}

/**
 * The page you're on stays in its own list (first) even when the list
 * doesn't contain it, e.g. a merged PR among open ones.
 */
function useWithCurrent(
  tab: Tab,
  query: { isPending: boolean; isError: boolean; refetch: () => unknown },
  rows: Row[],
  current: number,
): PickerData {
  const display = useTabDisplay(tab.href, tab.id);
  if (rows.length && !rows.some((r) => r.number === current)) {
    const Icon = display.icon;
    rows = [
      {
        number: current,
        title: display.prefix ? display.label : "",
        icon: <Icon aria-hidden className={cn("size-4", TONE_CLASS[display.tone])} />,
      },
      ...rows,
    ];
  }
  return {
    items: itemRows(tab, rows, current),
    status: statusOf(query, rows.length),
    onRetry: () => void query.refetch(),
  };
}

// ─── Branch ────────────────────────────────────────────────────────────────

function BranchChip({
  tab,
  repo,
  branch,
  open,
}: {
  tab: Tab;
  repo: string;
  branch: string | null;
  open: Open;
}) {
  const [owner, name] = repo.split("/") as [string, string];
  const repoQuery = useRepo(owner, name);
  const defaultBranch = repoQuery.data?.default_branch;
  const actions = hrefPathname(tab.href).endsWith("/actions");
  // Actions without a branch filter shows every branch; other pages show the default.
  const shown = branch ?? (actions ? null : defaultBranch);

  return (
    <SiblingPicker
      label="Switch branch"
      placeholder="Find a branch…"
      load={(render) => (
        <BranchItems
          tab={tab}
          repo={repo}
          defaultBranch={defaultBranch}
          shown={shown}
          actions={actions}
          render={render}
        />
      )}
      onPick={open}
      trigger={
        <Button
          variant="ghost"
          size="xs"
          aria-label={
            shown === undefined
              ? "Switch branch"
              : `Branch: ${shown ?? "all branches"}. Switch branch`
          }
          className="max-w-48 shrink-0 gap-1.5 px-1.5 font-mono font-normal text-caption text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          <GitBranch data-icon="inline-start" />
          {shown === undefined && repoQuery.isError ? (
            <span className="font-sans @max-[480px]:hidden">Branch</span>
          ) : shown === undefined ? (
            <SkeletonGroup label="Loading branch">
              <Skeleton className="h-3 w-14" />
            </SkeletonGroup>
          ) : (
            <span className="min-w-0 truncate @max-[480px]:hidden">
              {shown ?? <span className="font-sans">All branches</span>}
            </span>
          )}
          <ChevronDown data-icon="inline-end" className="text-(--color-fg-faint)" />
        </Button>
      }
    />
  );
}

/** The repo's branches, default first; Actions adds "All branches" (no filter). */
function useBranchItems(
  tab: Tab,
  repo: string,
  defaultBranch: string | undefined,
  shown: string | null | undefined,
  actions: boolean,
): PickerData {
  const [owner, name] = repo.split("/") as [string, string];
  const signedIn = useAuthStore((s) => !!s.token);
  const query = useQuery({ ...repoBranchesQueryOptions(owner, name), enabled: signedIn });
  const names = [...new Set([defaultBranch, ...(query.data ?? []).map((b) => b.name)])].filter(
    (n): n is string => !!n,
  );
  const items: PickerItem[] = names.map((n) => ({
    href: withBranch(tab.href, n === defaultBranch && !actions ? null : n),
    text: n,
    current: n === shown,
    content: (
      <>
        <GitBranch aria-hidden className="text-muted-foreground" />
        <PickerLabel className="font-mono text-code">{n}</PickerLabel>
      </>
    ),
  }));
  if (actions) {
    items.unshift({
      href: withBranch(tab.href, null),
      text: "All branches",
      current: shown === null,
      content: <PickerLabel>All branches</PickerLabel>,
    });
  }
  return {
    items: query.data ? items : [],
    status: statusOf(query, query.data?.length ?? 0),
    onRetry: () => void query.refetch(),
  };
}
