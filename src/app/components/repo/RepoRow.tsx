import { useQueryClient } from "@tanstack/react-query";
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
  // RepoRow is a button (not a <Link>), so router's intent-preload doesn't
  // fire. Mirror its behavior manually: warm the same cache entries the
  // target route's loader would.
  const prefetch = () => {
    qc.prefetchQuery(repoQueryOptions(repo.owner.login, repo.name));
    qc.prefetchQuery(repoLanguagesQueryOptions(repo.owner.login, repo.name));
  };
  return (
    <button
      type="button"
      onClick={() => onClick?.(repo)}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className="group flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-[var(--color-bg-sunken)] focus-visible:bg-[var(--color-bg-sunken)]"
    >
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2 font-mono text-body leading-none">
          {showOwner ? <span className="text-muted-foreground">{repo.owner.login}/</span> : null}
          <span className="font-medium text-foreground truncate">{repo.name}</span>
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
          <p className="truncate text-ui text-[var(--color-fg-faint)] italic">No description</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 font-mono text-caption text-muted-foreground">
        {repo.language ? <span className="hidden sm:inline">{repo.language}</span> : null}
        {repo.stars > 0 ? (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Star className="size-3" />
            {formatStars(repo.stars)}
          </span>
        ) : null}
        <span className="hidden md:inline text-[var(--color-fg-faint)]">
          {formatPushed(repo.pushedAt)}
        </span>
        <ChevronRight className="size-4 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
    </button>
  );
}
