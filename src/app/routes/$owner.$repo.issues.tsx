import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleDot, Clock3, MessageSquare, Plus, Search, X } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Button } from "@/app/components/ui/Button";
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
  if (typeof label === "string") {
    return {
      id: -(index + 1),
      name: label,
      color: "d4d4d8",
      description: null,
    };
  }
  return {
    id: label.id ?? index + 1,
    name: label.name,
    color: label.color ?? "d4d4d8",
    description: label.description ?? null,
  };
}

const IssueListItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  body: z
    .string()
    .nullable()
    .transform((body) => body ?? ""),
  user: NullableIssueUserSchema,
  labels: z.array(RawIssueLabelSchema).transform((labels) => labels.map(normalizeLabel)),
  assignees: z.array(NullableIssueUserSchema).default([]),
  pull_request: z.object({}).optional(),
});

const IssueDetailSchema = IssueListItemSchema;

const IssueCommentSchema = z.object({
  id: z.number(),
  body: z
    .string()
    .nullable()
    .transform((body) => body ?? ""),
  created_at: z.string(),
  updated_at: z.string(),
  user: NullableIssueUserSchema,
});

const IssueListSchema = z.array(IssueListItemSchema);
const IssueCommentsSchema = z.array(IssueCommentSchema);

type IssueStateFilter = "open" | "closed" | "all";
type RepoIssue = z.infer<typeof IssueListItemSchema>;
type RepoIssueComment = z.infer<typeof IssueCommentSchema>;

function useRepoIssues(owner: string, repo: string, state: IssueStateFilter) {
  return useQuery({
    queryKey: ["repo-issues", owner, repo, state],
    enabled: !!owner && !!repo,
    staleTime: 30_000,
    queryFn: async (): Promise<RepoIssue[]> => {
      const client = getGitHubClient();
      const res = await client.request("GET /repos/{owner}/{repo}/issues", {
        owner,
        repo,
        state,
        per_page: 100,
        sort: "updated",
        direction: "desc",
      });
      const parsed = IssueListSchema.parse(res.data);
      return parsed.filter((issue) => !issue.pull_request);
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
        issue_number: issueNumber,
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
      const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });
      return IssueCommentsSchema.parse(res.data);
    },
  });
}

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

function labelStyle(color: string) {
  return {
    backgroundColor: `#${color}`,
    color: pickTextColor(color),
  };
}

