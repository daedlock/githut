import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RepoIssuesPage } from "@/app/features/issues/RepoIssuesPage";

export const Route = createFileRoute("/$owner/$repo/issues/$number")({
  parseParams: (raw) => ({ number: Number(raw.number) }),
  component: IssueDetailRoute,
});

function IssueDetailRoute() {
  const { owner, repo, number } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <RepoIssuesPage
      owner={owner}
      repo={repo}
      selectedIssueNumber={number}
      onBackToList={() => navigate({ to: "/$owner/$repo/issues", params: { owner, repo } })}
      onIssueCreated={(issueNumber) =>
        navigate({
          to: "/$owner/$repo/issues/$number",
          params: { owner, repo, number: issueNumber },
        })
      }
      onIssueIsPullRequest={(issueNumber) =>
        navigate({
          to: "/$owner/$repo/pull/$number",
          params: { owner, repo, number: issueNumber },
          replace: true,
        })
      }
    />
  );
}
