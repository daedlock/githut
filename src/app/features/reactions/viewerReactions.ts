import {
  type QueryClient,
  type QueryKey,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  EMPTY_MY_REACTIONS,
  type MyReactionsMap,
  type ReactionContent,
  ReactionListSchema,
} from "@/app/features/issues/schemas";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

// ─── Viewer reactions (#61) ─────────────────────────────────────────────────
//
// Which reactions on a conversation are the viewer's. REST only answers that
// one comment at a time (GET …/comments/{id}/reactions), which cost one
// request per comment. GraphQL's `reactionGroups.viewerHasReacted` answers it
// for every comment of a PR or issue in one request, joined to REST comment
// ids through `fullDatabaseId`.
//
// GraphQL doesn't give the reaction's REST id, which DELETE needs. A reaction
// known only from GraphQL is stored as UNRESOLVED_REACTION_ID; removing it
// looks the id up for that one comment at click time (resolveMyReactionId).

/** A viewer reaction whose REST id isn't known yet (resolved lazily on removal). */
export const UNRESOLVED_REACTION_ID = 0;

export type ViewerReactions = {
  /** The issue body itself (unused for PRs). */
  subject: MyReactionsMap;
  /** Issue comments, including PR conversation comments, by REST id. Only comments with a viewer reaction. */
  comments: Map<number, MyReactionsMap>;
  /** PR review (diff) comments, by REST id. Only comments with a viewer reaction. */
  reviewComments: Map<number, MyReactionsMap>;
};

export type ReactionTarget =
  | { kind: "subject"; number: number }
  | { kind: "comment"; id: number }
  | { kind: "reviewComment"; id: number };

export const viewerReactionKeys = {
  // Under the "pulls" prefix so PR-wide invalidations reach it.
  pr: (owner: string, repo: string, number: number | undefined) =>
    ["pulls", "viewer-reactions", owner, repo, number] as const,
  issue: (owner: string, repo: string, number: number | undefined) =>
    ["repo-issue-viewer-reactions", owner, repo, number] as const,
};

// ─── GraphQL → map ──────────────────────────────────────────────────────────

const GRAPHQL_CONTENT: Record<string, ReactionContent> = {
  THUMBS_UP: "+1",
  THUMBS_DOWN: "-1",
  LAUGH: "laugh",
  HOORAY: "hooray",
  CONFUSED: "confused",
  HEART: "heart",
  ROCKET: "rocket",
  EYES: "eyes",
};

type ReactionGroup = { content: string; viewerHasReacted: boolean };
type ReactableNode = { fullDatabaseId?: string | null; reactionGroups?: ReactionGroup[] | null };
type PageInfo = { hasNextPage?: boolean; endCursor?: string | null };

function mineFromGroups(groups: ReactionGroup[] | null | undefined): MyReactionsMap {
  const mine: MyReactionsMap = new Map();
  for (const group of groups ?? []) {
    const content = GRAPHQL_CONTENT[group.content];
    if (content && group.viewerHasReacted) mine.set(content, UNRESOLVED_REACTION_ID);
  }
  return mine;
}

function collect(into: Map<number, MyReactionsMap>, nodes: ReactableNode[] | null | undefined) {
  for (const node of nodes ?? []) {
    const id = Number(node.fullDatabaseId);
    if (!Number.isSafeInteger(id)) continue;
    const mine = mineFromGroups(node.reactionGroups);
    if (mine.size > 0) into.set(id, mine);
  }
}

const emptyViewerReactions = (): ViewerReactions => ({
  subject: new Map(),
  comments: new Map(),
  reviewComments: new Map(),
});

const REACTABLE = `fullDatabaseId reactionGroups { content viewerHasReacted }`;

// Known limits: threads report only their first 100 comments; newly arrived comments
// get viewer state on the next stale refetch (60s), not every live counts poll.
// Each comment selection still owns a cache observer, but makes no extra request.
const PR_VIEWER_REACTIONS_QUERY = `
  query(
    $owner: String!, $repo: String!, $number: Int!,
    $commentsAfter: String, $threadsAfter: String,
    $withComments: Boolean!, $withThreads: Boolean!
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: 100, after: $commentsAfter) @include(if: $withComments) {
          pageInfo { hasNextPage endCursor }
          nodes { ${REACTABLE} }
        }
        reviewThreads(first: 100, after: $threadsAfter) @include(if: $withThreads) {
          pageInfo { hasNextPage endCursor }
          nodes { comments(first: 100) { nodes { ${REACTABLE} } } }
        }
      }
    }
  }
`;

