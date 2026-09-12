import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CircleDashed,
  GitPullRequest,
  GitPullRequestClosed,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Container } from "@/app/components/ui/Container";
import { Command, CommandGroup, CommandItem, CommandList } from "@/app/components/ui/command";
import {
  type ActiveFilter,
  FilterBar,
  type FilterFieldDef,
  FilterTrigger,
} from "@/app/components/ui/filter-bar";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PrRow } from "@/app/features/pulls/components/PrRow";
import { PrStateTab } from "@/app/features/pulls/components/PrStateTab";
import {
  type PullsFilters,
  type PullsSort,
  type PullsState,
  usePrBranchRefs,
  usePrCheckRollups,
  usePrReviewDecisions,
  usePulls,
  usePullsCounts,
} from "@/app/features/pulls/hooks";
import { buildPrTree } from "@/app/features/pulls/lib/buildPrTree";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { GroupedList } from "@/app/features/repo/components/GroupedList";
import { ListDisplayMenu } from "@/app/features/repo/components/ListDisplayMenu";
import { buildRepoFilterFields } from "@/app/features/repo/filterFields";
import { groupListItems } from "@/app/features/repo/listGrouping";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { useRepo } from "@/app/hooks/useRepo";
import { cn } from "@/app/lib/cn";
import { useListGrouping } from "@/app/stores/listGrouping";

export type PrListPageProps = {
  owner: string;
  repo: string;
  search: {
    state?: PullsState;
    draft?: "true" | "false";
    author?: string[];
    label?: string[];
    reviewer?: string[];
    assignee?: string[];
    excludeAuthor?: string[];
    excludeLabel?: string[];
    excludeReviewer?: string[];
    excludeAssignee?: string[];
    sort?: PullsSort;
  };
};

const SORT_OPTIONS: { value: PullsSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "comments", label: "Most commented" },
];

// ─── URL ↔ ActiveFilter mapping ────────────────────────────────────────────

type PrFieldId = "label" | "author" | "assignee" | "reviewer";

const FIELD_KEYS: Record<PrFieldId, { is: keyof PullsFilters; isNot: keyof PullsFilters }> = {
  label: { is: "label", isNot: "excludeLabel" },
  author: { is: "author", isNot: "excludeAuthor" },
  assignee: { is: "assignee", isNot: "excludeAssignee" },
  reviewer: { is: "reviewer", isNot: "excludeReviewer" },
};

function filtersToActive(f: PullsFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.draft) out.push({ fieldId: "draft", op: "is", value: f.draft });
  for (const id of Object.keys(FIELD_KEYS) as PrFieldId[]) {
    const inc = f[FIELD_KEYS[id].is];
    if (Array.isArray(inc)) {
      for (const v of inc) out.push({ fieldId: id, op: "is", value: v });
    }
    const exc = f[FIELD_KEYS[id].isNot];
    if (Array.isArray(exc)) {
      for (const v of exc) out.push({ fieldId: id, op: "is_not", value: v });
    }
  }
  return out;
}

