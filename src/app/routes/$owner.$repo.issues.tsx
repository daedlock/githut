import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  MessageSquare,
  Plus,
  Search,
  Smile,
  Tag,
  User,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { z } from "zod";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Button } from "@/app/components/ui/Button";
import { CommentBox } from "@/app/components/ui/CommentBox";
import { Input } from "@/app/components/ui/Input";
import { useMe } from "@/app/hooks/useMe";
import { cn } from "@/app/lib/cn";
import { getGitHubClient } from "@/app/lib/github/client";

export const Route = createFileRoute("/$owner/$repo/issues")({
  validateSearch: (search: Record<string, unknown>) => {
    const value = Number(search.issue);
    if (Number.isInteger(value) && value > 0) return { issue: value };
    return {};
  },
  component: IssuesPage,
});

// ─── Schemas ────────────────────────────────────────────────────────────────

const IssueUserSchema = z.object({
  login: z.string(),
  avatar_url: z.string(),
  html_url: z.string().optional(),
});

const NullableIssueUserSchema = IssueUserSchema.nullish().transform((user) => ({
  login: user?.login ?? "ghost",
  avatar_url: user?.avatar_url ?? "",
  html_url: user?.html_url,
}));

const RawIssueLabelSchema = z.union([
  z.string(),
  z.object({
    id: z.number().optional(),
    name: z.string(),
    color: z.string().optional(),
    description: z.string().nullable().optional(),
  }),
]);

function normalizeLabel(label: z.infer<typeof RawIssueLabelSchema>, index: number) {
  if (typeof label === "string") return { id: -(index + 1), name: label, color: "d4d4d8", description: null };
  return {
    id: label.id ?? index + 1,
    name: label.name,
    color: label.color ?? "d4d4d8",
    description: label.description ?? null,
  };
}

const ReactionsSchema = z
  .object({
    "+1": z.number().default(0),
    "-1": z.number().default(0),
    laugh: z.number().default(0),
    hooray: z.number().default(0),
    confused: z.number().default(0),
    heart: z.number().default(0),
    rocket: z.number().default(0),
    eyes: z.number().default(0),
  })
  .optional()
  .default({ "+1": 0, "-1": 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 });

type ReactionContent = "+1" | "-1" | "laugh" | "hooray" | "confused" | "heart" | "rocket" | "eyes";
type ReactionsMap = z.infer<typeof ReactionsSchema>;

const REACTION_EMOJIS: Record<ReactionContent, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

const REACTION_CONTENTS: ReactionContent[] = ["+1", "-1", "laugh", "hooray", "confused", "heart", "rocket", "eyes"];

const IssueListItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  body: z.string().nullable().transform((b) => b ?? ""),
  user: NullableIssueUserSchema,
  labels: z.array(RawIssueLabelSchema).transform((ls) => ls.map(normalizeLabel)),
  assignees: z.array(NullableIssueUserSchema).default([]),
  reactions: ReactionsSchema,
  pull_request: z.object({}).optional(),
});

const IssueDetailSchema = IssueListItemSchema;

const IssueCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable().transform((b) => b ?? ""),
  created_at: z.string(),
  updated_at: z.string(),
  user: NullableIssueUserSchema,
  reactions: ReactionsSchema,
});

const IssueListSchema = z.array(IssueListItemSchema);
const IssueCommentsSchema = z.array(IssueCommentSchema);

type StateFilter = "open" | "closed";
type RepoIssue = z.infer<typeof IssueListItemSchema>;
type RepoIssueComment = z.infer<typeof IssueCommentSchema>;

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useRepoIssues(owner: string, repo: string) {
  return useQuery({
    queryKey: ["repo-issues", owner, repo],
    enabled: !!owner && !!repo,
    staleTime: 30_000,
    queryFn: async (): Promise<RepoIssue[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        state: "all",
        per_page: 100,
        sort: "updated",
        direction: "desc",
      });
      return IssueListSchema.parse(res.data).filter((i) => !i.pull_request);
    },
  });
}

function useRepoIssue(owner: string, repo: string, issueNumber: number | undefined) {
  return useQuery({
    queryKey: ["repo-issue", owner, repo, issueNumber],
    enabled: !!owner && !!repo && !!issueNumber,
    queryFn: async (): Promise<RepoIssue> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        // biome-ignore lint/style/noNonNullAssertion: enabled guard ensures this is defined
        issue_number: issueNumber!,
      });
      return IssueDetailSchema.parse(res.data);
    },
  });
}

