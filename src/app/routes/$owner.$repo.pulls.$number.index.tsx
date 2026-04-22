import { createFileRoute } from "@tanstack/react-router";
import { PrConversationPage } from "@/app/features/pulls/PrConversationPage";
import {
  prCommentsQueryOptions,
  prReviewsQueryOptions,
  prTimelineQueryOptions,
} from "@/app/features/pulls/hooks";

export const Route = createFileRoute("/$owner/$repo/pulls/$number/")({
  // Non-blocking prefetch — comments, reviews, and timeline fire in
  // parallel so the conversation lands warm on cold nav. Timeline is the
  // slowest endpoint; kicking it off here trims perceived latency.
  loader: ({ context, params }) => {
    const { owner, repo, number } = params;
    if (!Number.isFinite(number)) return;
    const qc = context.queryClient;
    void qc.prefetchQuery(prCommentsQueryOptions(owner, repo, number));
    void qc.prefetchQuery(prReviewsQueryOptions(owner, repo, number));
    void qc.prefetchQuery(prTimelineQueryOptions(owner, repo, number));
  },
  component: ConversationPage,
});

function ConversationPage() {
  const { owner, repo, number } = Route.useParams();
  return <PrConversationPage owner={owner} repo={repo} number={number} />;
}
