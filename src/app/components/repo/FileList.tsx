import { FileText, Folder } from "lucide-react";
import { Skeleton } from "@/app/components/ui/Skeleton";
import type { ContentEntry } from "@/app/hooks/useRepoContents";
import { cn } from "@/app/lib/cn";

export function FileList({
  entries,
  isPending,
  onNavigate,
}: {
  entries: ContentEntry[] | undefined;
  isPending: boolean;
  onNavigate?: (entry: ContentEntry) => void;
}) {
  const sorted = entries
    ? [...entries].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "dir" ? -1 : 1;
      })
    : [];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {isPending
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            : sorted.map((entry) => (
                <FileRow key={entry.sha} entry={entry} onNavigate={onNavigate} />
              ))}
        </tbody>
      </table>
    </div>
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
        "group border-b border-[var(--color-border)] last:border-0",
        "hover:bg-[var(--color-bg-subtle)] transition-colors duration-75",
        onNavigate && "cursor-pointer",
      )}
      onClick={() => onNavigate?.(entry)}
    >
      <td className="pl-4 pr-2 py-2 w-5">
        {isDir ? (
          <Folder className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-[var(--color-fg-faint)] flex-shrink-0" />
        )}
      </td>
      <td className="pr-4 py-2">
        <span
          className={cn(
            "font-mono text-[13px] leading-none",
            isDir
              ? "text-[var(--color-fg)] group-hover:text-[var(--color-accent)]"
              : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]",
            "transition-colors duration-75",
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
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="pl-4 pr-2 py-2 w-5">
        <Skeleton className="h-4 w-4" />
      </td>
      <td className="pr-4 py-2">
        <Skeleton className="h-3.5 w-32" />
      </td>
    </tr>
  );
}
