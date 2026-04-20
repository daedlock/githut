import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$owner/$repo/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$owner/$repo/code",
      params: { owner: params.owner, repo: params.repo },
    });
  },
});
