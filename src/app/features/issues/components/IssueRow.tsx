import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleDot, MessageSquare } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import { issueKeys } from "@/app/features/issues/hooks";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { IssueCommentsSchema, IssueDetailSchema } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { cn } from "@/app/lib/cn";
import { getGitHubClient } from "@/app/lib/github/client";
import { formatRelativeTime } from "@/app/lib/time";

export function IssueRow({
  issue,
  owner,
  repo,
}: {
  issue: RepoIssue;
  owner: string;
  repo: string;
}) {
  const qc = useQueryClient();
  const prefetch = () => {
    qc.prefetchQuery({
      queryKey: issueKeys.detail(owner, repo, issue.number),
      queryFn: async () => {
        const client = getGitHubClient();
        const res = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: issue.number,
        });
        return IssueDetailSchema.parse(res.data);
      },
    });
    qc.prefetchQuery({
      queryKey: issueKeys.comments(owner, repo, issue.number),
      queryFn: async () => {
        const client = getGitHubClient();
        const res = await client.request(
          "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
          { owner, repo, issue_number: issue.number, per_page: 100 },
        );
        return IssueCommentsSchema.parse(res.data);
      },
    });
  };

  const isOpen = issue.state === "open";
  const timeAt = isOpen ? issue.created_at : (issue.closed_at ?? issue.updated_at);
  const timeVerb = isOpen ? "opened" : "closed";

  return (
    <div className="group relative rounded-lg transition-colors hover:bg-muted">
      <div className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
        <div className="mt-0.5 flex-shrink-0">
          {isOpen ? (
            <CircleDot className="size-4 text-[var(--color-success)]" />
          ) : (
            <CheckCircle2 className="size-4 text-[var(--color-fg-faint)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/$owner/$repo/issues/$number"
            params={{ owner, repo, number: issue.number }}
            aria-label={`Open issue #${issue.number}: ${issue.title}`}
            data-keyboard-list-item
            onMouseEnter={prefetch}
            onFocus={prefetch}
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-sm outline-none",
              "after:absolute after:inset-0 after:z-10 after:rounded-lg after:content-['']",
              "focus-visible:after:ring-1 focus-visible:after:ring-foreground/20",
            )}
          >
            <span className="text-body font-[475] text-foreground">{issue.title}</span>
            {issue.labels.map((label) => (
              <LabelPill key={label.id} label={label} size="xs" className="relative z-20" />
            ))}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ui text-muted-foreground">
            <span>
              <span className="font-mono">#{issue.number}</span>
              {" · "}
              {timeVerb} {formatRelativeTime(timeAt)}
              {" by "}
              <ProfileLink login={issue.user.login} className="relative z-20 text-muted-foreground">
                {issue.user.login}
              </ProfileLink>
            </span>
            {issue.comments > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" />
                {issue.comments}
              </span>
            )}
            {reactionsHaveAny(issue.reactions) && (
              <span className="inline-flex items-center gap-1">
                {REACTION_CONTENTS.filter((k) => (issue.reactions[k] ?? 0) > 0)
                  .slice(0, 3)
                  .map((k) => (
                    <span key={k} className="text-caption">
                      {REACTION_EMOJIS[k]}
                      <span className="ml-0.5">{issue.reactions[k]}</span>
                    </span>
                  ))}
              </span>
            )}
            {issue.assignees.length > 0 && (
              <span className="inline-flex items-center">
                {issue.assignees.slice(0, 3).map((a) => (
                  <Avatar
                    key={a.login}
                    login={a.login}
                    avatarUrl={a.avatar_url}
                    size="sm"
                    className="-ml-1 first:ml-0 ring-1 ring-background"
                  />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