function useRepoIssueComments(owner: string, repo: string, issueNumber: number | undefined) {
  return useQuery({
    queryKey: ["repo-issue-comments", owner, repo, issueNumber],
    enabled: !!owner && !!repo && !!issueNumber,
    queryFn: async (): Promise<RepoIssueComment[]> => {
      const client = getGitHubClient();
      const res = await client.request(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          // biome-ignore lint/style/noNonNullAssertion: enabled guard ensures this is defined
          issue_number: issueNumber!,
          per_page: 100,
        },
      );
      return IssueCommentsSchema.parse(res.data);
    },
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function formatRelativeTime(dateIso: string): string {
  const diff = Date.now() - new Date(dateIso).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(dateIso).toISOString().slice(0, 10);
}

function pickTextColor(hexColor: string): "#111827" | "#f9fafb" {
  const hex = hexColor.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#111827";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.63 ? "#111827" : "#f9fafb";
}

function labelStyle(color: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `#${color}`, color: pickTextColor(color) };
}

function reactionsHaveAny(reactions: ReactionsMap): boolean {
  return REACTION_CONTENTS.some((k) => (reactions[k] ?? 0) > 0);
}

// ─── Page ───────────────────────────────────────────────────────────────────

function IssuesPage() {
  const { owner, repo } = Route.useParams();
  const { issue: selectedIssueNumber } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [searchText, setSearchText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");

  const issuesQuery = useRepoIssues(owner, repo);
  const issueQuery = useRepoIssue(owner, repo, selectedIssueNumber);
  const commentsQuery = useRepoIssueComments(owner, repo, selectedIssueNumber);

  const openCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "open").length,
    [issuesQuery.data],
  );
  const closedCount = useMemo(
    () => (issuesQuery.data ?? []).filter((i) => i.state === "closed").length,
    [issuesQuery.data],
  );

  const filteredIssues = useMemo(() => {
    const list = (issuesQuery.data ?? []).filter((i) => i.state === stateFilter);
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q) ||
        i.user.login.toLowerCase().includes(q),
    );
  }, [issuesQuery.data, stateFilter, searchText]);

  const createIssueMutation = useMutation({
    mutationFn: async ({ title, body }: { title: string; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request("POST /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        title,
        body,
      });
      return IssueDetailSchema.parse(res.data);
    },
    onSuccess: async (created) => {
      setIsComposing(false);
      setNewIssueTitle("");
      setNewIssueBody("");
      await queryClient.invalidateQueries({ queryKey: ["repo-issues", owner, repo] });
      await queryClient.invalidateQueries({ queryKey: ["repo-issue", owner, repo] });
      navigate({ search: { issue: created.number } });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ issueNumber, body }: { issueNumber: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: issueNumber, body },
      );
      return IssueCommentSchema.parse(res.data);
    },
    onSuccess: async () => {
      setNewCommentBody("");
      await queryClient.invalidateQueries({
        queryKey: ["repo-issue-comments", owner, repo, selectedIssueNumber],
      });
      await queryClient.invalidateQueries({
        queryKey: ["repo-issue", owner, repo, selectedIssueNumber],
      });
      await queryClient.invalidateQueries({ queryKey: ["repo-issues", owner, repo] });
    },
  });

  const updateStateMutation = useMutation({
    mutationFn: async ({ issueNumber, nextState }: { issueNumber: number; nextState: "open" | "closed" }) => {
      const client = getGitHubClient();
      const res = await client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        owner,
        repo,
        issue_number: issueNumber,
        state: nextState,
      });
      return IssueDetailSchema.parse(res.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repo-issues", owner, repo] });
      await queryClient.invalidateQueries({
        queryKey: ["repo-issue", owner, repo, selectedIssueNumber],
      });
    },
  });

  const addIssueReactionMutation = useMutation({
    mutationFn: async ({ issueNumber, content }: { issueNumber: number; content: ReactionContent }) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/reactions", {
        owner,
        repo,
        issue_number: issueNumber,
        content,
        headers: { accept: "application/vnd.github+json" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["repo-issue", owner, repo, selectedIssueNumber],
      });
    },
  });

  const addCommentReactionMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: number; content: ReactionContent }) => {
      const client = getGitHubClient();
      await client.request("POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions", {
        owner,
        repo,
        comment_id: commentId,
        content,
        headers: { accept: "application/vnd.github+json" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["repo-issue-comments", owner, repo, selectedIssueNumber],
      });
    },
  });

  const selectedIssue = issueQuery.data;
  const isDetailView =
    !!selectedIssueNumber && (issueQuery.isPending || issueQuery.isError || !!selectedIssue);

  if (isDetailView) {
    return (
      <IssueDetail
        owner={owner}
        repo={repo}
        issue={selectedIssue}
        isLoading={issueQuery.isPending}
        isError={issueQuery.isError}
        comments={commentsQuery.data ?? []}
        commentsLoading={commentsQuery.isPending}
        commentsError={commentsQuery.isError}
        newCommentBody={newCommentBody}
        onNewCommentChange={setNewCommentBody}
        onSubmitComment={(e) => {
          e.preventDefault();
          const body = newCommentBody.trim();
          if (!selectedIssueNumber || !body) return;
          createCommentMutation.mutate({ issueNumber: selectedIssueNumber, body });
        }}
        onToggleState={() =>
          selectedIssue &&
          updateStateMutation.mutate({
            issueNumber: selectedIssue.number,
            nextState: selectedIssue.state === "open" ? "closed" : "open",
          })
        }
        isTogglingState={updateStateMutation.isPending}
        isPostingComment={createCommentMutation.isPending}
        onAddIssueReaction={(content) =>
          selectedIssue &&
          addIssueReactionMutation.mutate({ issueNumber: selectedIssue.number, content })
        }
        onAddCommentReaction={(commentId, content) =>
          addCommentReactionMutation.mutate({ commentId, content })
        }
        me={me}
        onBack={() => navigate({ search: {} })}
      />
    );
  }

  return (
    <IssueList
      owner={owner}
      repo={repo}
      issues={filteredIssues}
      isLoading={issuesQuery.isPending}
      isError={issuesQuery.isError}
      openCount={openCount}
      closedCount={closedCount}
      stateFilter={stateFilter}
      onStateFilter={setStateFilter}
      searchText={searchText}
      onSearch={setSearchText}
      isComposing={isComposing}
      onToggleCompose={() => {
        setIsComposing((v) => !v);
        setNewIssueTitle("");
        setNewIssueBody("");
      }}
      newIssueTitle={newIssueTitle}
      onNewIssueTitleChange={setNewIssueTitle}
      newIssueBody={newIssueBody}
      onNewIssueBodyChange={setNewIssueBody}
      onSubmitIssue={(e) => {
        e.preventDefault();
        const title = newIssueTitle.trim();
        if (!title) return;
        createIssueMutation.mutate({ title, body: newIssueBody.trim() });
      }}
      isSubmittingIssue={createIssueMutation.isPending}
      onOpenIssue={(n) => navigate({ search: { issue: n } })}
    />
  );
}

