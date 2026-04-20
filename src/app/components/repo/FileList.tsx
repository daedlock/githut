import { ChevronRight, FileText, Folder, GitCommitHorizontal } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { ContentEntry } from "@/app/hooks/useRepoContents";
import type { PathCommit } from "@/app/hooks/usePathCommit";
import { cn } from "@/app/lib/cn";

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
      <span className="ml-1 text-[var(--color-fg-faint)] text-ui flex-shrink-0">
        @ {branch}
      </span>
    </nav>
  );
}

export function FileList({
  entries,
  isPending,
  path,
  commit,
  commitPending,
  onNavigate,
}: {
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
    <div className="rounded-md border border-border overflow-hidden">
      {/* commit strip */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
        <GitCommitHorizontal className="size-3.5 text-[var(--color-fg-faint)] flex-shrink-0" />
        {commitPending || commit === undefined ? (
          <Skeleton className="h-3.5 w-64" />
        ) : commit ? (
          <>
            <span className="text-ui text-foreground truncate min-w-0">{commit.message}</span>
            <span className="ml-auto text-caption font-mono text-[var(--color-fg-faint)] flex-shrink-0 flex items-center gap-2">
              <span>{commit.authorName}</span>
              <span title={commit.date}>{relativeTime(commit.date)}</span>
            </span>
          </>
        ) : (
          <span className="text-ui text-[var(--color-fg-faint)]">No commits found</span>
        )}
      </div>

      <table className="w-full text-body border-collapse">
        <tbody className={isPending ? "skeleton-fade" : undefined}>
          {isPending ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : (
            <>
              {showParent && (
                <ParentRow onNavigate={() => onNavigate?.({ type: "dir", name: "..", path: path.split("/").slice(0, -1).join("/"), sha: "", size: 0, html_url: null, download_url: null })} />
              )}
              {sorted.map((entry) => (
                <FileRow key={entry.sha || entry.path} entry={entry} onNavigate={onNavigate} />
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
      className="group border-b border-border hover:bg-muted transition-colors duration-75 cursor-pointer"
      onClick={onNavigate}
    >
      <td className="pl-4 pr-2 py-2 w-5">
        <Folder className="size-4 text-[var(--color-fg-faint)] flex-shrink-0" />
      </td>
      <td className="pr-4 py-2">
        <span className="font-mono text-code text-muted-foreground group-hover:text-foreground transition-colors duration-75">
          ..
        </span>
      </td>
    </tr>
  );
}

function FileRow({
  entry,
  onNavigate,
}: {
  entry: ContentEntry;
  onNavigate?: (entry: ContentEntry) => void;
}) {
  const isDir = entry.type === "dir";

  return (
    <tr
      className={cn(
        "group border-b border-border last:border-0",
        "hover:bg-muted transition-colors duration-75",
        onNavigate && "cursor-pointer",
      )}
      onClick={() => onNavigate?.(entry)}
    >
      <td className="pl-4 pr-2 py-2 w-5">
        {isDir ? (
          <Folder className="size-4 text-primary flex-shrink-0" />
        ) : (
          <FileText className="size-4 text-[var(--color-fg-faint)] flex-shrink-0" />
        )}
      </td>
      <td className="pr-4 py-2 w-full">
        <span
          className={cn(
            "font-mono text-code leading-none transition-colors duration-75",
            isDir
              ? "text-foreground group-hover:text-primary"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {entry.name}
        </span>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="pl-4 pr-2 py-2 w-5">
        <Skeleton className="size-4" />
      </td>
      <td className="pr-4 py-2">
        <Skeleton className="h-3.5 w-32" />
      </td>
    </tr>
  );
}
