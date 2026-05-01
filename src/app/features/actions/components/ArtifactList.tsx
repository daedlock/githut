import { Archive, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Artifact } from "@/app/features/actions/schemas";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export type ArtifactListProps = {
  artifacts: Artifact[];
};

/**
 * Compact artifact chips. Download buttons are placeholders — actual bytes
 * come through the Worker proxy in P4. Expired artifacts fade out (they
 * can't be downloaded anyway) but stay visible so the user sees the full
 * history of what the run produced.
 */
export function ArtifactList({ artifacts }: ArtifactListProps) {
  if (artifacts.length === 0) return null;
  return (
    <div className="flex flex-col">
      {artifacts.map((a) => (
        <ArtifactRow key={a.id} artifact={a} />
      ))}
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: Artifact }) {
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

      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={expired}
        title={expired ? "Artifact expired" : "Download (wired to Worker proxy in P4)"}
      >
        <Download data-icon="inline-start" aria-hidden />
        Download
      </Button>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