// ─── Issue List ──────────────────────────────────────────────────────────────

function IssueList({
  owner,
  repo,
  issues,
  isLoading,
  isError,
  openCount,
  closedCount,
  stateFilter,
  onStateFilter,
  searchText,
  onSearch,
  isComposing,
  onToggleCompose,
  newIssueTitle,
  onNewIssueTitleChange,
  newIssueBody,
  onNewIssueBodyChange,
  onSubmitIssue,
  isSubmittingIssue,
  onOpenIssue,
}: {
  owner: string;
  repo: string;
  issues: RepoIssue[];
  isLoading: boolean;
  isError: boolean;
  openCount: number;
  closedCount: number;
  stateFilter: StateFilter;
  onStateFilter: (s: StateFilter) => void;
  searchText: string;
  onSearch: (s: string) => void;
  isComposing: boolean;
  onToggleCompose: () => void;
  newIssueTitle: string;
  onNewIssueTitleChange: (s: string) => void;
  newIssueBody: string;
  onNewIssueBodyChange: (s: string) => void;
  onSubmitIssue: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmittingIssue: boolean;
  onOpenIssue: (n: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      {isComposing && (
        <form
          onSubmit={onSubmitIssue}
          className="mb-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
              New issue
            </span>
            <button
              type="button"
              onClick={onToggleCompose}
              className="rounded p-1 text-[var(--color-fg-faint)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <Input
              value={newIssueTitle}
              onChange={(e) => onNewIssueTitleChange(e.target.value)}
              placeholder="Issue title"
              className="h-9 text-sm font-medium"
              autoFocus
            />
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)] focus-within:border-[var(--color-focus)] focus-within:ring-2 focus-within:ring-[var(--color-focus)]/20">
              <CommentBox
                owner={owner}
                repo={repo}
                value={newIssueBody}
                onChange={onNewIssueBodyChange}
                placeholder="Describe the issue"
                rows={6}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onToggleCompose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newIssueTitle.trim() || isSubmittingIssue}>
                {isSubmittingIssue ? "Opening…" : "Open issue"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
        <header className="border-b border-[var(--color-border)] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center">
              <StateTab
                state="open"
                count={openCount}
                isActive={stateFilter === "open"}
                onClick={() => onStateFilter("open")}
              />
              <StateTab
                state="closed"
                count={closedCount}
                isActive={stateFilter === "closed"}
                onClick={() => onStateFilter("closed")}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-faint)]" />
                <Input
                  value={searchText}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search issues…"
                  className="h-8 w-52 pl-8 text-xs"
                />
              </div>
              <Button size="sm" onClick={onToggleCompose}>
                <Plus className="h-3.5 w-3.5" />
                New issue
              </Button>
            </div>
          </div>
        </header>

        <div className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
          {isLoading ? (
            <IssueListSkeleton />
          ) : isError ? (
            <div className="px-5 py-10 text-center">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-[var(--color-danger)]" />
              <p className="text-sm text-[var(--color-fg-muted)]">Could not load issues.</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="px-5 py-12 text-center">
              {stateFilter === "open" ? (
                <CircleDot className="mx-auto mb-3 h-6 w-6 text-[var(--color-fg-faint)]" />
              ) : (
                <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-[var(--color-fg-faint)]" />
              )}
              <p className="text-sm font-medium text-[var(--color-fg-muted)]">
                {searchText ? "No issues match your search." : `No ${stateFilter} issues.`}
              </p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} onClick={() => onOpenIssue(issue.number)} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StateTab({
  state,
  count,
  isActive,
  onClick,
}: {
  state: StateFilter;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors",
        isActive
          ? "font-semibold text-[var(--color-fg)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      {state === "open" ? (
        <CircleDot
          className={cn(
            "h-4 w-4",
            isActive ? "text-[var(--color-success)]" : "text-[var(--color-fg-faint)]",
          )}
        />
      ) : (
        <CheckCircle2
          className={cn(
            "h-4 w-4",
            isActive ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg-faint)]",
          )}
        />
      )}
      <span>{count}</span>
      <span className="capitalize">{state}</span>
    </button>
  );
}

