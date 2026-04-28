import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText, Folder, GitCommitHorizontal } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { type PathCommit, usePathCommit } from "@/app/hooks/usePathCommit";
import type { ContentEntry } from "@/app/hooks/useRepoContents";
import { cn } from "@/app/lib/cn";

const FILE_LIST_SKELETON_KEYS = [
  "row-1",
  "row-2",
  "row-3",
  "row-4",
  "row-5",
  "row-6",
  "row-7",
  "row-8",
] as const;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function Breadcrumb({
  repo,
  path,
  branch,
  onNavigate,
}: {
  repo: string;
  path: string;
  branch: string;
  onNavigate: (path: string) => void;
}) {
  const parts = path ? path.split("/") : [];

  return (
    <nav className="flex items-center gap-1 font-mono text-body min-w-0">
      <button
        type="button"
        onClick={() => onNavigate("")}
        className="text-primary hover:underline truncate outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
      >
        {repo}
      </button>
      {parts.map((part, i) => {
        const segPath = parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        return (
          <span key={segPath} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="size-3.5 text-[var(--color-fg-faint)] flex-shrink-0" />
            {isLast ? (
              <span className="text-foreground truncate">{part}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(segPath)}
                className="text-primary hover:underline truncate outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-foreground/15"
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
      <span className="ml-1 text-[var(--color-fg-faint)] text-ui flex-shrink-0">@ {branch}</span>
    </nav>
  );
}

export function FileList({
  owner,
  repo,
  refName,
  entries,
  isPending,
  path,
  commit,
  commitPending,
  onNavigate,
}: {
  owner: string;
  repo: string;
  refName?: string;
  entries: ContentEntry[] | undefined;
  isPending: boolean;
  path: string;
  commit: PathCommit | null | undefined;
  commitPending: boolean;
  onNavigate?: (entry: ContentEntry) => void;
}) {
  const sorted = entries
    ? [...entries].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "dir" ? -1 : 1;
      })
    : [];

  const showParent = !!path;

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* commit strip */}
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2">
        <GitCommitHorizontal className="size-3.5 text-[var(--color-fg-faint)] flex-shrink-0" />
        {commitPending || commit === undefined ? (
          <span className="flex h-[1lh] items-center text-ui">
            <Skeleton className="h-3.5 w-64" />
          </span>
        ) : commit ? (
          <>
            <Link
              to="/$owner/$repo/commit/$sha"
              params={{ owner, repo, sha: commit.sha }}
              title={commit.message}
              className="flex-1 min-w-0 truncate rounded-sm text-ui text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-1 focus-visible:ring-foreground/15"
            >
              {commit.message}
            </Link>
            <span className="ml-auto text-caption font-mono text-[var(--color-fg-faint)] flex-shrink-0 flex items-center gap-2">
              <span>{commit.authorName}</span>
              <span title={commit.date}>{relativeTime(commit.date)}</span>
            </span>
          </>
        ) : (
          <span className="text-ui text-[var(--color-fg-faint)]">No commits found</span>
        )}
      </div>

      <table className="w-full table-fixed border-collapse text-body">
        <tbody className={isPending ? "skeleton-fade" : undefined}>
          {isPending ? (
            FILE_LIST_SKELETON_KEYS.map((key) => <SkeletonRow key={key} />)
          ) : (
            <>
              {showParent && (
                <ParentRow
                  onNavigate={() =>
                    onNavigate?.({
                      type: "dir",
                      name: "..",
                      path: path.split("/").slice(0, -1).join("/"),
                      sha: "",
                      size: 0,
                      html_url: null,
                      download_url: null,
                    })
                  }
                />
              )}
              {sorted.map((entry) => (
                <FileRow
                  key={entry.sha || entry.path}
                  owner={owner}
                  repo={repo}
                  refName={refName}
                  entry={entry}
                  onNavigate={onNavigate}
                />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ParentRow({ onNavigate }: { onNavigate: () => void }) {
  return (
    <tr
      className="group cursor-pointer border-b border-border transition-colors duration-75 hover:bg-muted"
      onClick={onNavigate}
    >
      <td className="min-w-0 py-2 pl-4 pr-4">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="size-4 text-[var(--color-fg-faint)] flex-shrink-0" />
          <span className="font-mono text-code text-muted-foreground group-hover:text-foreground transition-colors duration-75 truncate">
            ..
          </span>
        </div>
      </td>
      <td className="hidden px-4 py-2 md:table-cell md:w-[52%]" />
      <td className="w-[8.5rem] py-2 pr-4" />
    </tr>
  );
}

function FileRow({
  owner,
  repo,
  refName,
  entry,
  onNavigate,
}: {
  owner: string;
  repo: string;
  refName?: string;
  entry: ContentEntry;
  onNavigate?: (entry: ContentEntry) => void;
}) {
  const isDir = entry.type === "dir";
  const { data: entryCommit, isPending: entryCommitPending } = usePathCommit(
    owner,
    repo,
    entry.path,
    refName,
  );

  return (
    <tr
      className={cn(
        "group border-b border-border transition-colors duration-75 last:border-0 hover:bg-muted",
        onNavigate && "cursor-pointer",
      )}
      onClick={() => onNavigate?.(entry)}
    >
      <td className="min-w-0 py-2 pl-4 pr-4">
        <div className="flex items-center gap-2 min-w-0">
          {isDir ? (
            <Folder className="size-4 text-primary flex-shrink-0" />
          ) : (
            <FileText className="size-4 text-[var(--color-fg-faint)] flex-shrink-0" />
          )}
          <span
            className={cn(
              "font-mono text-code transition-colors duration-75 truncate",
              isDir ? "text-foreground group-hover:text-primary" : "text-foreground",
            )}
            title={entry.name}
          >
            {entry.name}
          </span>
        </div>
      </td>
      <td className="hidden px-4 py-2 md:table-cell md:w-[52%]">
        {entryCommitPending ? (
          <span className="flex h-[1lh] items-center text-body">
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </span>
        ) : entryCommit?.message ? (
          <Link
            to="/$owner/$repo/commit/$sha"
            params={{ owner, repo, sha: entryCommit.sha }}
            title={entryCommit.message}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "block truncate rounded-sm text-body underline-offset-2 outline-none",
              "text-muted-foreground hover:text-foreground hover:underline",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              "transition-colors duration-75",
            )}
          >
            {entryCommit.message}
          </Link>
        ) : (
          <span className="block truncate text-body text-[var(--color-fg-faint)]">—</span>
        )}
      </td>
      <td className="w-[8.5rem] py-2 pr-4 text-right">
        {entryCommitPending ? (
          <span className="ml-auto flex h-[1lh] items-center justify-end text-caption">
            <Skeleton className="h-3.5 w-16" />
          </span>
        ) : (
          <span className="font-mono text-caption text-muted-foreground whitespace-nowrap">
            {entryCommit ? relativeTime(entryCommit.date) : ""}
          </span>
        )}
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pl-4 pr-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <span className="flex h-[1lh] items-center text-code">
            <Skeleton className="h-3.5 w-32" />
          </span>
        </div>
      </td>
      <td className="hidden px-4 py-2 md:table-cell md:w-[52%]">
        <span className="flex h-[1lh] items-center text-body">
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </span>
      </td>
      <td className="w-[8.5rem] py-2 pr-4">
        <span className="ml-auto flex h-[1lh] items-center justify-end text-caption">
          <Skeleton className="h-3.5 w-16" />
        </span>
      </td>
    </tr>
  );
}
