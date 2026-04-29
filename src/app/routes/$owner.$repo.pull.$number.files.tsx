import { createFileRoute } from "@tanstack/react-router";
import { prFilesQueryOptions, prReviewCommentsQueryOptions } from "@/app/features/pulls/hooks";
import { PrFilesPage } from "@/app/features/pulls/PrFilesPage";

export const Route = createFileRoute("/$owner/$repo/pull/$number/files")({
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    const qc = context.queryClient;
    void qc.prefetchQuery(prFilesQueryOptions(owner, repo, number));
    void qc.prefetchQuery(prReviewCommentsQueryOptions(owner, repo, number));
  },
  component: FilesPage,
});

function FilesPage() {
  const { owner, repo, number } = Route.useParams();
  return <PrFilesPage owner={owner} repo={repo} number={number} />;
}