function IssueRow({ issue, onClick }: { issue: RepoIssue; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)] sm:px-5"
    >
      <div className="mt-0.5 flex-shrink-0">
        {issue.state === "open" ? (
          <CircleDot className="h-4 w-4 text-[var(--color-success)]" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-[var(--color-fg-faint)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-[var(--color-fg)]">{issue.title}</span>
          {issue.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-px text-[10px] font-medium leading-5"
              style={labelStyle(label.color)}
              title={label.description ?? label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-fg-faint)]">
          <span>
            <span className="font-mono">#{issue.number}</span>
            {" · "}
            {issue.state === "open" ? "opened" : "closed"}{" "}
            {formatRelativeTime(
              issue.state === "open" ? issue.created_at : (issue.closed_at ?? issue.updated_at),
            )}
            {" by "}
            <span className="text-[var(--color-fg-muted)]">{issue.user.login}</span>
          </span>
          {issue.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {issue.comments}
            </span>
          )}
          {reactionsHaveAny(issue.reactions) && (
            <span className="inline-flex items-center gap-1">
              {REACTION_CONTENTS.filter((k) => (issue.reactions[k] ?? 0) > 0)
                .slice(0, 3)
                .map((k) => (
                  <span key={k} className="text-[11px]">
                    {REACTION_EMOJIS[k]}
                    <span className="ml-0.5">{issue.reactions[k]}</span>
                  </span>
                ))}
            </span>
          )}
        </div>
      </div>
      {issue.assignees.length > 0 && (
        <div className="mt-0.5 flex flex-shrink-0 -space-x-1.5">
          {issue.assignees.slice(0, 3).map((a) => (
            <UserAvatar key={a.login} login={a.login} avatarUrl={a.avatar_url} size="sm" />
          ))}
        </div>
      )}
    </button>
  );
}

function IssueListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-[var(--color-bg-sunken)]" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-4 rounded bg-[var(--color-bg-sunken)]"
              style={{ width: `${55 + (i * 13) % 35}%` }}
            />
            <div className="h-3 w-48 rounded bg-[var(--color-bg-sunken)]" />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Issue Detail ────────────────────────────────────────────────────────────