type PrViewerReactionsResponse = {
  repository?: {
    pullRequest?: {
      comments?: { pageInfo?: PageInfo; nodes?: ReactableNode[] };
      reviewThreads?: {
        pageInfo?: PageInfo;
        nodes?: Array<{ comments?: { nodes?: ReactableNode[] } }>;
      };
    } | null;
  } | null;
};

export const prViewerReactionsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions<ViewerReactions, Error, ViewerReactions, QueryKey>({
    queryKey: viewerReactionKeys.pr(owner, repo, number),
    // Not polled: counts stay live through the REST comment lists, and the
    // viewer's own toggles write here directly.
    staleTime: 60_000,
    queryFn: async (): Promise<ViewerReactions> => {
      const client = getGitHubClient();
      const out = emptyViewerReactions();
      let comments: { after: string | null } | null = { after: null };
      let threads: { after: string | null } | null = { after: null };
      while (comments || threads) {
        const res = (await client.graphql(PR_VIEWER_REACTIONS_QUERY, {
          owner,
          repo,
          number,
          commentsAfter: comments?.after ?? null,
          threadsAfter: threads?.after ?? null,
          withComments: !!comments,
          withThreads: !!threads,
        })) as PrViewerReactionsResponse;
        const pr = res.repository?.pullRequest;
        if (comments) {
          collect(out.comments, pr?.comments?.nodes);
          const info = pr?.comments?.pageInfo;
          comments = info?.hasNextPage && info.endCursor ? { after: info.endCursor } : null;
        }
        if (threads) {
          for (const thread of pr?.reviewThreads?.nodes ?? []) {
            collect(out.reviewComments, thread.comments?.nodes);
          }
          const info = pr?.reviewThreads?.pageInfo;
          threads = info?.hasNextPage && info.endCursor ? { after: info.endCursor } : null;
        }
      }
      return out;
    },
  });

const ISSUE_VIEWER_REACTIONS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        reactionGroups { content viewerHasReacted }
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${REACTABLE} }
        }
      }
    }
  }
