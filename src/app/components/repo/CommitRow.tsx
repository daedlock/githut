import { Link } from "@tanstack/react-router";
import { Copy, GitCommit } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type { CommitSummary } from "@/app/hooks/useRepoCommits";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type CommitRowProps = {
  commit: CommitSummary;
  owner: string;
  repo: string;
};

/**
 * One commit in a list: message title (+ optional expandable body), author,
 * short SHA, relative time. Whole row is a link to the detail view; the SHA
 * chip has its own copy button that doesn't trigger navigation.
 */
export function CommitRow({ commit, owner, repo }: CommitRowProps) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const { title, body } = splitMessage(commit.commit.message);
  const shortSha = commit.sha.slice(0, 7);

  // Prefer the GitHub-mapped user (has login + avatar); fall back to the
  // git-native author for unmatched emails (render name only, no avatar).
  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <div className="group flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 transition-colors hover:bg-muted">
      {/* Title + body */}
      <div className="min-w-0 flex-1">
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner, repo, sha: commit.sha }}
          className="block outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
        >
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {title}
          </p>
        </Link>

        {body && (
          <>
            <button
              type="button"
              onClick={() => setBodyOpen((o) => !o)}
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-px",
                "font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]",
                "outline-none transition-colors",
                "hover:border-input hover:text-muted-foreground",
                "focus-visible:ring-1 focus-visible:ring-foreground/15",
              )}
              aria-expanded={bodyOpen}
            >
              {bodyOpen ? "hide body" : "…"}
            </button>
            {bodyOpen && (
              <pre className="mt-2 whitespace-pre-wrap rounded-sm bg-muted p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
                {body}
              </pre>
            )}
          </>
        )}

        {/* Author + time row */}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="size-4 flex-shrink-0 rounded-full border border-border"
            />
          ) : (
            <GitCommit className="size-3 flex-shrink-0 text-[var(--color-fg-faint)]" />
          )}
          {authorLogin ? (
            <ProfileLink login={authorLogin} className="truncate font-medium text-foreground">
              {displayAuthor}
            </ProfileLink>
          ) : (
            <span className="truncate font-medium text-foreground">{displayAuthor}</span>
          )}
          <span className="text-[var(--color-fg-faint)]">
            committed {formatRelativeTime(commit.commit.author.date)}
          </span>
        </div>
      </div>

      {/* Right side: SHA chip */}
      <ShaChip sha={commit.sha} shortSha={shortSha} owner={owner} repo={repo} />
    </div>
  );
}

function ShaChip({
  sha,
  shortSha,
  owner,
  repo,
}: {
  sha: string;
  shortSha: string;
  owner: string;
  repo: string;
}) {
  const [copied, setCopied] = useState(false);

  function onCopy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(sha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-0.5">
      <Link
        to="/$owner/$repo/commit/$sha"
        params={{ owner, repo, sha }}
        className={cn(
          "rounded-sm border border-border bg-background px-1.5 py-0.5",
          "font-mono text-caption tabular-nums text-muted-foreground",
          "outline-none transition-colors",
          "hover:border-input hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
        title={sha}
      >
        {shortSha}
      </Link>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onCopy}
        title={copied ? "Copied!" : "Copy full SHA"}
        aria-label="Copy full SHA"
      >
        <Copy />
      </Button>
    </div>
  );
}

/**
 * Git commit messages are "title\n\n<body>" by convention — split on the first
 * blank line so we can render the title prominent and hide the body behind a
 * toggle. Trims safely for messages without a body.
 */
function splitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, splitIdx).trim(),
    body: trimmed.slice(splitIdx + 2).trim(),
  };
}
