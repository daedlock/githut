import { AlertCircle, FileDiff } from "lucide-react";
import { useMemo } from "react";
import {
  DiffLayout,
  type DiffLayoutFile,
  type FileStatus,
} from "@/app/components/code";
import { Skeleton } from "@/app/components/ui/skeleton";
import { usePrFiles } from "@/app/features/pulls/hooks";
import type { PrFile } from "@/app/features/pulls/schemas";
import { detectLang } from "@/app/lib/detectLang";

// ─── PrFilesPage ───────────────────────────────────────────────────────────
//
// Read-only diff view for the PR's changed files. Reuses the repo's
// existing `DiffLayout` (sidebar file tree + stacked FileDiff cards, j/k
// navigation, unified/split mode toggle) so the PR diff feels identical
// to a commit diff. P5 will layer inline review comments on top.
//
// Pagination: GitHub's `/files` endpoint returns up to 3000 files across
// 30 pages. Until "load more files" ships in P10 we fetch the first 100
// and surface a count affordance if the PR is bigger. In practice >100
// files is rare enough that this is acceptable for v1.

export type PrFilesPageProps = {
  owner: string;
  repo: string;
  number: number;
};

export function PrFilesPage({ owner, repo, number }: PrFilesPageProps) {
  const filesQuery = usePrFiles(owner, repo, number);

  const diffFiles = useMemo<DiffLayoutFile[]>(() => {
    const files = filesQuery.data;
    if (!files) return [];
    return files.map(toDiffLayoutFile);
  }, [filesQuery.data]);

  if (filesQuery.isPending) return <PrFilesSkeleton />;
  if (filesQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertCircle className="size-5 text-destructive" />
        <p className="text-body text-muted-foreground">
          Could not load the diff for this pull request.
        </p>
      </div>
    );
  }
  if (diffFiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <FileDiff className="size-5 text-[var(--color-fg-faint)]" />
        <p className="text-body text-muted-foreground">No file changes.</p>
      </div>
    );
  }

  // DiffLayout owns its own chrome (sticky top bar, sidebar) — we render
  // it directly at full width. Escaping the Container on this tab is
  // intentional; it matches the commit diff page.
  return (
    <div className="-mx-4 sm:-mx-6">
      <DiffLayout
        files={diffFiles}
        initialSidebarOpen={diffFiles.length > 1}
      />
    </div>
  );
}

function toDiffLayoutFile(f: PrFile): DiffLayoutFile {
  return {
    filename: f.filename,
    previousFilename: f.previous_filename,
    status: normalizeStatus(f.status),
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
    lang: detectLang(f.filename),
  };
}

function normalizeStatus(status: PrFile["status"]): FileStatus {
  switch (status) {
    case "added":
    case "removed":
    case "modified":
    case "renamed":
    case "copied":
      return status;
    // "changed" and "unchanged" aren't first-class in DiffLayout; map to
    // "modified" since they still render as diff rows.
    default:
      return "modified";
  }
}

function PrFilesSkeleton() {
  return (
    <div className="skeleton-fade flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {[80, 64, 72, 50].map((w) => (
        <div key={w} className="rounded-md border border-border p-3">
          <Skeleton className="h-4 mb-2" style={{ width: `${w}%` }} />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6 mt-1" />
        </div>
      ))}
    </div>
  );
}
