import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getGitHubClient } from "@/app/lib/github/client";
import { graph, pages } from "./api";
import { ProjectError } from "./ProjectsHome";

interface Related {
  id: string;
  title: string;
  number: number;
  repository: { nameWithOwner: string };
}
export function Relationships({
  id,
  owner,
  repo,
  number,
}: {
  id: string;
  owner: string;
  repo: string;
  number: number;
}) {
  const query = useQuery({
    queryKey: ["projects", "relationships", id],
    queryFn: async () => {
      const fetchRelated = (key: "subIssues" | "closedByPullRequestsReferences") =>
        pages<Related>(async (after) => {
          const { node } = await graph<{
            node: Record<
              string,
              { nodes: Related[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
            >;
          }>(
            `query($id:ID!,$after:String){node(id:$id){... on Issue{${key}(first:50,after:$after){nodes{id title number repository{nameWithOwner}} pageInfo{hasNextPage endCursor}}}}}`,
            { id, after },
          );
          return node[key]!;
        });
      const client = getGitHubClient();
      const blocked: Related[] = [];
      let url: string | undefined =
        `/repos/${owner}/${repo}/issues/${number}/dependencies/blocked_by?per_page=100`;
      while (url) {
        const page: { data: unknown; headers: { link?: string } } = await client.request(
          `GET ${url}`,
        );
        for (const issue of page.data as {
          node_id: string;
          title: string;
          number: number;
          repository_url: string;
        }[])
          blocked.push({
            id: issue.node_id,
            title: issue.title,
            number: issue.number,
            repository: {
              nameWithOwner: new URL(issue.repository_url).pathname.split("/").slice(-2).join("/"),
            },
          });
        url = page.headers.link?.match(/<([^>]+)>; rel="next"/)?.[1];
      }
      const [children, prs] = await Promise.all([
        fetchRelated("subIssues"),
        fetchRelated("closedByPullRequestsReferences"),
      ]);
      return [
        { label: "Sub-issues", items: children, pr: false },
        { label: "Blocked by", items: blocked, pr: false },
        { label: "Linked pull requests", items: prs, pr: true },
      ];
    },
  });
  if (query.error) return <ProjectError error={query.error} retry={() => query.refetch()} />;
  return (
    <section>
      <h3>Relationships</h3>
      {query.isPending ? (
        <p>Loading relationships…</p>
      ) : (
        query.data?.map((g) => (
          <div className="mt-2" key={g.label}>
            <strong>{g.label}</strong>
            {g.items.length ? (
              g.items.map((i) => {
                const [o = "", r = ""] = i.repository.nameWithOwner.split("/");
                return (
                  <Link
                    key={i.id}
                    to={g.pr ? "/$owner/$repo/pull/$number" : "/$owner/$repo/issues/$number"}
                    params={{ owner: o, repo: r, number: i.number }}
                    className="block underline"
                  >
                    {i.title} · {i.repository.nameWithOwner}#{i.number}
                  </Link>
                );
              })
            ) : (
              <p>None</p>
            )}
          </div>
        ))
      )}
    </section>
  );
}
