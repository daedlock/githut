import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock, Star } from "lucide-react";
import { repoQueryOptions } from "@/app/hooks/useRepo";
import { repoLanguagesQueryOptions } from "@/app/hooks/useRepoLanguages";
import type { RepoSummary } from "@/shared/types";

function formatStars(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function formatPushed(iso: string): string {
  const pushed = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - pushed);
  const sec = diff / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86_400 * 7) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export type RepoRowProps = {
  repo: RepoSummary;
  showOwner?: boolean;
  onClick?: (repo: RepoSummary) => void;
};

export function RepoRow({ repo, showOwner = false, onClick }: RepoRowProps) {
  const qc = useQueryClient();
  const prefetch = () => {
    qc.prefetchQuery(repoQueryOptions(repo.owner.login, repo.name));
    qc.prefetchQuery(repoLanguagesQueryOptions(repo.owner.login, repo.name));
  };
  return (
    <Link
      to="/$owner/$repo"
      params={{ owner: repo.owner.login, repo: repo.name }}
      onClick={(event) => {
        if (!onClick) return;
        event.preventDefault();
        onClick(repo);
      }}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className="group block rounded-lg outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <div className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-body">
            {showOwner ? <span className="text-muted-foreground">{repo.owner.login}/</span> : null}
            <span className="truncate font-[475] text-foreground group-hover:text-primary">
              {repo.name}
            </span>
            {repo.visibility === "private" ? (
              <Lock
                className="size-3 flex-shrink-0 text-[var(--color-fg-faint)]"
                aria-label="Private"
              />
            ) : null}
          </div>
          {repo.description ? (
            <p className="truncate text-ui text-muted-foreground">{repo.description}</p>
          ) : (
            <p className="truncate text-ui italic text-[var(--color-fg-faint)]">No description</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 pt-0.5 font-mono text-caption text-muted-foreground">
          {repo.language ? (
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--chart-slot-1)]" />
              {repo.language}
            </span>
          ) : null}
          {repo.stars > 0 ? (
            <span className="hidden items-center gap-1 sm:inline-flex tabular-nums">
              <Star className="size-3" />
              {formatStars(repo.stars)}
            </span>
          ) : null}
          <span className="hidden text-[var(--color-fg-faint)] md:inline">
            {formatPushed(repo.pushedAt)}
          </span>
          <ChevronRight className="size-4 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
