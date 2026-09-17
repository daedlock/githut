import { Archive, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Artifact } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type ArtifactListProps = {
  artifacts: Artifact[];
  runUrl: string;
};

/**
 * GitHub handles authenticated artifact downloads. Expired artifacts remain
 * visible so the run retains its history without offering a broken download.
 */
export function ArtifactList({ artifacts, runUrl }: ArtifactListProps) {
  if (artifacts.length === 0) return null;
  return (
    <div className="flex flex-col">
      {artifacts.map((a) => (
        <ArtifactRow key={a.id} artifact={a} runUrl={runUrl} />
      ))}
    </div>
  );
}

function ArtifactRow({ artifact, runUrl }: { artifact: Artifact; runUrl: string }) {
  const expired = artifact.expired;
  return (
    <div className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5")}>
      <Archive
        className={cn(
          "size-4 shrink-0",
          expired ? "text-(--color-fg-faint)" : "text-(--color-fg-muted)",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-mono text-ui",
            expired ? "text-(--color-fg-faint)" : "text-foreground",
          )}
        >
          {artifact.name}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          <span className="font-mono tabular-nums">{formatBytes(artifact.size_in_bytes)}</span>
          {artifact.created_at ? (
            <>
              <span className="mx-1.5 text-(--color-fg-faint)" aria-hidden>
                ·
              </span>
              <span>created {formatRelativeTime(artifact.created_at)}</span>
            </>
          ) : null}
          {expired ? (
            <>
              <span className="mx-1.5 text-(--color-fg-faint)" aria-hidden>
                ·
              </span>
              <span className="font-mono uppercase tracking-widest text-(--color-fg-faint)">
                expired
              </span>
            </>
          ) : null}
        </p>
      </div>

      {expired ? (
        <span className="text-caption text-muted-foreground">Expired</span>
      ) : (
        <Button asChild variant="outline" size="xs">
          <a
            href={`${runUrl}/artifacts/${artifact.id}`}
            target="_blank"
            rel="noreferrer"
            title="Download artifact on GitHub"
          >
            <Download data-icon="inline-start" aria-hidden />
            Download
          </a>
        </Button>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
