import { afterEach, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/app/stores/auth";
import { directoryCommitsQueryOptions } from "./useDirectoryCommits";

const originalFetch = globalThis.fetch;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
afterEach(() => {
  globalThis.fetch = originalFetch;
  client.clear();
  useAuthStore.setState({ token: null });
});

test("116 directory rows use three requests and retain each path's commit", async () => {
  useAuthStore.setState({ token: "directory-fixture" });
  const sizes: number[] = [];
  globalThis.fetch = (async (_input, init) => {
    const { variables, query } = JSON.parse(String(init?.body));
    const paths = Object.entries(variables).filter(([key]) => /^p\d+$/.test(key));
    sizes.push(paths.length);
    expect(query).toContain("object(expression: $ref)");
    expect(variables.ref).toBe("feature/topic^{commit}");
    return Response.json({
      data: {
        repository: {
          head: Object.fromEntries(
            paths.map(([key, path]) => [
              key,
              {
                nodes: [
                  {
                    oid: "abcdef123456",
                    message: `${path}\nDetails`,
                    committedDate: "2026-10-18T12:00:00Z",
                    author: { name: "Author", user: { login: "demo" } },
                  },
                ],
              },
            ]),
          ),
        },
      },
    });
  }) as typeof fetch;
  const paths = Array.from({ length: 116 }, (_, i) => `src/file-${i}.ts`);
  const commits = await client.fetchQuery(
    directoryCommitsQueryOptions("demo", "repo", paths, "feature/topic"),
  );
  expect(sizes).toEqual([50, 50, 16]);
  expect(commits["src/file-75.ts"]).toEqual({
    sha: "abcdef123456",
    shortSha: "abcdef1",
    message: "src/file-75.ts",
    authorName: "demo",
    date: "2026-10-18T12:00:00Z",
  });
  await client.fetchQuery(
    directoryCommitsQueryOptions("demo", "repo", [...paths].reverse(), "feature/topic"),
  );
  expect(sizes).toHaveLength(3);
});

test("default branch supports empty histories and an empty directory makes no request", async () => {
  useAuthStore.setState({ token: "default-directory-fixture" });
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls++;
    expect(JSON.parse(String(init?.body)).query).toContain("defaultBranchRef");
    return Response.json({ data: { repository: { head: { target: { p0: { nodes: [] } } } } } });
  }) as typeof fetch;
  expect(await client.fetchQuery(directoryCommitsQueryOptions("demo", "repo", ["empty"]))).toEqual({
    empty: null,
  });
  expect(await client.fetchQuery(directoryCommitsQueryOptions("demo", "repo", []))).toEqual({});
  expect(calls).toBe(1);
});

test("annotated tags are peeled to a commit before reading path histories", async () => {
  useAuthStore.setState({ token: "tag-fixture" });
  globalThis.fetch = (async (_input, init) => {
    const { variables } = JSON.parse(String(init?.body));
    // GitHub returns a Tag without a Commit fragment for the unpeeled name.
    return Response.json({
      data: {
        repository: {
          head:
            variables.ref === "v1.0^{commit}"
              ? {
                  p0: {
                    nodes: [
                      {
                        oid: "tagged123",
                        message: "Tagged version",
                        committedDate: "2026-10-18T12:00:00Z",
                        author: null,
                      },
                    ],
                  },
                }
              : {},
        },
      },
    });
  }) as typeof fetch;
  expect(
    (await client.fetchQuery(directoryCommitsQueryOptions("demo", "repo", ["file"], "v1.0"))).file
      ?.message,
  ).toBe("Tagged version");
});
