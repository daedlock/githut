import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle } from "lucide-react";
import { useMemo, useRef } from "react";
import { useCodeTokens } from "@/app/components/code";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "@/app/components/code/types";
import { Skeleton } from "@/app/components/ui/skeleton";
import { type BlameRange, useRepoBlame } from "@/app/hooks/useRepoBlame";
import type { RepoFile } from "@/app/hooks/useRepoFile";
import { cn } from "@/app/lib/cn";
import { detectLang } from "@/app/lib/detectLang";
import { formatRelativeTime } from "@/app/lib/time";

const LINE_H = 22;
const MAX_H = "75vh";

export function BlameView({
  file,
  owner,
  repo,
  ref,
  showHeader = true,
}: {
  file: RepoFile;
  owner: string;
  repo: string;
  ref?: string;
  showHeader?: boolean;
}) {
  const lang = detectLang(file.path);
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const tokensQuery = useCodeTokens(file.content, lang);
  const blameQuery = useRepoBlame(owner, repo, file.path, ref, lines.length);

  const rangesByLine = useMemo(() => {
    const out: Array<BlameRange | undefined> = Array.from({ length: lines.length });
    for (const range of blameQuery.data?.ranges ?? []) {
      for (let line = range.startingLine; line <= range.endingLine; line++) {
        out[line - 1] = range;
      }
    }
    return out;
  }, [blameQuery.data, lines.length]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_H,
    overscan: 16,
  });

  if (blameQuery.isPending || tokensQuery.isPending) {
    return <BlameSkeleton />;
  }

  if (blameQuery.isError || !tokensQuery.data) {
    return (
      <div className="rounded-lg bg-muted px-5 py-10 text-center">
        <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
        <p className="text-body text-muted-foreground">Could not load blame for this file.</p>
      </div>
    );
  }

  const height = Math.min(lines.length * LINE_H, window.innerHeight * 0.75);

  return (
    <div className="overflow-hidden bg-[var(--color-code-bg)]">
      {showHeader && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-border bg-muted px-3">
          <div className="min-w-0">
            <h2 className="text-caption font-medium text-foreground">Blame</h2>
            <p className="truncate font-mono text-caption text-muted-foreground">{file.path}</p>
          </div>
          <span className="font-mono text-caption tabular-nums text-muted-foreground">
            {blameQuery.data?.ranges.length ?? 0} ranges
            {blameQuery.data?.isPartial ? " · partial" : ""}
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-auto text-code font-feature-settings-code"
        style={{ height, maxHeight: MAX_H, fontFamily: "var(--font-code)" }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const lineNo = item.index + 1;
            const range = rangesByLine[item.index];
            const isRangeStart = range?.startingLine === lineNo;
            const tokenLine = tokensQuery.data[item.index];

            return (
              <div
                key={item.key}
                style={{ position: "absolute", top: item.start, left: 0, right: 0, height: LINE_H }}
                className="flex items-center select-text"
              >
                <BlameCell owner={owner} repo={repo} range={range} showDetails={isRangeStart} />
                <span className="w-12 flex-shrink-0 select-none pr-4 text-right text-[var(--color-fg-faint)] opacity-50">
                  {lineNo}
                </span>
                <span className="overflow-hidden whitespace-pre">
                  {renderTokens(tokenLine?.tokens ?? [])}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlameCell({
  owner,
  repo,
  range,
  showDetails,
}: {
  owner: string;
  repo: string;
  range: BlameRange | undefined;
  showDetails: boolean;
}) {
  if (!range) return <span className="w-56 shrink-0" />;

  const login = range.commit.author.user?.login;
  const name = login ?? range.commit.author.name ?? "Unknown";

  return (
    <span
      className={cn(
        "flex h-full w-56 shrink-0 items-center gap-2 border-r border-border px-3 text-caption text-muted-foreground",
        !showDetails && "text-transparent",
      )}
      title={`${name} • ${range.commit.messageHeadline}`}
    >
      {showDetails && (
        <>
          {range.commit.author.user?.avatarUrl && (
            <img src={range.commit.author.user.avatarUrl} alt="" className="size-4 rounded-full" />
          )}
          <span className="min-w-0 flex-1 truncate font-sans">{name}</span>
          <Link
            to="/$owner/$repo/commit/$sha"
            params={{ owner, repo, sha: range.commit.oid }}
            className="font-mono text-micro text-muted-foreground transition-colors hover:text-foreground"
          >
            {range.commit.abbreviatedOid}
          </Link>
          <span className="font-sans text-micro text-[var(--color-fg-faint)]">
            {formatRelativeTime(range.commit.committedDate)}
          </span>
        </>
      )}
    </span>
  );
}

function BlameSkeleton() {
  return (
    <div className="skeleton-fade rounded-lg border border-border bg-muted p-4">
      <div className="flex flex-col gap-2">
        {BLAME_SKELETON_WIDTHS.map((width) => (
          <div key={width} className="flex items-center gap-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: width }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function renderTokens(tokens: Array<{ content: string; color?: string; fontStyle?: number }>) {
  let offset = 0;
  return tokens.map((token) => {
    const key = `${offset}-${token.content}`;
    offset += token.content.length;
    return (
      <span key={key} style={{ color: token.color, ...fontStyleToCSS(token.fontStyle) }}>
        {token.content}
      </span>
    );
  });
}

function fontStyleToCSS(fs: number | undefined): React.CSSProperties {
  if (!fs || fs <= 0) return {};
  return {
    fontStyle: fs & FS_ITALIC ? "italic" : undefined,
    fontWeight: fs & FS_BOLD ? "bold" : undefined,
    textDecoration:
      [fs & FS_UNDERLINE ? "underline" : "", fs & FS_STRIKETHROUGH ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

const BLAME_SKELETON_WIDTHS = [
  "45%",
  "62%",
  "79%",
  "51%",
  "68%",
  "85%",
  "57%",
  "74%",
  "46%",
  "63%",
  "80%",
  "52%",
  "69%",
  "86%",
] as const;
