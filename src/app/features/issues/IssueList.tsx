import { AlertCircle, CheckCircle2, CircleDot, Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { ComposeBox } from "@/app/components/ui/ComposeBox";
import { Container } from "@/app/components/ui/Container";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/lib/cn";
import { IssueListSkeleton } from "@/app/features/issues/components/IssueListSkeleton";
import { IssueRow } from "@/app/features/issues/components/IssueRow";
import { type StateFilter, StateTab } from "@/app/features/issues/components/StateTab";
import type { RepoIssue } from "@/app/features/issues/schemas";

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
  isComposing,
  onToggleCompose,
  newIssueTitle,
  onNewIssueTitleChange,
  newIssueBody,
  onNewIssueBodyChange,
  onSubmitIssue,
  isSubmittingIssue,
}: IssueListProps) {
  return (
    <Container size="lg" className="py-6">
      {isComposing ? (
        <form onSubmit={onSubmitIssue}>
          <div className="mb-4 rounded-lg border border-input bg-background">
            <div className="flex items-center gap-2.5 overflow-hidden rounded-t-lg border-b border-border bg-muted px-4 py-2.5">
              <span className="font-mono text-micro font-medium uppercase tracking-widest text-muted-foreground">
                New issue
              </span>
              <button
                type="button"
                onClick={onToggleCompose}
                aria-label="Cancel"
                className={cn(
                  "ml-auto rounded-sm p-1 text-[var(--color-fg-faint)]",
                  "outline-none transition-colors",
                  "hover:bg-accent hover:text-foreground",
                  "focus-visible:ring-1 focus-visible:ring-foreground/15",
                )}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <Input
                value={newIssueTitle}
                onChange={(e) => onNewIssueTitleChange(e.target.value)}
                placeholder="Issue title"
                className="h-9 text-body font-medium"
                autoFocus
              />
              <div className="overflow-hidden rounded-md border border-input">
                <ComposeBox
                  owner={owner}
                  repo={repo}
                  value={newIssueBody}
                  onChange={onNewIssueBodyChange}
                  placeholder="Describe the issue"
                  rows={6}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onToggleCompose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newIssueTitle.trim() || isSubmittingIssue}
                >
                  {isSubmittingIssue ? "Opening…" : "Open issue"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <>
          {/* Toolbar — sits on subtle surface */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-2 py-1">
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
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-7 w-44 pl-8 text-ui"
                />
              </div>
              <Button size="sm" variant="default" onClick={onToggleCompose}>
                <Plus data-icon="inline-start" />
                New issue
              </Button>
            </div>
          </div>

          {/* List — flat rows, hover surface shift */}
          <div className="mt-4 flex flex-col gap-1">
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
              issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} owner={owner} repo={repo} />
              ))
            )}
          </div>
        </>
      )}
    </Container>
  );
}

function EmptyState({
  hasSearch,
  state,
}: {
  hasSearch: boolean;
  state: StateFilter;
}) {
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
