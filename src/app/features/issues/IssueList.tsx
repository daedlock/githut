import { AlertCircle, CheckCircle2, CircleDot, Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { Container } from "@/app/components/ui/Container";
import { Input } from "@/app/components/ui/input";
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
  onOpenIssue: (n: number) => void;
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
  onOpenIssue,
}: IssueListProps) {
  return (
    <Container className="py-5 sm:py-6">
      {isComposing && (
        <Card as="div" radius="lg" tone="default" border="strong" className="mb-4">
          {/* New-issue compose form. Uses a plain form inside so onSubmit wires up. */}
          <form onSubmit={onSubmitIssue}>
            <CardHeader>
              <span className="font-mono text-micro font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
                New issue
              </span>
              <button
                type="button"
                onClick={onToggleCompose}
                className="ml-auto rounded p-1 text-[var(--color-fg-faint)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </CardHeader>
            <CardBody flush className="space-y-3 p-4">
              <Input
                value={newIssueTitle}
                onChange={(e) => onNewIssueTitleChange(e.target.value)}
                placeholder="Issue title"
                className="h-9 text-body font-medium"
                autoFocus
              />
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)] focus-within:border-[var(--color-focus)] focus-within:ring-2 focus-within:ring-[var(--color-focus)]/20">
                <CommentBox
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
            </CardBody>
          </form>
        </Card>
      )}

      <Card radius="lg" tone="subtle" border="strong">
        <CardHeader className="sm:px-5">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
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
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-faint)]" />
                <Input
                  value={searchText}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search issues…"
                  className="h-8 w-52 pl-8 text-ui"
                />
              </div>
              <Button size="sm" onClick={onToggleCompose}>
                <Plus className="h-3.5 w-3.5" />
                New issue
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody
          flush
          className="divide-y divide-[var(--color-border)] overflow-hidden rounded-b-[var(--radius-lg)] bg-[var(--color-bg)]"
        >
          {isLoading ? (
            <IssueListSkeleton />
          ) : isError ? (
            <div className="px-5 py-10 text-center">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-[var(--color-danger)]" />
              <p className="text-body text-[var(--color-fg-muted)]">Could not load issues.</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="px-5 py-12 text-center">
              {stateFilter === "open" ? (
                <CircleDot className="mx-auto mb-3 h-6 w-6 text-[var(--color-fg-faint)]" />
              ) : (
                <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-[var(--color-fg-faint)]" />
              )}
              <p className="text-body font-medium text-[var(--color-fg-muted)]">
                {searchText ? "No issues match your search." : `No ${stateFilter} issues.`}
              </p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} onClick={() => onOpenIssue(issue.number)} />
            ))
          )}
        </CardBody>
      </Card>
    </Container>
  );
}
