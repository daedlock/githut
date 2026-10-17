import { AlertCircle, CheckCircle2, CircleDot, Plus, Search, X } from "lucide-react";
import { useMemo } from "react";
import { LiveUpdates } from "@/app/components/LiveUpdates";
import { Button } from "@/app/components/ui/button";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Container } from "@/app/components/ui/Container";
import { type ActiveFilter, FilterBar, FilterTrigger } from "@/app/components/ui/filter-bar";
import { Input } from "@/app/components/ui/input";
import { IssueListSkeleton } from "@/app/features/issues/components/IssueListSkeleton";
import { IssueRow } from "@/app/features/issues/components/IssueRow";
import { type StateFilter, StateTab } from "@/app/features/issues/components/StateTab";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { useRepoCollaborators, useRepoLabels } from "@/app/features/pulls/pickers";
import { toBulkItem } from "@/app/features/repo/bulkSelection";
import { BulkSelectionProvider } from "@/app/features/repo/components/BulkSelection";
import { GroupedList } from "@/app/features/repo/components/GroupedList";
import { ListDisplayMenu } from "@/app/features/repo/components/ListDisplayMenu";
import { buildRepoFilterFields } from "@/app/features/repo/filterFields";
import { groupListItems } from "@/app/features/repo/listGrouping";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import { useStableList } from "@/app/hooks/useStableList";
import { cn } from "@/app/lib/cn";
import { useListGrouping } from "@/app/stores/listGrouping";

export type IssueListProps = {
  owner: string;
  repo: string;
  issues: RepoIssue[];
  isLoading: boolean;
  isError: boolean;
  openCount: number;
  closedCount: number;
  stateFilter: StateFilter;
  onStateFilter: (s: StateFilter) => void;
  searchText: string;
  onSearch: (s: string) => void;
  activeFilters: ActiveFilter[];
  onActiveFiltersChange: (next: ActiveFilter[]) => void;
  isComposing: boolean;
  onToggleCompose: () => void;
  newIssueTitle: string;
  onNewIssueTitleChange: (s: string) => void;
  newIssueBody: string;
  onNewIssueBodyChange: (s: string) => void;
  onSubmitIssue: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmittingIssue: boolean;
};