`;

type IssueViewerReactionsResponse = {
  repository?: {
    issue?: {
      reactionGroups?: ReactionGroup[] | null;
      comments?: { pageInfo?: PageInfo; nodes?: ReactableNode[] };
    } | null;
  } | null;
};

export const issueViewerReactionsQueryOptions = (owner: string, repo: string, number: number) =>
  queryOptions<ViewerReactions, Error, ViewerReactions, QueryKey>({
    queryKey: viewerReactionKeys.issue(owner, repo, number),
    staleTime: 60_000,
    queryFn: async (): Promise<ViewerReactions> => {
      const client = getGitHubClient();
      const out = emptyViewerReactions();
      let after: string | null = null;
      let first = true;
      while (first || after) {
        const res = (await client.graphql(ISSUE_VIEWER_REACTIONS_QUERY, {
          owner,
          repo,
          number,
          after,
        })) as IssueViewerReactionsResponse;
        const issue = res.repository?.issue;
        if (first) out.subject = mineFromGroups(issue?.reactionGroups);
        first = false;
        collect(out.comments, issue?.comments?.nodes);
        const info = issue?.comments?.pageInfo;
        after = info?.hasNextPage && info.endCursor ? info.endCursor : null;
      }
      return out;
    },
  });

// ─── Toggle cache logic ─────────────────────────────────────────────────────
//
// Toggles write straight into the shared viewer-reactions entry. Rollback
// restores only the toggled comment, so a failure can't undo another
// comment's toggle that is still in flight.

/** Marks a reaction as added while its POST is in flight. */
const PENDING_REACTION_ID = -1;

type ReactionAccess = {
  path: string;
  parameter: string;
  read(data: ViewerReactions, id: number): MyReactionsMap;
  write(data: ViewerReactions, id: number, mine: MyReactionsMap): ViewerReactions;
};
function commentAccess(path: string, field: "comments" | "reviewComments"): ReactionAccess {
  return {
    path,
    parameter: "comment_id",
    read: (data, id) => data[field].get(id) ?? EMPTY_MY_REACTIONS,
    write: (data, id, mine) => {
      const next = new Map(data[field]);
      if (mine.size) next.set(id, mine);
      else next.delete(id);
      return { ...data, [field]: next };
    },
  };
}
const endpoints: Record<ReactionTarget["kind"], ReactionAccess> = {
  subject: {
    path: "issues",
    parameter: "issue_number",
    read: (data) => data.subject,
    write: (data, _id, mine) => ({ ...data, subject: mine }),
  },
  comment: commentAccess("issues/comments", "comments"),
  reviewComment: commentAccess("pulls/comments", "reviewComments"),
};
const targetId = (target: ReactionTarget) => ("number" in target ? target.number : target.id);

function reactionEndpoint(target: ReactionTarget) {
  const endpoint = endpoints[target.kind];
  return {
    url: `/repos/{owner}/{repo}/${endpoint.path}/{${endpoint.parameter}}/reactions`,
    params: { [endpoint.parameter]: targetId(target) },
  };
}

export function bumpReaction<T extends { reactions: Record<ReactionContent, number> }>(
  item: T,
  content: ReactionContent,
  delta: number,
): T {
  return {
    ...item,
    reactions: { ...item.reactions, [content]: Math.max(0, item.reactions[content] + delta) },
  };
}

function mineFor(data: ViewerReactions | undefined, target: ReactionTarget): MyReactionsMap {
  return data ? endpoints[target.kind].read(data, targetId(target)) : EMPTY_MY_REACTIONS;
}
function withMine(
  data: ViewerReactions | undefined,
  target: ReactionTarget,
  mine: MyReactionsMap,
): ViewerReactions {
  return endpoints[target.kind].write(data ?? emptyViewerReactions(), targetId(target), mine);
}

function writeMine(
  queryClient: QueryClient,
  key: QueryKey,
  target: ReactionTarget,
  update: (mine: MyReactionsMap) => MyReactionsMap,
) {
  queryClient.setQueryData<ViewerReactions>(key, (data) =>
    withMine(data, target, update(mineFor(data, target))),
  );
}

/** Optimistically flips one reaction; returns what to restore on failure. */
export function applyViewerReactionToggle(
  queryClient: QueryClient,
  key: QueryKey,
  target: ReactionTarget,
  content: ReactionContent,
  removing: boolean,
): { prevMine: MyReactionsMap } {
  const prevMine = mineFor(queryClient.getQueryData<ViewerReactions>(key), target);
  writeMine(queryClient, key, target, (mine) => {
    const next = new Map(mine);
    if (removing) next.delete(content);
    else next.set(content, PENDING_REACTION_ID);
    return next;
  });
  return { prevMine };
}

export function rollbackViewerReaction(
  queryClient: QueryClient,
  key: QueryKey,
  target: ReactionTarget,
  prevMine: MyReactionsMap,
) {
  writeMine(queryClient, key, target, () => prevMine);
}

/** Records GitHub's answer: the new reaction's id, or null once removed. */
export function confirmViewerReaction(
  queryClient: QueryClient,
  key: QueryKey,
  target: ReactionTarget,
  content: ReactionContent,
  reactionId: number | null,
) {
  writeMine(queryClient, key, target, (mine) => {
    const next = new Map(mine);
    if (reactionId != null) next.set(content, reactionId);
    else next.delete(content);
    return next;
  });
}

// ─── Lazy id lookup ─────────────────────────────────────────────────────────

/**
 * The REST id of the viewer's `content` reaction on one comment (or issue
 * body), fetched only when removing a reaction whose id we don't know.
 * Null when the viewer has no such reaction any more.
 */
export async function resolveMyReactionId(
  owner: string,
  repo: string,
  target: ReactionTarget,
  content: ReactionContent,
  meId: number | undefined,
): Promise<number | null> {
  if (!meId) return null;
  const client = getGitHubClient();
  const params = { owner, repo, content, per_page: 100 };
  for (let page = 1; ; page++) {
    const endpoint = reactionEndpoint(target);
    const res = await client.request(`GET ${endpoint.url}`, {
      ...params,
      ...endpoint.params,
      page,
    });
    const list = ReactionListSchema.parse(res.data);
    const mine = list.find((r) => r.user?.id === meId && r.content === content);
    if (mine) return mine.id;
    if (list.length < params.per_page) return null;
  }
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** Shared hook shape; each conversation keeps its established cache key and loader. */
export function useViewerReactions<T = ViewerReactions>(
  kind: "pr" | "issue",
  owner: string,
  repo: string,
  number: number | undefined,
  select?: (data: ViewerReactions) => T,
) {
  const token = useAuthStore((state) => state.token);
  const options = kind === "pr" ? prViewerReactionsQueryOptions : issueViewerReactionsQueryOptions;
  return useQuery({
    ...options(owner, repo, number ?? 0),
    enabled: !!token && !!owner && !!repo && !!number && Number.isFinite(number),
    select,
  });
}

export function usePrViewerReactions<T = ViewerReactions>(
  owner: string,
  repo: string,
  number: number | undefined,
  select?: (data: ViewerReactions) => T,
) {
  return useViewerReactions("pr", owner, repo, number, select);
}

export function useIssueViewerReactions<T = ViewerReactions>(
  owner: string,
  repo: string,
  number: number | undefined,
  select?: (data: ViewerReactions) => T,
) {
  return useViewerReactions("issue", owner, repo, number, select);
}

export const selectMine =
  (target: ReactionTarget) =>
  (data: ViewerReactions): MyReactionsMap =>
    mineFor(data, target);

export type ReactionToggleVars = {
  content: ReactionContent;
  /** The viewer's current reaction id; present (even if unresolved) means remove. */
  existingReactionId?: number;
};

/** POSTs or DELETEs one reaction. Returns the new reaction's id, or null after a removal. */
async function sendReactionToggle(
  owner: string,
  repo: string,
  target: ReactionTarget,
  { content, existingReactionId }: ReactionToggleVars,
  meId: number | undefined,
): Promise<number | null> {
  const client = getGitHubClient();
  const headers = { accept: "application/vnd.github+json" };
  const endpoint = reactionEndpoint(target);
  if (existingReactionId !== undefined) {
    const reactionId =
      existingReactionId > 0
        ? existingReactionId
        : await resolveMyReactionId(owner, repo, target, content, meId);
    // Already gone on GitHub: the removal is done.
    if (reactionId == null) return null;
    await client.request(`DELETE ${endpoint.url}/{reaction_id}`, {
      owner,
      repo,
      ...endpoint.params,
      reaction_id: reactionId,
      headers,
    });
    return null;
  }
  const res = await client.request(`POST ${endpoint.url}`, {
    owner,
    repo,
    ...endpoint.params,
    content,
    headers,
  });
  return (res.data as { id: number }).id;
}

/**
 * Toggle one of the viewer's reactions, optimistically:
 *   onMutate  — flip the count in `countsKey` and the viewer's state in `reactionsKey`
 *   onError   — restore the counts and that one target's viewer state
 *   onSuccess — record the new reaction's id so the next click can DELETE it
 *   onSettled — resync the counts
 * Toggles in one conversation run one after another (mutation scope), so a
 * quick add-then-remove deletes the reaction the add created.
 */
export function useViewerReactionToggle<V extends ReactionToggleVars, T>(
  conversation: {
    kind: "pr" | "issue";
    owner: string;
    repo: string;
    number: number | undefined;
    meId: number | undefined;
  },
  {
    countsKey,
    targetOf,
    patchCounts,
  }: {
    countsKey: QueryKey;
    targetOf: (vars: V) => ReactionTarget;
    patchCounts: (data: T, vars: V, delta: number) => T;
  },
) {
  const { owner, repo, meId } = conversation;
  const reactionsKey = viewerReactionKeys[conversation.kind](owner, repo, conversation.number);
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: JSON.stringify(reactionsKey) },
    mutationFn: (vars: V) => sendReactionToggle(owner, repo, targetOf(vars), vars, meId),
    onMutate: async (vars) => {
      const removing = vars.existingReactionId !== undefined;
      await queryClient.cancelQueries({ queryKey: countsKey });
      await queryClient.cancelQueries({ queryKey: reactionsKey });
      const prevCounts = queryClient.getQueryData<T>(countsKey);
      if (prevCounts !== undefined) {
        queryClient.setQueryData<T>(countsKey, patchCounts(prevCounts, vars, removing ? -1 : 1));
      }
      const { prevMine } = applyViewerReactionToggle(
        queryClient,
        reactionsKey,
        targetOf(vars),
        vars.content,
        removing,
      );
      return { prevCounts, prevMine };
    },
    onError: (_err, vars, ctx) => {
      if (!ctx) return;
      if (ctx.prevCounts !== undefined) queryClient.setQueryData(countsKey, ctx.prevCounts);
      rollbackViewerReaction(queryClient, reactionsKey, targetOf(vars), ctx.prevMine);
    },
    onSuccess: (reactionId, vars) => {
      confirmViewerReaction(queryClient, reactionsKey, targetOf(vars), vars.content, reactionId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: countsKey });
    },
  });
}