function IssueDetail({
  owner,
  repo,
  issue,
  isLoading,
  isError,
  comments,
  commentsLoading,
  commentsError,
  newCommentBody,
  onNewCommentChange,
  onSubmitComment,
  onToggleState,
  isTogglingState,
  isPostingComment,
  onAddIssueReaction,
  onAddCommentReaction,
  me,
  onBack,
}: {
  owner: string;
  repo: string;
  issue: RepoIssue | undefined;
  isLoading: boolean;
  isError: boolean;
  comments: RepoIssueComment[];
  commentsLoading: boolean;
  commentsError: boolean;
  newCommentBody: string;
  onNewCommentChange: (s: string) => void;
  onSubmitComment: (e: React.FormEvent<HTMLFormElement>) => void;
  onToggleState: () => void;
  isTogglingState: boolean;
  isPostingComment: boolean;
  onAddIssueReaction: (content: ReactionContent) => void;
  onAddCommentReaction: (commentId: number, content: ReactionContent) => void;
  me: { login: string; avatar_url: string } | undefined;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
          Back to issues
        </button>
        {issue && (
          <Button
            variant={issue.state === "open" ? "secondary" : "primary"}
            size="sm"
            disabled={isTogglingState}
            onClick={onToggleState}
          >
            {issue.state === "open" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Close issue
              </>
            ) : (
              <>
                <CircleDot className="h-3.5 w-3.5" />
                Reopen issue
              </>
            )}
          </Button>
        )}
      </div>

      {isLoading ? (
        <StatusMessage>Loading issue…</StatusMessage>
      ) : isError ? (
        <StatusMessage tone="danger">Could not load this issue.</StatusMessage>
      ) : !issue ? (
        <StatusMessage tone="danger">This issue no longer exists.</StatusMessage>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="text-xl font-semibold leading-snug tracking-tight text-[var(--color-fg)] sm:text-2xl">
              {issue.title}{" "}
              <span className="font-mono text-lg font-normal text-[var(--color-fg-faint)]">
                #{issue.number}
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-muted)]">
              <IssueStatePill state={issue.state} />
              <span>
                <span className="font-medium text-[var(--color-fg)]">{issue.user.login}</span>
                {" opened this issue "}
                {formatRelativeTime(issue.created_at)}
              </span>
              <span className="text-[var(--color-fg-faint)]">·</span>
              <span>
                {issue.comments} {issue.comments === 1 ? "comment" : "comments"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            {/* Main column */}
            <div className="min-w-0 flex-1 space-y-3">
              <CommentCard
                login={issue.user.login}
                avatarUrl={issue.user.avatar_url}
                date={issue.created_at}
                isAuthor
                reactions={issue.reactions}
                onAddReaction={onAddIssueReaction}
              >
                {issue.body?.trim() ? (
                  <div className="readme-prose max-w-none text-sm">
                    <GithubMarkdown>{issue.body}</GithubMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-[var(--color-fg-faint)]">
                    No description provided.
                  </p>
                )}
              </CommentCard>

              {commentsLoading ? (
                <StatusMessage>Loading comments…</StatusMessage>
              ) : commentsError ? (
                <StatusMessage tone="danger">Could not load comments.</StatusMessage>
              ) : (
                comments.map((c) => (
                  <CommentCard
                    key={c.id}
                    login={c.user.login}
                    avatarUrl={c.user.avatar_url}
                    date={c.created_at}
                    reactions={c.reactions}
                    onAddReaction={(content) => onAddCommentReaction(c.id, content)}
                  >
                    <div className="readme-prose max-w-none text-sm">
                      <GithubMarkdown>{c.body}</GithubMarkdown>
                    </div>
                  </CommentCard>
                ))
              )}

              <form
                onSubmit={onSubmitComment}
                className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)]"
              >
                <div className="flex items-center gap-2.5 rounded-t-[var(--radius-md)] border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
                  {me?.avatar_url && (
                    <UserAvatar login={me.login} avatarUrl={me.avatar_url} size="sm" />
                  )}
                  <span className="text-sm font-medium text-[var(--color-fg)]">Add a comment</span>
                </div>
                <CommentBox
                  owner={owner}
                  repo={repo}
                  value={newCommentBody}
                  onChange={onNewCommentChange}
                  placeholder="Leave a comment"
                  rows={4}
                />
                <div className="flex justify-end border-t border-[var(--color-border)] px-3 py-2.5">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newCommentBody.trim() || isPostingComment}
                  >
                    {isPostingComment ? "Posting…" : "Comment"}
                  </Button>
                </div>
              </form>
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-52 lg:flex-shrink-0">
              <div className="space-y-5">
                <SidebarSection icon={<Tag className="h-3.5 w-3.5" />} title="Labels">
                  {issue.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.labels.map((label) => (
                        <span
                          key={label.id}
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={labelStyle(label.color)}
                          title={label.description ?? label.name}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--color-fg-faint)]">None yet</span>
                  )}
                </SidebarSection>

                <SidebarSection icon={<User className="h-3.5 w-3.5" />} title="Assignees">
                  {issue.assignees.length > 0 ? (
                    <div className="space-y-1.5">
                      {issue.assignees.map((a) => (
                        <div key={a.login} className="flex items-center gap-2">
                          <UserAvatar login={a.login} avatarUrl={a.avatar_url} size="sm" />
                          <span className="text-xs text-[var(--color-fg-muted)]">{a.login}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--color-fg-faint)]">No one assigned</span>
                  )}
                </SidebarSection>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Reactions ───────────────────────────────────────────────────────────────

function ReactionsBar({
  reactions,
  onAdd,
}: {
  reactions: ReactionsMap;
  onAdd: (content: ReactionContent) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasAny = reactionsHaveAny(reactions);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-2.5">
      {REACTION_CONTENTS.filter((k) => (reactions[k] ?? 0) > 0).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onAdd(k)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-xs transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-sunken)]"
        >
          <span>{REACTION_EMOJIS[k]}</span>
          <span className="font-mono text-[var(--color-fg-muted)]">{reactions[k]}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          title="Add reaction"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            hasAny
              ? "border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]"
              : "border-dashed border-[var(--color-border)] text-[var(--color-fg-faint)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-muted)]",
          )}
        >
          <Smile className="h-3 w-3" />
        </button>

        {pickerOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
            />
            <div className="absolute left-0 top-full z-20 mt-1.5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-1.5 shadow-lg">
              {REACTION_CONTENTS.map((k) => (
                <button
                  key={k}
                  type="button"
                  title={k}
                  onClick={() => {
                    onAdd(k);
                    setPickerOpen(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-[var(--color-bg-sunken)]"
                >
                  {REACTION_EMOJIS[k]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Comment Card ────────────────────────────────────────────────────────────

function CommentCard({
  login,
  avatarUrl,
  date,
  isAuthor,
  reactions,
  onAddReaction,
  children,
}: {
  login: string;
  avatarUrl?: string;
  date: string;
  isAuthor?: boolean;
  reactions: ReactionsMap;
  onAddReaction: (content: ReactionContent) => void;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <header className="flex items-center gap-2.5 overflow-hidden rounded-t-[var(--radius-md)] border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
        <UserAvatar login={login} avatarUrl={avatarUrl} size="sm" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          <span className="font-medium text-[var(--color-fg)]">{login}</span>
          {" commented "}
          {formatRelativeTime(date)}
        </p>
        {isAuthor && (
          <span className="ml-auto rounded border border-[var(--color-border)] px-1.5 py-px font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            Author
          </span>
        )}
      </header>
      <div className="px-4 pb-3 pt-4">
        {children}
        <ReactionsBar reactions={reactions} onAdd={onAddReaction} />
      </div>
    </article>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function IssueStatePill({ state }: { state: "open" | "closed" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        state === "open"
          ? "bg-[var(--color-issue-open-bg)] text-[var(--color-issue-open-fg)]"
          : "bg-[var(--color-issue-closed-bg)] text-[var(--color-issue-closed-fg)]",
      )}
    >
      {state === "open" ? <CircleDot className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {state === "open" ? "Open" : "Closed"}
    </span>
  );
}

function SidebarSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 border-b border-[var(--color-border)] pb-1.5">
        <span className="text-[var(--color-fg-faint)]">{icon}</span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-fg-faint)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function UserAvatar({
  login,
  avatarUrl,
  size = "md",
}: {
  login: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";
  if (!avatarUrl) {
    return (
      <div
        className={cn(
          "inline-flex flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-sunken)] font-mono uppercase text-[var(--color-fg-muted)]",
          dim,
        )}
      >
        {login.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={avatarUrl}
      alt={login}
      className={cn("flex-shrink-0 rounded-full border border-[var(--color-border)]", dim)}
    />
  );
}
