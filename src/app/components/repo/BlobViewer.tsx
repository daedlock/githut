import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { type ActiveLineRange, CodeView, useCodeTokens } from "@/app/components/code";
import { FileHistoryTrigger } from "@/app/components/code/FileHistoryTrigger";
import { MarkupRenderer } from "@/app/components/MarkupRenderer";
import { BlameView } from "@/app/components/repo/BlameView";
import { FileHistoryPanel } from "@/app/components/repo/FileHistoryPanel";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { RepoFile } from "@/app/hooks/useRepoFile";
import { bucketNumber, fileExtension, track } from "@/app/lib/analytics";
import { cn } from "@/app/lib/cn";
import { detectLang } from "@/app/lib/detectLang";

const BLOB_SKELETON_WIDTHS = [
  "45%",
  "62%",
  "79%",
  "46%",
  "63%",
  "80%",
  "47%",
  "64%",
  "81%",
  "48%",
  "65%",
  "82%",
  "49%",
  "66%",
  "83%",
  "50%",
  "67%",
  "84%",
  "51%",
  "68%",
] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function findFirstMatchingLine(
  content: string,
  query: string | undefined,
): ActiveLineRange | undefined {
  const parts = query?.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts?.length) return undefined;

  const lines = content.split("\n");
  const index = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return parts.every((part) => lower.includes(part));
  });
  return index >= 0 ? { start: index + 1, end: index + 1 } : undefined;
}

export type BlobMode = "source" | "history" | "blame";

export function BlobViewer({
  file,
  owner,
  repo,
  ref,
  mode = "source",
  activeLineRange,
  searchQuery,
  onModeChange,
}: {
  file: RepoFile;
  owner: string;
  repo: string;
  ref?: string;
  mode?: BlobMode;
  activeLineRange?: ActiveLineRange;
  searchQuery?: string;
  onModeChange?: (mode: BlobMode) => void;
}) {
  const lang = detectLang(file.path);
  const lineCount = file.content.split("\n").length;
  const isBinary = file.content.includes("\0");
  const isMarkdown = lang === "markdown" || lang === "mdx";
  const isOrg = lang === "org";
  const isRenderable = isMarkdown || isOrg;

  useEffect(() => {
    track("file_opened", {
      ext: fileExtension(file.path),
      size: bucketNumber(file.size, [1_000, 10_000, 50_000, 250_000, 1_000_000]),
      lines: bucketNumber(lineCount, [50, 200, 500, 1_000, 5_000]),
      binary: isBinary,
      renderable: isRenderable,
    });
  }, [file.path, file.size, lineCount, isBinary, isRenderable]);

  const { data: tokenLines, isPending } = useCodeTokens(isBinary ? "" : file.content, lang);
  const searchLineRange = useMemo(
    () => findFirstMatchingLine(file.content, searchQuery),
    [file.content, searchQuery],
  );
  const highlightedLineRange = activeLineRange ?? searchLineRange;

  const header = (
    <BlobHeader
      file={file}
      mode={mode}
      lineCount={lineCount}
      lang={lang}
      onModeChange={onModeChange}
      historyRef={ref}
    />
  );

  const codeCard = (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      {header}

      {isBinary ? (
        <div className="px-4 py-8 text-center font-mono text-ui text-[var(--color-fg-faint)]">
          Binary file — cannot display
        </div>
      ) : isPending || !tokenLines ? (
        <div className="skeleton-fade p-4 flex flex-col gap-1.5">
          {BLOB_SKELETON_WIDTHS.slice(0, Math.min(lineCount, 20)).map((width) => (
            <Skeleton key={width} className="h-5" style={{ width }} />
          ))}
        </div>
      ) : (
        <CodeView lines={tokenLines} activeLineRange={highlightedLineRange} />
      )}
    </div>
  );

  if (mode === "history") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {header}
        <FileHistoryPanel
          owner={owner}
          repo={repo}
          path={file.path}
          branch={ref}
          showHeader={false}
        />
      </div>
    );
  }

  if (mode === "blame" && !isBinary) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {header}
        <BlameView file={file} owner={owner} repo={repo} ref={ref} showHeader={false} />
      </div>
    );
  }

  if (!isRenderable || isBinary) return codeCard;

  // Markdown / Org: source above, rendered preview below — mirrors the README
  // pattern so users get the same read-at-a-glance UX.
  return (
    <div className="flex flex-col gap-4">
      {codeCard}
      <article className="rounded-lg border border-border bg-background">
        <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="font-mono text-ui font-medium uppercase tracking-widest text-muted-foreground">
            preview
          </span>
          <span className="font-mono text-micro text-[var(--color-fg-faint)]">{file.path}</span>
        </header>
        <div className="readme-prose p-6">
          <MarkupRenderer
            path={file.path}
            assetContext={{ owner, repo, ref, basePath: dirname(file.path) }}
          >
            {file.content}
          </MarkupRenderer>
        </div>
      </article>
    </div>
  );
}

function BlobHeader({
  file,
  mode,
  lineCount,
  lang,
  onModeChange,
  historyRef,
}: {
  file: RepoFile;
  mode: BlobMode;
  lineCount: number;
  lang: string;
  onModeChange?: (mode: BlobMode) => void;
  historyRef?: string;
}) {
  const params = useParams({ strict: false }) as { owner?: string; repo?: string };

  return (
    <div className="flex h-9 items-center justify-between gap-3 border-b border-border bg-muted px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-mono text-caption text-foreground">{file.path}</span>
        <span className="hidden shrink-0 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)] sm:inline">
          {lang}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2 font-mono text-caption text-[var(--color-fg-faint)] sm:flex">
          <span>{lineCount} lines</span>
          <span>{formatBytes(file.size)}</span>
        </div>
        {historyRef && params.owner && params.repo && (
          <FileHistoryTrigger
            path={file.path}
            sha={historyRef}
            branch={historyRef}
          />
        )}
        <div className="flex items-center rounded-lg bg-background p-0.5">
          {(["source", "history", "blame"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                if (mode !== item) track("blob_mode_changed", { mode: item });
                onModeChange?.(item);
              }}
              className={cn(mode === item && "bg-muted text-foreground")}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
