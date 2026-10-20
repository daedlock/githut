import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/app/stores/auth";
import {
  applyViewerReactionToggle,
  confirmViewerReaction,
  issueViewerReactionsQueryOptions,
  prViewerReactionsQueryOptions,
  resolveMyReactionId,
  rollbackViewerReaction,
  UNRESOLVED_REACTION_ID,
  type ViewerReactions,
  viewerReactionKeys,
} from "./viewerReactions";

const originalFetch = globalThis.fetch;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
afterEach(() => {
  globalThis.fetch = originalFetch;
  client.clear();
  useAuthStore.setState({ token: null });
});

type Call = {
  url: URL;
  method: string;
  body: { query?: string; variables?: Record<string, unknown> };
};

function fixtureFetch(respond: (call: Call) => unknown) {
  useAuthStore.setState({ token: "reactions-unit-test-token" });
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    // A test must never fall through to a real network request.
    expect(url.hostname).toBe("api.github.com");
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : {},
    };
    calls.push(call);
    return Response.json(respond(call));
  }) as typeof fetch;
  return calls;
}

const groups = (...mine: string[]) =>
  ["THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY", "CONFUSED", "HEART", "ROCKET", "EYES"].map(
    (content) => ({ content, viewerHasReacted: mine.includes(content) }),
  );

const page = (hasNextPage: boolean, endCursor: string | null = null) => ({
  hasNextPage,
  endCursor,
});

