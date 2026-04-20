import { CheckCircle2, CircleDot, MessageSquare } from "lucide-react";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { AssigneeList } from "@/app/features/issues/components/AssigneeList";
import { LabelPill } from "@/app/features/issues/components/LabelPill";
import type { RepoIssue } from "@/app/features/issues/schemas";
import { REACTION_CONTENTS, REACTION_EMOJIS, reactionsHaveAny } from "@/app/features/issues/utils";
import { formatRelativeTime } from "@/app/lib/time";

export function IssueRow({ issue, onClick }: { issue: RepoIssue; onClick: () => void }) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open issue #${issue.number}: ${issue.title}`}
        className="absolute inset-0 rounded-none outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
      />

      <div className="pointer-events-none relative flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5">
        <div className="mt-0.5 flex-shrink-0">
          {issue.state === "open" ? (
            <CircleDot className="size-4 text-[var(--color-success)]" />
          ) : (
            <CheckCircle2 className="size-4 text-[var(--color-fg-faint)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-body font-medium text-foreground">{issue.title}</span>
            {issue.labels.map((label) => (
              <LabelPill key={label.id} label={label} size="xs" />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-[var(--color-fg-faint)]">
            <span>
              <span className="font-mono">#{issue.number}</span>
              {" · "}
              {issue.state === "open" ? "opened" : "closed"}{" "}
              {formatRelativeTime(
                issue.state === "open" ? issue.created_at : (issue.closed_at ?? issue.updated_at),
              )}
              {" by "}
              <ProfileLink
                login={issue.user.login}
                className="pointer-events-auto text-muted-foreground"
              >
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
          </div>
        </div>
        {issue.assignees.length > 0 && (
          <div className="mt-0.5">
            <AssigneeList assignees={issue.assignees} variant="stack" max={3} />
          </div>
        )}
      </div>
    </div>
  );
}
