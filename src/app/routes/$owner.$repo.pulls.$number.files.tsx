import { createFileRoute } from "@tanstack/react-router";
import { PrFilesPage } from "@/app/features/pulls/PrFilesPage";
import { prFilesQueryOptions } from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/files")({
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    void context.queryClient.prefetchQuery(
      prFilesQueryOptions(owner, repo, number),
    );
  },
  component: FilesPage,
});

function FilesPage() {
  const { owner, repo, number } = Route.useParams();
  return <PrFilesPage owner={owner} repo={repo} number={number} />;
}