describe("PR viewer reactions", () => {
  test("one GraphQL request maps both comment kinds to the viewer's reactions", async () => {
    const calls = fixtureFetch(() => ({
      data: {
        repository: {
          pullRequest: {
            comments: {
              pageInfo: page(false),
              nodes: [
                { fullDatabaseId: "6171141785", reactionGroups: groups("THUMBS_UP", "HEART") },
                { fullDatabaseId: "6171143152", reactionGroups: groups() },
              ],
            },
            reviewThreads: {
              pageInfo: page(false),
              nodes: [
                {
                  comments: {
                    nodes: [
                      { fullDatabaseId: "4272438814", reactionGroups: groups("EYES") },
                      { fullDatabaseId: "4272480037", reactionGroups: groups("THUMBS_DOWN") },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    }));

    const result = await client.fetchQuery(prViewerReactionsQueryOptions("demo", "repo", 790));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.pathname).toBe("/graphql");
    expect(calls[0]!.body.variables).toMatchObject({ owner: "demo", repo: "repo", number: 790 });
    expect([...(result.comments.get(6171141785) ?? [])].map(([c]) => c)).toEqual(["+1", "heart"]);
    expect(result.comments.has(6171143152)).toBe(false);
    expect([...(result.reviewComments.get(4272438814)?.keys() ?? [])]).toEqual(["eyes"]);
    expect([...(result.reviewComments.get(4272480037)?.keys() ?? [])]).toEqual(["-1"]);
  });

  test("later pages only ask for the connection that still has more", async () => {
    const calls = fixtureFetch(({ body }) => {
      const v = body.variables ?? {};
      if (!v.commentsAfter && !v.threadsAfter) {
        return {
          data: {
            repository: {
              pullRequest: {
                comments: {
                  pageInfo: page(true, "c1"),
                  nodes: [{ fullDatabaseId: "1", reactionGroups: groups("ROCKET") }],
                },
                reviewThreads: { pageInfo: page(false), nodes: [] },
              },
            },
          },
        };
      }
      expect(v).toMatchObject({ commentsAfter: "c1", withComments: true, withThreads: false });
      return {
        data: {
          repository: {
            pullRequest: {
              comments: {
                pageInfo: page(false),
                nodes: [{ fullDatabaseId: "2", reactionGroups: groups("LAUGH") }],
              },
            },
          },
        },
      };
    });

    const result = await client.fetchQuery(prViewerReactionsQueryOptions("demo", "repo", 7));

    expect(calls).toHaveLength(2);
    expect([...result.comments.keys()]).toEqual([1, 2]);
    expect([...(result.comments.get(2)?.keys() ?? [])]).toEqual(["laugh"]);
  });
});

describe("Issue viewer reactions", () => {
  test("the issue body and its comments come back in one request", async () => {
    const calls = fixtureFetch(() => ({
      data: {
        repository: {
          issue: {
            reactionGroups: groups("HOORAY"),
            comments: {
              pageInfo: page(false),
              nodes: [
                { fullDatabaseId: "6249517709", reactionGroups: groups("CONFUSED") },
                { fullDatabaseId: "6249782692", reactionGroups: groups() },
              ],
            },
          },
        },
      },
    }));

    const result = await client.fetchQuery(issueViewerReactionsQueryOptions("demo", "repo", 56));

    expect(calls).toHaveLength(1);
    expect([...result.subject.keys()]).toEqual(["hooray"]);
    expect([...result.comments.keys()]).toEqual([6249517709]);
    expect([...(result.comments.get(6249517709)?.keys() ?? [])]).toEqual(["confused"]);
  });
});

describe("Toggling a viewer reaction in the cache", () => {
  const key = viewerReactionKeys.pr("demo", "repo", 790);
  const mineOn = (target: { kind: "comment" | "reviewComment"; id: number }) => {
    const data = client.getQueryData<ViewerReactions>(key);
    const map = target.kind === "comment" ? data?.comments : data?.reviewComments;
    return Object.fromEntries(map?.get(target.id) ?? []);
  };
  const seed = () =>
    client.setQueryData<ViewerReactions>(key, {
      subject: new Map(),
      comments: new Map([[11, new Map([["heart", UNRESOLVED_REACTION_ID]])]]),
      reviewComments: new Map(),
    });

  test("adding shows as mine at once, then keeps the id GitHub returns", () => {
    seed();
    const target = { kind: "reviewComment", id: 22 } as const;

    applyViewerReactionToggle(client, key, target, "rocket", false);
    expect(Object.keys(mineOn(target))).toEqual(["rocket"]);

    confirmViewerReaction(client, key, target, "rocket", 9001);
    expect(mineOn(target)).toEqual({ rocket: 9001 });
  });

  test("removing clears it at once and stays cleared once GitHub confirms", () => {
    seed();
    const target = { kind: "comment", id: 11 } as const;

    applyViewerReactionToggle(client, key, target, "heart", true);
    expect(mineOn(target)).toEqual({});

    confirmViewerReaction(client, key, target, "heart", null);
    expect(mineOn(target)).toEqual({});
  });

  test("a failed toggle rolls back only its own comment", () => {
    seed();
    const failing = { kind: "comment", id: 11 } as const;
    const other = { kind: "reviewComment", id: 22 } as const;

    const { prevMine } = applyViewerReactionToggle(client, key, failing, "heart", true);
    applyViewerReactionToggle(client, key, other, "eyes", false);
    rollbackViewerReaction(client, key, failing, prevMine);

    expect(mineOn(failing)).toEqual({ heart: UNRESOLVED_REACTION_ID });
    expect(Object.keys(mineOn(other))).toEqual(["eyes"]);
  });

  test("the issue body toggles before its reactions have loaded", () => {
    const issueKey = viewerReactionKeys.issue("demo", "repo", 56);
    applyViewerReactionToggle(client, issueKey, { kind: "subject", number: 56 }, "+1", false);
    confirmViewerReaction(client, issueKey, { kind: "subject", number: 56 }, "+1", 5);
    expect(Object.fromEntries(client.getQueryData<ViewerReactions>(issueKey)!.subject)).toEqual({
      "+1": 5,
    });
  });
});

describe("Resolving a reaction id for removal", () => {
  test("asks GitHub for that comment's reactions of that kind and picks the viewer's", async () => {
    const calls = fixtureFetch(({ url }) => {
      expect(url.pathname).toBe("/repos/demo/repo/pulls/comments/22/reactions");
      expect(url.searchParams.get("content")).toBe("rocket");
      return [
        { id: 1, content: "rocket", user: { id: 500 } },
        { id: 2, content: "rocket", user: { id: 42 } },
      ];
    });

    const id = await resolveMyReactionId(
      "demo",
      "repo",
      { kind: "reviewComment", id: 22 },
      "rocket",
      42,
    );

    expect(id).toBe(2);
    expect(calls).toHaveLength(1);
  });

  test("returns null when the viewer's reaction is already gone", async () => {
    fixtureFetch(({ url }) => {
      expect(url.pathname).toBe("/repos/demo/repo/issues/56/reactions");
      return [{ id: 1, content: "+1", user: { id: 500 } }];
    });

    expect(
      await resolveMyReactionId("demo", "repo", { kind: "subject", number: 56 }, "+1", 42),
    ).toBeNull();
  });
});
