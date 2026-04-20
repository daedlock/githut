import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { StateFilter } from "@/app/features/issues/components/StateTab";
import {
  useAddCommentReaction,
  useAddIssueReaction,
  useCreateIssue,
  useCreateIssueComment,
  useRepoIssue,
  useRepoIssueComments,
  useRepoIssues,
  useUpdateIssueState,
} from "@/app/features/issues/hooks";
import { IssueDetail } from "@/app/features/issues/IssueDetail";
import { IssueList } from "@/app/features/issues/IssueList";
import { useMe } from "@/app/hooks/useMe";

export const Route = createFileRoute("/$owner/$repo/issues")({
  validateSearch: (search: Record<string, unknown>) => {
    const value = Number(search.issue);
    if (Number.isInteger(value) && value > 0) return { issue: value };
    return {};
  },
  component: IssuesPage,
});

function IssuesPage() {
  const { owner, repo } = Route.useParams();
  const { issue: selectedIssueNumber } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: me } = useMe();

  // ─── URL-agnostic UI state ────────────────────────────────────────────────
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [searchText, setSearchText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");

  // ─── Data ─────────────────────────────────────────────────────────────────
  const issuesQuery = useRepoIssues(owner, repo);
  const issueQuery = useRepoIssue(owner, repo, selectedIssueNumber);
  const commentsQuery = useRepoIssueComments(owner, repo, selectedIssueNumber);

  const createIssueMutation = useCreateIssue(owner, repo);
  const createCommentMutation = useCreateIssueComment(owner, repo, selectedIssueNumber);
  const updateStateMutation = useUpdateIssueState(owner, repo, selectedIssueNumber);
  const addIssueReactionMutation = useAddIssueReaction(owner, repo, selectedIssueNumber);
  const addCommentReactionMutation = useAddCommentReaction(owner, repo, selectedIssueNumber);

  // ─── Derived list state ───────────────────────────────────────────────────
  const openCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "open").length,
    [issuesQuery.data],
  );
  const closedCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "closed").length,
    [issuesQuery.data],
  );

  const filteredIssues = useMemo(() => {
    const list = (issuesQuery.data ?? []).filter((i) => i.state === stateFilter);
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q) ||
        i.user.login.toLowerCase().includes(q),
    );
  }, [issuesQuery.data, stateFilter, searchText]);

  const selectedIssue = issueQuery.data;
  const isDetailView =
    !!selectedIssueNumber && (issueQuery.isPending || issueQuery.isError || !!selectedIssue);

  if (isDetailView) {
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
        onSubmitComment={(e) => {
          e.preventDefault();
          const body = newCommentBody.trim();
          if (!selectedIssueNumber || !body) return;
          createCommentMutation.mutate(
            { issueNumber: selectedIssueNumber, body },
            { onSuccess: () => setNewCommentBody("") },
          );
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
        onAddIssueReaction={(content) =>
          selectedIssue &&
          addIssueReactionMutation.mutate({ issueNumber: selectedIssue.number, content })
        }
        onAddCommentReaction={(commentId, content) =>
          addCommentReactionMutation.mutate({ commentId, content })
        }
        me={me}
        onBack={() => navigate({ search: {} })}
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
              navigate({ search: { issue: created.number } });
            },
          },
        );
      }}
      isSubmittingIssue={createIssueMutation.isPending}
      onOpenIssue={(n) => navigate({ search: { issue: n } })}
    />
  );
}
