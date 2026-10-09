import { CheckCircle2, CircleDot, Plus, X } from "lucide-react";
import { useMemo, useRef } from "react";
import { EmptyState } from "@/app/components/EmptyState";
import { ListToolbar } from "@/app/components/ListToolbar";
import { SearchField } from "@/app/components/SearchField";
import { Button } from "@/app/components/ui/button";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Container } from "@/app/components/ui/Container";
import { type ActiveFilter, FilterBar, FilterTrigger } from "@/app/components/ui/filter-bar";
import { Input } from "@/app/components/ui/input";
import { Kbd } from "@/app/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
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
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { useListNavigation } from "@/app/hooks/useListNavigation";
import type { ShortcutMap } from "@/app/lib/shortcuts";
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
  const groups = useMemo(
    () => groupListItems(issues, grouping.groupBy),
    [issues, grouping.groupBy],
  );
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

  // `c` opens the composer from anywhere on the list (never while typing).
  const toggleCompose = useRef(onToggleCompose);
  toggleCompose.current = onToggleCompose;
  useKeybindings(
    useMemo<ShortcutMap>(
      (): ShortcutMap => (isComposing ? {} : { c: () => toggleCompose.current() }),
      [isComposing],
    ),
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Container className="py-6">
      <h1 className="sr-only">Issues</h1>
      {isComposing ? (
        <form ref={formRef} onSubmit={onSubmitIssue} className="mb-4 flex flex-col gap-3">
          <div className="flex h-7 items-center justify-between">
            <h2 className="text-micro font-medium uppercase tracking-widest text-muted-foreground">
              New issue
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel"
                  aria-keyshortcuts="Escape"
                  onClick={onToggleCompose}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Cancel <Kbd>Esc</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            value={newIssueTitle}
            onChange={(e) => onNewIssueTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.preventDefault();
              onToggleCompose();
            }}
            aria-label="Issue title"
            placeholder="Issue title"
            className="h-9 text-body font-medium"
            autoFocus
          />
          <ComposeBox
            owner={owner}
            repo={repo}
            value={newIssueBody}
            onChange={onNewIssueBodyChange}
            onSubmit={() => formRef.current?.requestSubmit()}
            onCancel={onToggleCompose}
            showCancel={false}
            submitLabel="Open issue"
            submitDisabled={!newIssueTitle.trim()}
            submitPending={isSubmittingIssue}
            placeholder="Describe the issue"
            rows={6}
          />
        </form>
      ) : (
        <>
          <div className="mb-2 flex flex-col gap-2">
            <ListToolbar
              start={
                <>
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
                </>
              }
              end={
                <>
                  <SearchField
                    size="sm"
                    name="issue-search"
                    aria-label="Search issues"
                    value={searchText}
                    onValueChange={onSearch}
                    placeholder="Search…"
                    className="w-48"
                  />
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" aria-keyshortcuts="c" onClick={onToggleCompose}>
                        <Plus data-icon="inline-start" />
                        New issue
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      New issue <Kbd>C</Kbd>
                    </TooltipContent>
                  </Tooltip>
                </>
              }
            />

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
            <div className="mt-4 flex flex-col gap-1">
              {isLoading ? (
                <IssueListSkeleton />
              ) : isError ? (
                <EmptyState tone="error">Could not load issues.</EmptyState>
              ) : issues.length === 0 ? (
                <EmptyState icon={stateFilter === "open" ? CircleDot : CheckCircle2}>
                  {searchText
                    ? "No issues match your search."
                    : activeFilters.length > 0
                      ? "No issues match these filters."
                      : stateFilter === "open"
                        ? "No open issues."
                        : "No closed issues."}
                </EmptyState>
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
          </BulkSelectionProvider>
        </>
      )}
    </Container>
  );
}
