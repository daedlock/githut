import { createFileRoute } from "@tanstack/react-router";
import { PrCommitsPage } from "@/app/features/pulls/PrCommitsPage";
import { prCommitsQueryOptions } from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/commits")({
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    void context.queryClient.prefetchQuery(
      prCommitsQueryOptions(owner, repo, number),
    );
  },
  component: CommitsPage,
});

function CommitsPage() {
  const { owner, repo, number } = Route.useParams();
  return <PrCommitsPage owner={owner} repo={repo} number={number} />;
}
