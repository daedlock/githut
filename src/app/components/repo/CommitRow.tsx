import { Link } from "@tanstack/react-router";
import { Copy, GitCommit } from "lucide-react";
import { useState } from "react";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type { CommitSummary } from "@/app/hooks/useRepoCommits";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type CommitRowProps = {
  commit: CommitSummary;
  owner: string;
  repo: string;
};

export function CommitRow({ commit, owner, repo }: CommitRowProps) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const { title, body } = splitMessage(commit.commit.message);
  const shortSha = commit.sha.slice(0, 7);

  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
      {/* Left: title + meta */}
      <div className="min-w-0 flex-1">
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner, repo, sha: commit.sha }}
          className="block outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
        >
          <p className="text-body font-[475] text-foreground leading-snug">
            {title}
          </p>
        </Link>

        {body && (
          <>
            <button
              type="button"
              onClick={() => setBodyOpen((o) => !o)}
              className={cn(
                "mt-1 rounded-md bg-muted px-1.5 py-px",
                "text-micro text-muted-foreground",
                "outline-none transition-colors hover:text-foreground",
              )}
              aria-expanded={bodyOpen}
            >
              {bodyOpen ? "hide" : "···"}
            </button>
            {bodyOpen && (
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-caption leading-relaxed text-muted-foreground">
                {body}
              </pre>
            )}
          </>
        )}

        {/* Author + time */}
        <div className="mt-1 flex items-center gap-2 text-ui text-muted-foreground">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-4 shrink-0 rounded-full"
            />
          ) : (
            <GitCommit className="size-3 shrink-0 text-[var(--color-fg-faint)]" />
          )}
          {authorLogin ? (
            <ProfileLink login={authorLogin} className="truncate font-[475] text-foreground">
              {displayAuthor}
            </ProfileLink>
          ) : (
            <span className="truncate font-[475] text-foreground">{displayAuthor}</span>
          )}
          <span className="text-[var(--color-fg-faint)]">
            {formatRelativeTime(commit.commit.author.date)}
          </span>
        </div>
      </div>

      {/* Right: SHA */}
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

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        to="/$owner/$repo/commit/$sha"
        params={{ owner, repo, sha }}
        className={cn(
          "rounded-md bg-muted px-2 py-0.5",
          "font-mono text-caption tabular-nums text-muted-foreground",
          "outline-none transition-colors",
          "hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
        title={sha}
      >
        {shortSha}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          navigator.clipboard.writeText(sha).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        title={copied ? "Copied!" : "Copy SHA"}
        aria-label="Copy full SHA"
        className={cn(
          "rounded-md p-1 text-muted-foreground outline-none transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <Copy className="size-3" />
      </button>
    </div>
  );
}

function splitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, splitIdx).trim(),
    body: trimmed.slice(splitIdx + 2).trim(),
  };
}
