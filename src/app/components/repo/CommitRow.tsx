import { Link } from "@tanstack/react-router";
import { GitCommit } from "lucide-react";
import { useState } from "react";
import { ShaChip } from "@/app/components/ui/ShaChip";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type { CommitSummary } from "@/app/hooks/useRepoCommits";
import { formatRelativeTime } from "@/app/lib/time";

export type CommitRowProps = {
  commit: CommitSummary;
  owner: string;
  repo: string;
  graphSlot?: React.ReactNode;
};

export function CommitRow({ commit, owner, repo, graphSlot }: CommitRowProps) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const { title, body } = splitMessage(commit.commit.message);

  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted rounded-lg">
      {graphSlot}
      {/* Left: title + meta */}
      <div className="min-w-0 flex-1">
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner, repo, sha: commit.sha }}
          className="block outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
        >
          <p className="text-body font-[475] text-foreground leading-snug">
            {title}
            {body && !bodyOpen && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBodyOpen(true);
                }}
                className="ml-1.5 inline-flex rounded-md bg-muted px-1.5 py-px text-micro text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={false}
              >
                ···
              </button>
            )}
          </p>
        </Link>

        {body && bodyOpen && (
          <>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-caption leading-relaxed text-muted-foreground">
              {body}
            </pre>
            <button
              type="button"
              onClick={() => setBodyOpen(false)}
              className="mt-1 rounded-md bg-muted px-1.5 py-px text-micro text-muted-foreground transition-colors hover:text-foreground"
            >
              collapse
            </button>
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
              className="size-5 shrink-0 rounded-full"
            />
          ) : (
            <GitCommit className="size-3 shrink-0 text-[var(--color-fg-faint)]" />
          )}
          {authorLogin ? (
            <ProfileLink login={authorLogin} className="truncate font-[475]">
              {displayAuthor}
            </ProfileLink>
          ) : (
            <span className="truncate font-[475]">{displayAuthor}</span>
          )}
          <span className="text-[var(--color-fg-faint)]">
            {formatRelativeTime(commit.commit.author.date)}
          </span>
        </div>
      </div>

      {/* Right: SHA */}
      <ShaChip sha={commit.sha} link={{ owner, repo }} />
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