function IssuesPage() {
  const { owner, repo } = Route.useParams();
  const { issue: selectedIssueNumber } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [stateFilter, setStateFilter] = useState<IssueStateFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");

  const issuesQuery = useRepoIssues(owner, repo, stateFilter);
  const issueQuery = useRepoIssue(owner, repo, selectedIssueNumber);
  const commentsQuery = useRepoIssueComments(owner, repo, selectedIssueNumber);

  const filteredIssues = useMemo(() => {
    const list = issuesQuery.data ?? [];
    const query = searchText.trim().toLowerCase();
    if (!query) return list;
    return list.filter((issue) => {
      const inTitle = issue.title.toLowerCase().includes(query);
      const inBody = issue.body?.toLowerCase().includes(query);
      const inUser = issue.user.login.toLowerCase().includes(query);
      return inTitle || inBody || inUser;
    });
  }, [issuesQuery.data, searchText]);

  const openCount = useMemo(
    () => (issuesQuery.data ?? []).filter((item) => item.state === "open").length,
    [issuesQuery.data],
  );
  const closedCount = useMemo(
    () => (issuesQuery.data ?? []).filter((item) => item.state === "closed").length,
    [issuesQuery.data],
  );

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
    onSuccess: async (createdIssue) => {
      setIsComposing(false);
      setNewIssueTitle("");
      setNewIssueBody("");
      await queryClient.invalidateQueries({ queryKey: ["repo-issues", owner, repo] });
      await queryClient.invalidateQueries({ queryKey: ["repo-issue", owner, repo] });
      navigate({ search: { issue: createdIssue.number } });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ issueNumber, body }: { issueNumber: number; body: string }) => {
      const client = getGitHubClient();
      const res = await client.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          issue_number: issueNumber,
          body,
        },
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
    mutationFn: async ({
      issueNumber,
      nextState,
    }: {
      issueNumber: number;
      nextState: "open" | "closed";
    }) => {
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

  function onOpenIssue(issueNumber: number) {
    navigate({ search: { issue: issueNumber } });
  }

  function onBackToList() {
    navigate({ search: {} });
  }

  function onSubmitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newIssueTitle.trim();
    if (!title) return;
    createIssueMutation.mutate({ title, body: newIssueBody.trim() });
  }

  function onSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = newCommentBody.trim();
    if (!selectedIssueNumber || !body) return;
    createCommentMutation.mutate({ issueNumber: selectedIssueNumber, body });
  }

  const selectedIssue = issueQuery.data;
  const selectedIssueNumberExists =
    !!selectedIssueNumber && (issueQuery.isPending || issueQuery.isError || !!selectedIssue);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
      {selectedIssueNumberExists ? (
        <section className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={onBackToList}>
                <X className="h-3.5 w-3.5" />
                Back to issues
              </Button>
              {selectedIssue ? (
                <Button
                  variant={selectedIssue.state === "open" ? "secondary" : "primary"}
                  size="sm"
                  disabled={updateStateMutation.isPending}
                  onClick={() =>
                    updateStateMutation.mutate({
                      issueNumber: selectedIssue.number,
                      nextState: selectedIssue.state === "open" ? "closed" : "open",
                    })
                  }
                >
                  {selectedIssue.state === "open" ? "Close issue" : "Reopen issue"}
                </Button>
              ) : null}
            </div>

            {issueQuery.isPending ? (
              <StatusMessage>Loading issue...</StatusMessage>
            ) : issueQuery.isError ? (
              <StatusMessage tone="danger">Could not load this issue.</StatusMessage>
            ) : !selectedIssue ? (
              <StatusMessage tone="danger">This issue no longer exists.</StatusMessage>
            ) : (
              <>
                <header className="mb-5 border-b border-[var(--color-border)] pb-4">
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-2xl">
                    {selectedIssue.title}
                    <span className="ml-2 font-mono text-base text-[var(--color-fg-faint)] sm:text-lg">
                      #{selectedIssue.number}
                    </span>
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-muted)]">
                    <IssueStatePill state={selectedIssue.state} />
                    <span>
                      {selectedIssue.user.login} opened this issue{" "}
                      {formatRelativeTime(selectedIssue.created_at)}
                    </span>
                    <span className="text-[var(--color-fg-faint)]">-</span>
                    <span>{selectedIssue.comments} comments</span>
                  </div>
                </header>

                <article className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
                    <UserAvatar
                      login={selectedIssue.user.login}
                      avatarUrl={selectedIssue.user.avatar_url}
                    />
                    <p className="text-sm text-[var(--color-fg-muted)]">
                      <span className="font-medium text-[var(--color-fg)]">
                        {selectedIssue.user.login}
                      </span>{" "}
                      commented {formatRelativeTime(selectedIssue.created_at)}
                    </p>
                  </header>
                  <div className="p-4">
                    {selectedIssue.body?.trim() ? (
                      <div className="readme-prose max-w-none text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedIssue.body}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm italic text-[var(--color-fg-faint)]">
                        No description provided.
                      </p>
                    )}
                    {selectedIssue.labels.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
                        {selectedIssue.labels.map((label) => (
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
                    ) : null}
                  </div>
                </article>

                <div className="mt-4 space-y-3">
                  {commentsQuery.isPending ? (
                    <StatusMessage>Loading comments...</StatusMessage>
                  ) : commentsQuery.isError ? (
                    <StatusMessage tone="danger">Could not load comments.</StatusMessage>
                  ) : commentsQuery.data?.length ? (
                    commentsQuery.data.map((comment) => (
                      <article
                        key={comment.id}
                        className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
                      >
                        <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
                          <UserAvatar
                            login={comment.user.login}
                            avatarUrl={comment.user.avatar_url}
                          />
                          <p className="text-sm text-[var(--color-fg-muted)]">
                            <span className="font-medium text-[var(--color-fg)]">
                              {comment.user.login}
                            </span>{" "}
                            commented {formatRelativeTime(comment.created_at)}
                          </p>
                        </header>
                        <div className="p-4">
                          <div className="readme-prose max-w-none text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {comment.body}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <StatusMessage>No comments yet.</StatusMessage>
                  )}
                </div>

                <form
                  onSubmit={onSubmitComment}
                  className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
                >
                  <div className="flex items-center gap-3">
                    {me?.avatar_url ? (
                      <UserAvatar login={me.login} avatarUrl={me.avatar_url} size="lg" />
                    ) : null}
                    <p className="text-sm font-medium text-[var(--color-fg)]">Add a comment</p>
                  </div>
                  <textarea
                    value={newCommentBody}
                    onChange={(event) => setNewCommentBody(event.target.value)}
                    placeholder="Leave a comment"
                    rows={5}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]/30"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!newCommentBody.trim() || createCommentMutation.isPending}
                    >
                      {createCommentMutation.isPending ? "Posting..." : "Comment"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
          <header className="border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">
                  Issues
                </h1>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                  {(issuesQuery.data ?? []).length}
                </span>
              </div>
              <Button size="sm" onClick={() => setIsComposing((v) => !v)}>
                <Plus className="h-3.5 w-3.5" />
                {isComposing ? "Cancel" : "New issue"}
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1">
                <FilterButton
                  isActive={stateFilter === "open"}
                  onClick={() => setStateFilter("open")}
                  icon={<CircleDot className="h-3.5 w-3.5" />}
                  label={`${openCount} Open`}
                />
                <FilterButton
                  isActive={stateFilter === "closed"}
                  onClick={() => setStateFilter("closed")}
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label={`${closedCount} Closed`}
                />
                <FilterButton
                  isActive={stateFilter === "all"}
                  onClick={() => setStateFilter("all")}
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  label="All"
                />
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-faint)]" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search issues"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </header>

          {isComposing ? (
            <form
              onSubmit={onSubmitIssue}
              className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 sm:px-5"
            >
              <div className="space-y-3">
                <Input
                  value={newIssueTitle}
                  onChange={(event) => setNewIssueTitle(event.target.value)}
                  placeholder="Title"
                  className="h-9"
                />
                <textarea
                  value={newIssueBody}
                  onChange={(event) => setNewIssueBody(event.target.value)}
                  placeholder="Describe the issue"
                  rows={6}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]/30"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newIssueTitle.trim() || createIssueMutation.isPending}
                  >
                    {createIssueMutation.isPending ? "Opening..." : "Open issue"}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}

          <div className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
            {issuesQuery.isPending ? (
              <div className="px-4 py-8 sm:px-5">
                <StatusMessage>Loading issues...</StatusMessage>
              </div>
            ) : issuesQuery.isError ? (
              <div className="px-4 py-8 sm:px-5">
                <StatusMessage tone="danger">
                  Could not load issues for this repository.
                </StatusMessage>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-5">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-faint)]">
                  No matching issues
                </p>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onOpenIssue(issue.number)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)] sm:px-5"
                >
                  {issue.state === "open" ? (
                    <CircleDot className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-success)]" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-fg-muted)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 truncate text-sm font-medium text-[var(--color-fg)]">
                      {issue.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                      <span>#{issue.number}</span>
                      <span>opened {formatRelativeTime(issue.created_at)}</span>
                      <span>by {issue.user.login}</span>
                      {issue.comments > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-fg-faint)]">
                          <MessageSquare className="h-3 w-3" />
                          {issue.comments}
                        </span>
                      ) : null}
                    </div>
                    {issue.labels.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {issue.labels.map((label) => (
                          <span
                            key={label.id}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={labelStyle(label.color)}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function IssueStatePill({ state }: { state: "open" | "closed" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        state === "open"
          ? "bg-[var(--color-bg-sunken)] text-[var(--color-success)]"
          : "bg-[var(--color-bg-sunken)] text-[var(--color-fg-muted)]",
      )}
    >
      {state === "open" ? <CircleDot className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {state === "open" ? "Open" : "Closed"}
    </span>
  );
}

function FilterButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-xs font-medium transition-colors",
        isActive
          ? "border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-fg)]"
          : "border-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function UserAvatar({
  login,
  avatarUrl,
  size = "md",
}: {
  login: string;
  avatarUrl?: string;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "h-7 w-7" : "h-6 w-6";
  if (!avatarUrl) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-sunken)] text-[10px] font-mono uppercase text-[var(--color-fg-muted)]",
          dimension,
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
      className={cn("rounded-full border border-[var(--color-border)]", dimension)}
    />
  );
}