export function IssueList({
  owner,
  repo,
  issues,
  isLoading,
  isError,
  openCount,
  closedCount,
  stateFilter,
  onStateFilter,
  searchText,
  onSearch,
  activeFilters,
  onActiveFiltersChange,
  isComposing,
  onToggleCompose,
  newIssueTitle,
  onNewIssueTitleChange,
  newIssueBody,
  onNewIssueBodyChange,
  onSubmitIssue,
  isSubmittingIssue,
}: IssueListProps) {
  useListNavigation(!isLoading && !isError && !isComposing);
  const grouping = useListGrouping(owner, repo, "issues");
  const incomingGroups = useMemo(
    () => groupListItems(issues, grouping.groupBy),
    [issues, grouping.groupBy],
  );
  const { items: groups, listProps } = useStableList(incomingGroups);
  const bulkItems = useMemo(() => issues.map(toBulkItem), [issues]);
  const visibleNumbers = useMemo(
    () =>
      groups
        .filter((group) => grouping.groupBy === "none" || !grouping.collapsedGroups.has(group.key))
        .flatMap((group) => group.items.map((issue) => issue.number)),
    [groups, grouping.groupBy, grouping.collapsedGroups],
  );

  const labelsQuery = useRepoLabels(owner, repo);
  const collaboratorsQuery = useRepoCollaborators(owner, repo);
  const fields = useMemo(
    () =>
      buildRepoFilterFields({
        labels: labelsQuery.data ?? [],
        collaborators: collaboratorsQuery.data ?? [],
        include: ["label", "author", "assignee"],
      }),
    [labelsQuery.data, collaboratorsQuery.data],
  );

  return (
    <Container className="py-6">
      <h1 className="sr-only">Issues</h1>
      {isComposing ? (
        <form onSubmit={onSubmitIssue} className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-micro font-medium uppercase tracking-widest text-muted-foreground">
              New issue
            </span>
            <button
              type="button"
              onClick={onToggleCompose}
              aria-label="Cancel"
              className={cn(
                "rounded-sm p-1 text-[var(--color-fg-faint)]",
                "outline-none transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:ring-1 focus-visible:ring-foreground/15",
              )}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <Input
            value={newIssueTitle}
            onChange={(e) => onNewIssueTitleChange(e.target.value)}
            placeholder="Issue title"
            className="h-9 text-body font-medium"
            autoFocus
          />
          <ComposeBox
            owner={owner}
            repo={repo}
            value={newIssueBody}
            onChange={onNewIssueBodyChange}
            onSubmit={() => {
              const form = document.querySelector<HTMLFormElement>("form");
              form?.requestSubmit();
            }}
            submitLabel="Open issue"
            submitDisabled={!newIssueTitle.trim()}
            submitPending={isSubmittingIssue}
            placeholder="Describe the issue"
            rows={6}
          />
        </form>
      ) : (
        <>
          {/* Toolbar — sits on subtle surface */}
          <div className="mb-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-2">
              <div className="flex items-center">
                <StateTab
                  state="open"
                  count={openCount}
                  isActive={stateFilter === "open"}
                  onClick={() => onStateFilter("open")}
                />
                <StateTab
                  state="closed"
                  count={closedCount}
                  isActive={stateFilter === "closed"}
                  onClick={() => onStateFilter("closed")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    name="issue-search"
                    aria-label="Search issues"
                    autoComplete="off"
                    value={searchText}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search…"
                    className="h-7 w-44 pl-8 text-ui"
                  />
                </div>
                <FilterTrigger
                  fields={fields}
                  active={activeFilters}
                  onChange={onActiveFiltersChange}
                />
                <ListDisplayMenu
                  groupBy={grouping.groupBy}
                  onGroupByChange={grouping.setGroupBy}
                  groupKeys={groups.map((group) => group.key)}
                  collapsedGroups={grouping.collapsedGroups}
                  onGroupsCollapsed={grouping.setGroupsCollapsed}
                />
                <Button size="sm" variant="default" onClick={onToggleCompose}>
                  <Plus data-icon="inline-start" />
                  New issue
                </Button>
              </div>
            </div>

            <FilterBar
              fields={fields}
              active={activeFilters}
              onChange={onActiveFiltersChange}
              className="px-2"
            />
          </div>

          <BulkSelectionProvider
            owner={owner}
            repo={repo}
            kind="issues"
            items={bulkItems}
            visible={visibleNumbers}
          >
            {/* List — flat rows, hover surface shift */}
            <LiveUpdates ready={!isLoading} announce={false}>
              <div {...listProps} className="mt-4 flex flex-col gap-1">
                {isLoading ? (
                  <IssueListSkeleton />
                ) : isError ? (
                  <div className="px-5 py-10 text-center">
                    <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
                    <p className="text-body text-muted-foreground">Could not load issues.</p>
                  </div>
                ) : issues.length === 0 ? (
                  <EmptyState hasSearch={!!searchText} state={stateFilter} />
                ) : (
                  <GroupedList
                    groups={groups}
                    groupBy={grouping.groupBy}
                    kind="issues"
                    collapsedGroups={grouping.collapsedGroups}
                    onGroupsCollapsed={grouping.setGroupsCollapsed}
                    renderItems={(items) =>
                      items.map((issue) => (
                        <IssueRow key={issue.id} issue={issue} owner={owner} repo={repo} />
                      ))
                    }
                  />
                )}
              </div>
            </LiveUpdates>
          </BulkSelectionProvider>
        </>
      )}
    </Container>
  );
}

function EmptyState({ hasSearch, state }: { hasSearch: boolean; state: StateFilter }) {
  const Icon = state === "open" ? CircleDot : CheckCircle2;
  return (
    <div className="px-5 py-16 text-center">
      <Icon className="mx-auto mb-3 size-5 text-[var(--color-fg-faint)]" />
      <p className="text-body text-muted-foreground">
        {hasSearch
          ? "No issues match your search."
          : state === "open"
            ? "No open issues."
            : "No closed issues."}
      </p>
    </div>
  );
}