function activeToPatch(active: ActiveFilter[]) {
  const arrays: Record<string, string[] | undefined> = {
    label: undefined,
    excludeLabel: undefined,
    author: undefined,
    excludeAuthor: undefined,
    assignee: undefined,
    excludeAssignee: undefined,
    reviewer: undefined,
    excludeReviewer: undefined,
  };
  let draft: "true" | "false" | undefined;
  for (const a of active) {
    if (a.fieldId === "draft") {
      draft = a.value as "true" | "false";
      continue;
    }
    const keys = FIELD_KEYS[a.fieldId as PrFieldId];
    if (!keys) continue;
    const slot = a.op === "is" ? keys.is : keys.isNot;
    arrays[slot] ??= [];
    arrays[slot].push(a.value);
  }
  return { ...arrays, draft };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function PrListPage({ owner, repo, search }: PrListPageProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const grouping = useListGrouping(owner, repo, "pulls");

  const filters: PullsFilters = {
    state: search.state ?? "open",
    draft: search.draft,
    author: search.author,
    label: search.label,
    reviewer: search.reviewer,
    assignee: search.assignee,
    excludeAuthor: search.excludeAuthor,
    excludeLabel: search.excludeLabel,
    excludeReviewer: search.excludeReviewer,
    excludeAssignee: search.excludeAssignee,
    sort: search.sort ?? "newest",
  };

  const pulls = usePulls(owner, repo, filters);
  const counts = usePullsCounts(owner, repo);
  const labelsQuery = useRepoLabels(owner, repo);
  const collaboratorsQuery = useRepoCollaborators(owner, repo);

  const items = useMemo(() => pulls.data?.pages.flat() ?? [], [pulls.data]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        pr.user?.login.toLowerCase().includes(q) ||
        pr.labels.some((l) => l.name.toLowerCase().includes(q)),
    );
  }, [items, searchText]);

  const currentState = (filters.state ?? "open") as PullsState;
  const prNumbers = useMemo(() => filtered.map((pr) => pr.number), [filtered]);
  const reviewDecisions = usePrReviewDecisions(owner, repo, prNumbers);
  const checkRollups = usePrCheckRollups(owner, repo, prNumbers);
  const branchRefs = usePrBranchRefs(owner, repo, prNumbers);
  const repoData = useRepo(owner, repo);
  const defaultBranch = repoData.data?.default_branch;

  const groups = useMemo(
    () => groupListItems(filtered, grouping.groupBy),
    [filtered, grouping.groupBy],
  );

  const labels = labelsQuery.data ?? [];
  const collaborators = collaboratorsQuery.data ?? [];

  const draftField = useMemo<FilterFieldDef>(
    () => ({
      id: "draft",
      label: "Draft",
      icon: CircleDashed,
      negatable: false,
      ValuePicker: DraftPicker,
      renderValue: (v) => <span className="font-sans">{v === "true" ? "Draft" : "Ready"}</span>,
    }),
    [],
  );

  const fields = useMemo<FilterFieldDef[]>(
    () => [draftField, ...buildRepoFilterFields({ labels, collaborators })],
    [draftField, labels, collaborators],
  );
  const active = filtersToActive(filters);
  useListNavigation(!pulls.isPending && !pulls.isError);

  const onActiveChange = useCallback(
    (next: ActiveFilter[]) => {
      const patch = activeToPatch(next);
      navigate({
        to: "/$owner/$repo/pulls",
        params: { owner, repo },
        search: (prev) => ({ ...prev, ...patch }),
      });
    },
    [navigate, owner, repo],
  );

  return (
    <Container size="lg" className="py-6">
      <h1 className="sr-only">Pull requests</h1>
      <div className="mb-2 flex flex-col gap-2">
        {/* Toolbar — raised surface */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-2">
          <div className="flex items-center">
            <PrStateTab
              state="open"
              count={counts.data?.open}
              isActive={currentState === "open"}
              onClick={() =>
                navigate({
                  to: "/$owner/$repo/pulls",
                  params: { owner, repo },
                  search: (prev) => ({ ...prev, state: undefined }),
                })
              }
            />
            <PrStateTab
              state="closed"
              count={counts.data?.closed}
              isActive={currentState === "closed"}
              onClick={() =>
                navigate({
                  to: "/$owner/$repo/pulls",
                  params: { owner, repo },
                  search: (prev) => ({ ...prev, state: "closed" }),
                })
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search pull requests"
                name="pull-request-search"
                autoComplete="off"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search…"
                className="h-7 w-44 pl-8 text-ui"
              />
            </div>

            <FilterTrigger fields={fields} active={active} onChange={onActiveChange} />

            <ListDisplayMenu
              groupBy={grouping.groupBy}
              onGroupByChange={grouping.setGroupBy}
              groupKeys={groups.map((group) => group.key)}
              collapsedGroups={grouping.collapsedGroups}
              onGroupsCollapsed={grouping.setGroupsCollapsed}
              ordering={{
                value: filters.sort ?? "newest",
                options: SORT_OPTIONS,
                onChange: (next) =>
                  navigate({
                    to: "/$owner/$repo/pulls",
                    params: { owner, repo },
                    search: (prev) => ({
                      ...prev,
                      sort: next === "newest" ? undefined : next,
                    }),
                  }),
              }}
            />
          </div>
        </div>

        {/* Filter pills — only when active */}
        <FilterBar fields={fields} active={active} onChange={onActiveChange} className="px-2" />
      </div>

      {/* List */}
      <div className="mt-4 flex flex-col gap-1">
        {pulls.isPending ? (
          <PrListSkeleton />
        ) : pulls.isError ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
            <p className="text-body text-muted-foreground">Could not load pull requests.</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={!!searchText} state={currentState} />
        ) : (
          <>
            <GroupedList
              groups={groups}
              groupBy={grouping.groupBy}
              kind="pulls"
              collapsedGroups={grouping.collapsedGroups}
              onGroupsCollapsed={grouping.setGroupsCollapsed}
              renderItems={(items) =>
                buildPrTree(items, branchRefs, defaultBranch).map((node) => (
                  <PrRow
                    key={node.pr.id}
                    owner={owner}
                    repo={repo}
                    pr={node.pr}
                    reviewDecision={reviewDecisions.get(node.pr.number) ?? null}
                    checkRollup={checkRollups.get(node.pr.number)}
                    depth={node.depth}
                    treePosition={node.treePosition}
                    ancestorContinuations={node.ancestorContinuations}
                  />
                ))
              }
            />
            {pulls.hasNextPage && !searchText ? (
              <LoadMoreButton
                isFetching={pulls.isFetchingNextPage}
                onClick={() => pulls.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </div>
    </Container>
  );
}

// ─── Draft picker ──────────────────────────────────────────────────────────

const DRAFT_OPTIONS = [
  { value: "true", label: "Draft" },
  { value: "false", label: "Ready for review" },
] as const;

function DraftPicker({ value, onSelect }: { value?: string; onSelect: (v: string) => void }) {
  return (
    <Command>
      <CommandList>
        <CommandGroup>
          {DRAFT_OPTIONS.map((o) => (
            <CommandItem key={o.value} value={o.value} onSelect={() => onSelect(o.value)}>
              <span
                className={cn(
                  "inline-block w-3",
                  value === o.value ? "text-foreground" : "opacity-0",
                )}
              >
                ✓
              </span>
              <span className="font-sans">{o.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function PrListSkeleton() {
  const widths = [70, 56, 80, 46, 66, 74, 60];
  return (
    <div className="skeleton-fade">
      {widths.map((w) => (
        <div key={w} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch, state }: { hasSearch: boolean; state: PullsState }) {
  const Icon = state === "open" ? GitPullRequest : GitPullRequestClosed;
  return (
    <div className="px-5 py-16 text-center">
      <Icon className="mx-auto mb-3 size-5 text-[var(--color-fg-faint)]" />
      <p className="text-body text-muted-foreground">
        {hasSearch
          ? "No pull requests match your search."
          : state === "open"
            ? "No open pull requests."
            : "No closed pull requests."}
      </p>
    </div>
  );
}

function LoadMoreButton({ isFetching, onClick }: { isFetching: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      className={cn(
        "flex w-full items-center justify-center px-4 py-3 text-caption text-muted-foreground",
        "outline-none hover:bg-muted focus-visible:bg-muted",
        "disabled:cursor-wait",
      )}
    >
      {isFetching ? "Loading…" : "Load more"}
    </button>
  );
}
