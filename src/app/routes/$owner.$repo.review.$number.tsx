import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$owner/$repo/review/$number")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$owner/$repo/pr/$number",
      params: { owner: params.owner, repo: params.repo, number: Number(params.number) },
      replace: true,
    });
  },
});
