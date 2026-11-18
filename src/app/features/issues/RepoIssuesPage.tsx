import { useEffect, useMemo, useState } from "react";
import type { ActiveFilter } from "@/app/components/ui/filter-bar";
import { useIssueActivityFilter } from "@/app/features/activity/pages";
import type { StateFilter } from "@/app/features/issues/components/StateTab";
import {
  useCreateIssue,
  useCreateIssueComment,
  useRepoIssue,
  useRepoIssueComments,
  useRepoIssues,
  useToggleCommentReaction,
  useToggleIssueReaction,
  useUpdateIssueState,
} from "@/app/features/issues/hooks";
import { IssueDetail } from "@/app/features/issues/IssueDetail";
import { IssueList } from "@/app/features/issues/IssueList";
import { useMe } from "@/app/hooks/useMe";
import { draftKey, draftPage, sentDraft, useDraft } from "@/app/stores/drafts";
import { matchesIssue } from "./filters";

export type RepoIssuesPageProps = {
  owner: string;
  repo: string;
  selectedIssueNumber?: number;
  onBackToList: () => void;
  onIssueCreated: (issueNumber: number) => void;
  onIssueIsPullRequest: (issueNumber: number) => void;
};

export function RepoIssuesPage({
  owner,
  repo,
  selectedIssueNumber,
  onBackToList,
  onIssueCreated,
  onIssueIsPullRequest,
}: RepoIssuesPageProps) {
  const { data: me } = useMe();

  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [searchText, setSearchText] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  useIssueActivityFilter(stateFilter, searchText, activeFilters);
  const [isComposing, setIsComposing] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody] = useState("");
  const commentDraftKey = draftKey(draftPage(owner, repo, selectedIssueNumber ?? 0), "comment");
  const [newCommentBody, setNewCommentBody] = useDraft(commentDraftKey);

  const issuesQuery = useRepoIssues(owner, repo);
  const issueQuery = useRepoIssue(owner, repo, selectedIssueNumber);
  const commentsQuery = useRepoIssueComments(owner, repo, selectedIssueNumber);

  const createIssueMutation = useCreateIssue(owner, repo);
  const createCommentMutation = useCreateIssueComment(owner, repo, me);
  const updateStateMutation = useUpdateIssueState(owner, repo);
  const toggleIssueReactionMutation = useToggleIssueReaction(
    owner,
    repo,
    selectedIssueNumber,
    me?.id,
  );
  const toggleCommentReactionMutation = useToggleCommentReaction(
    owner,
    repo,
    selectedIssueNumber,
    me?.id,
  );

  const openCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "open").length,
    [issuesQuery.data],
  );
  const closedCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "closed").length,
    [issuesQuery.data],
  );

  const filteredIssues = useMemo(
    () =>
      (issuesQuery.data ?? []).filter((i) =>
        matchesIssue(i, { state: stateFilter, text: searchText, filters: activeFilters }),
      ),
    [issuesQuery.data, stateFilter, searchText, activeFilters],
  );

  const selectedIssue = issueQuery.data;

  useEffect(() => {
    if (selectedIssue?.pull_request && selectedIssueNumber) {
      onIssueIsPullRequest(selectedIssueNumber);
    }
  }, [selectedIssue, selectedIssueNumber, onIssueIsPullRequest]);

  if (selectedIssueNumber) {
    return (
      <IssueDetail
        owner={owner}
        repo={repo}
        issue={selectedIssue}
        isLoading={issueQuery.isPending}
        isError={issueQuery.isError}
        comments={commentsQuery.data ?? []}
        commentsLoading={commentsQuery.isPending}
        commentsError={commentsQuery.isError}
        newCommentBody={newCommentBody}
        onNewCommentChange={setNewCommentBody}
        onSubmitComment={() => {
          const body = newCommentBody.trim();
          if (!body || createCommentMutation.isPending) return;
          // The draft is cleared when the comment is posted; a failed send keeps it.
          createCommentMutation.mutate({
            issueNumber: selectedIssueNumber,
            body,
            draft: sentDraft(commentDraftKey, body),
          });
        }}
        onToggleState={() =>
          selectedIssue &&
          updateStateMutation.mutate({
            issueNumber: selectedIssue.number,
            nextState: selectedIssue.state === "open" ? "closed" : "open",
          })
        }
        isTogglingState={updateStateMutation.isPending}
        isPostingComment={createCommentMutation.isPending}
        onToggleIssueReaction={(content, existingReactionId) =>
          selectedIssue &&
          toggleIssueReactionMutation.mutate({
            issueNumber: selectedIssue.number,
            content,
            existingReactionId,
          })
        }
        onToggleCommentReaction={(commentId, content, existingReactionId) =>
          toggleCommentReactionMutation.mutate({ commentId, content, existingReactionId })
        }
        me={me}
        onBack={onBackToList}
      />
    );
  }

  return (
    <IssueList
      owner={owner}
      repo={repo}
      issues={filteredIssues}
      isLoading={issuesQuery.isPending}
      isError={issuesQuery.isError}
      openCount={openCount}
      closedCount={closedCount}
      stateFilter={stateFilter}
      onStateFilter={setStateFilter}
      searchText={searchText}
      onSearch={setSearchText}
      activeFilters={activeFilters}
      onActiveFiltersChange={setActiveFilters}
      isComposing={isComposing}
      onToggleCompose={() => {
        setIsComposing((v) => !v);
        setNewIssueTitle("");
        setNewIssueBody("");
      }}
      newIssueTitle={newIssueTitle}
      onNewIssueTitleChange={setNewIssueTitle}
      newIssueBody={newIssueBody}
      onNewIssueBodyChange={setNewIssueBody}
      onSubmitIssue={(e) => {
        e.preventDefault();
        const title = newIssueTitle.trim();
        if (!title) return;
        createIssueMutation.mutate(
          { title, body: newIssueBody.trim() },
          {
            onSuccess: (created) => {
              setIsComposing(false);
              setNewIssueTitle("");
              setNewIssueBody("");
              onIssueCreated(created.number);
            },
          },
        );
      }}
      isSubmittingIssue={createIssueMutation.isPending}
    />
  );
}
