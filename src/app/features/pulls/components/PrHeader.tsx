import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, GitBranch, X } from "lucide-react";
import { useState } from "react";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { PrStatePill } from "@/app/features/pulls/components/PrStatePill";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrHeader ──────────────────────────────────────────────────────────────
//
// PR detail header. Mirrors `IssueDetail`'s top section: back link, title
// with `#number`, state pill, author meta. Adds PR-specific rows:
//   • base ← head refs (mono)
//   • commits · files · ±additions/deletions counts
//
// Kept presentational: all data comes from the full PR object returned by
// `useFullPr`. Actions (close / merge / ready-for-review) will plug in as
// a sibling in P7 via a `rightSlot` prop.

export type PrHeaderProps = {
  owner: string;
  repo: string;
  pr: PullRequest;
  rightSlot?: React.ReactNode;
};

export function PrHeader({ owner, repo, pr, rightSlot }: PrHeaderProps) {
  const state = toUiState(pr);
  const verb =
    state === "merged" ? "merged" : state === "closed" ? "closed" : "opened";
  const actionAt =
    state === "merged"
      ? pr.merged_at ?? pr.closed_at ?? pr.updated_at
      : state === "closed"
        ? pr.closed_at ?? pr.updated_at
        : pr.created_at;

  return (
    <div className="mb-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/$owner/$repo/pulls"
          params={{ owner, repo }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 -ml-1",
            "text-body text-muted-foreground outline-none transition-colors",
            "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          <X className="size-3.5" />
          Back to pull requests
        </Link>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
          {pr.title}{" "}
          <span className="font-mono text-title font-normal text-[var(--color-fg-faint)]">
            #{pr.number}
          </span>
        </h1>
        <HeaderLinks pr={pr} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        <PrStatePill state={state} />
        <span>
          {pr.user ? (
            <ProfileLink login={pr.user.login} className="font-medium text-foreground">
              {pr.user.login}
            </ProfileLink>
          ) : (
            <span className="font-medium text-foreground">ghost</span>
          )}
          {` ${verb} this pull request `}
          {formatRelativeTime(actionAt)}
        </span>
        <span className="text-[var(--color-fg-faint)]">·</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-caption">
          <GitBranch className="size-3 text-[var(--color-fg-faint)]" />
          <span className="text-muted-foreground">{pr.base.ref}</span>
          <span className="text-[var(--color-fg-faint)]">←</span>
          <span className="text-muted-foreground">{pr.head.ref}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-[var(--color-fg-faint)]">
        <span>
          <span className="tabular-nums text-muted-foreground">{pr.commits}</span>{" "}
          {pr.commits === 1 ? "commit" : "commits"}
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="tabular-nums text-muted-foreground">{pr.changed_files}</span>{" "}
          {pr.changed_files === 1 ? "file changed" : "files changed"}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          <span className="text-[var(--color-success)]">+{pr.additions}</span>{" "}
          <span className="text-[var(--color-danger)]">−{pr.deletions}</span>
        </span>
      </div>
    </div>
  );
}

function HeaderLinks({ pr }: { pr: PullRequest }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(pr.html_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-sm outline-none",
          "transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
        aria-label="Copy PR link"
        title={copied ? "Copied!" : "Copy link"}
      >
        {copied ? (
          <Check className="size-3.5 text-[var(--color-success)]" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <a
        href={pr.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-sm outline-none",
          "transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
        aria-label="Open on GitHub"
        title="Open on GitHub"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}
