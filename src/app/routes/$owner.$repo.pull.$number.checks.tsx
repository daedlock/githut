import { createFileRoute } from "@tanstack/react-router";
import { prDetailQueryOptions } from "@/app/features/pulls/hooks";
import { PrChecksPage } from "@/app/features/pulls/PrChecksPage";

export const Route = createFileRoute("/$owner/$repo/pull/$number/checks")({
  // Non-blocking prefetch of the detail (head SHA). Checks themselves
  // fire from the component once the SHA is available — avoids the
  // blocking-loader pattern that previously regressed skeleton display.
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    void context.queryClient.prefetchQuery(prDetailQueryOptions(owner, repo, number));
  },
  component: ChecksPage,
});

function ChecksPage() {
  const { owner, repo, number } = Route.useParams();
  return <PrChecksPage owner={owner} repo={repo} number={number} />;
}
