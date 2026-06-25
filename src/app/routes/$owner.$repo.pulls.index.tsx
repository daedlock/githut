import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PrListPage } from "@/app/features/pulls/PrListPage";
import { pullsQueryOptions } from "@/app/features/pulls/hooks";

// ─── Search params ─────────────────────────────────────────────────────────

const SORT = ["newest", "oldest", "updated", "comments"] as const;
const STATE = ["open", "closed", "all"] as const;

const stringArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]));

const searchSchema = z.object({
  state: z.enum(STATE).optional(),
  draft: z.enum(["true", "false"]).optional(),
  author: stringArray,
  label: stringArray,
  reviewer: stringArray,
  assignee: stringArray,
  excludeAuthor: stringArray,
  excludeLabel: stringArray,
  excludeReviewer: stringArray,
  excludeAssignee: stringArray,
  sort: z.enum(SORT).optional(),
});

export const Route = createFileRoute("/$owner/$repo/pulls/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  // Non-blocking prefetch. Component shows its own skeleton on cold load.
  loader: ({ context, params, deps }) => {
    void context.queryClient.prefetchInfiniteQuery(
      pullsQueryOptions(params.owner, params.repo, {
        state: deps.state ?? "open",
        draft: deps.draft,
        author: deps.author,
        label: deps.label,
        reviewer: deps.reviewer,
        assignee: deps.assignee,
        excludeAuthor: deps.excludeAuthor,
        excludeLabel: deps.excludeLabel,
        excludeReviewer: deps.excludeReviewer,
        excludeAssignee: deps.excludeAssignee,
        sort: deps.sort ?? "newest",
      }),
    );
  },
  component: Page,
});

function Page() {
  const { owner, repo } = Route.useParams();
  const search = Route.useSearch();
  return <PrListPage owner={owner} repo={repo} search={search} />;
}
