import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/app/stores/auth";
import {
  actionsKeys,
  runArtifactsQueryOptions,
  runJobsQueryOptions,
  workflowRunsQueryOptions,
  workflowsQueryOptions,
} from "./hooks";

const originalFetch = globalThis.fetch;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
afterEach(() => {
  globalThis.fetch = originalFetch;
  client.clear();
  useAuthStore.setState({ token: null });
});

function fixtureFetch(respond: (url: URL) => unknown) {
  useAuthStore.setState({ token: "actions-unit-test-token" });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    // A test must never fall through to a real network request.
    expect(url.hostname).toBe("api.github.com");
    return Response.json(respond(url));
  }) as typeof fetch;
}

describe("Actions queries", () => {
  test("run filters and workflow selection reach GitHub", async () => {
    fixtureFetch((url) => {
      expect(url.pathname).toBe("/repos/demo/repo/actions/workflows/99/runs");
      expect(url.searchParams.get("status")).toBe("waiting");
      expect(url.searchParams.get("branch")).toBe("release/test");
      expect(url.searchParams.get("actor")).toBe("octocat");
      expect(url.searchParams.get("event")).toBe("workflow_dispatch");
      return { total_count: 0, workflow_runs: [] };
    });
    const result = await client.fetchInfiniteQuery(
      workflowRunsQueryOptions("demo", "repo", {
        workflowId: 99,
        status: "waiting",
        branch: "release/test",
        actor: "octocat",
        event: "workflow_dispatch",
      }),
    );
    expect(result.pages).toEqual([[]]);
  });
  test("fetches every job page from the requested attempt", async () => {
    const pages: string[] = [];
    fixtureFetch((url) => {
      expect(url.pathname).toBe("/repos/demo/repo/actions/runs/42/attempts/2/jobs");
      const page = url.searchParams.get("page")!;
      pages.push(page);
      return {
        total_count: 101,
        jobs: Array.from({ length: page === "1" ? 100 : 1 }, (_, i) => ({
          id: page === "1" ? i + 1 : 101,
          run_id: 42,
          name: `test ${i}`,
          node_id: String(i),
          url: "",
          html_url: null,
          status: "completed",
          conclusion: "success",
          steps: [],
          labels: [],
        })),
      };
    });
    const jobs = await client.fetchQuery(runJobsQueryOptions("demo", "repo", 42, 2));
    expect(jobs.length).toBe(101);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(101);
    expect(pages).toEqual(["1", "2"]);
    expect(actionsKeys.jobs("demo", "repo", 42, 1)).not.toEqual(
      actionsKeys.jobs("demo", "repo", 42, 2),
    );
  });

  test("workflow pagination does not hide workflows beyond the first hundred", async () => {
    fixtureFetch((url) => ({
      total_count: 101,
      workflows: Array.from({ length: url.searchParams.get("page") === "1" ? 100 : 1 }, (_, i) => ({
        id: i,
        node_id: String(i),
        name: `Workflow ${i}`,
        path: `workflow${i}.yml`,
        state: "active",
        created_at: "",
        updated_at: "",
        html_url: "",
        badge_url: "",
      })),
    }));
    expect((await client.fetchQuery(workflowsQueryOptions("demo", "repo"))).length).toBe(101);
  });

  test("artifact pagination retains expired items and every page", async () => {
    fixtureFetch((url) => ({
      total_count: 101,
      artifacts: Array.from({ length: url.searchParams.get("page") === "1" ? 100 : 1 }, (_, i) => ({
        id: i,
        name: `Artifact ${i}`,
        size_in_bytes: 1,
        url: "",
        archive_download_url: "",
        expired: true,
        created_at: null,
        expires_at: null,
      })),
    }));
    const artifacts = await client.fetchQuery(runArtifactsQueryOptions("demo", "repo", 42));
    expect(artifacts.length).toBe(101);
    expect(artifacts.every((artifact) => artifact.expired)).toBe(true);
  });
});
