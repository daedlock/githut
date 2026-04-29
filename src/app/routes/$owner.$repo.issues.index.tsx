import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RepoIssuesPage } from "@/app/features/issues/RepoIssuesPage";

export const Route = createFileRoute("/$owner/$repo/issues/")({
  component: IssuesListRoute,
});

function IssuesListRoute() {
  const { owner, repo } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <RepoIssuesPage
      owner={owner}
      repo={repo}
      onBackToList={() => navigate({ to: "/$owner/$repo/issues", params: { owner, repo } })}
      onIssueCreated={(number) =>
        navigate({ to: "/$owner/$repo/issues/$number", params: { owner, repo, number } })
      }
      onIssueIsPullRequest={(number) =>
        navigate({
          to: "/$owner/$repo/pull/$number",
          params: { owner, repo, number },
          replace: true,
        })
      }
    />
  );
}
