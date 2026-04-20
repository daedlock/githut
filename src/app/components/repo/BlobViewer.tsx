import { CodeView } from "@/app/components/code";
import { useCodeTokens } from "@/app/components/code";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { OrgRendered } from "@/app/components/OrgRendered";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { RepoFile } from "@/app/hooks/useRepoFile";
import { detectLang } from "@/app/lib/detectLang";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function BlobViewer({ file }: { file: RepoFile }) {
  const lang = detectLang(file.path);
  const lineCount = file.content.split("\n").length;
  const isBinary = file.content.includes("\0");
  const isMarkdown = lang === "markdown" || lang === "mdx";
  const isOrg = lang === "org";
  const isRenderable = isMarkdown || isOrg;

  const { data: tokenLines, isPending } = useCodeTokens(
    isBinary ? "" : file.content,
    lang,
  );

  const codeCard = (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <span className="font-mono text-caption uppercase tracking-widest text-[var(--color-fg-faint)]">
          {lang}
        </span>
        <div className="flex items-center gap-3 text-[var(--color-fg-faint)] font-mono text-caption">
          <span>{lineCount} lines</span>
          <span>{formatBytes(file.size)}</span>
        </div>
      </div>

      {isBinary ? (
        <div className="px-4 py-8 text-center font-mono text-ui text-[var(--color-fg-faint)]">
          Binary file — cannot display
        </div>
      ) : isPending || !tokenLines ? (
        <div className="skeleton-fade p-4 flex flex-col gap-1.5">
          {Array.from({ length: Math.min(lineCount, 20) }).map((_, i) => (
            <Skeleton key={i} className="h-5" style={{ width: `${45 + (i * 17) % 50}%` }} />
          ))}
        </div>
      ) : (
        <CodeView lines={tokenLines} />
      )}
    </div>
  );

  // Plain (non-renderable) files: code card only.
  if (!isRenderable || isBinary) return codeCard;

  // Markdown / Org: show source above, rendered preview below — mirrors the
  // README pattern on the repo code page so users get the same read-at-a-glance UX.
  return (
    <div className="flex flex-col gap-4">
      {codeCard}
      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          <span className="font-mono text-ui font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
            preview
          </span>
          <span className="font-mono text-micro text-[var(--color-fg-faint)]">{file.path}</span>
        </header>
        <div className="readme-prose p-6">
          {isOrg ? (
            <OrgRendered>{file.content}</OrgRendered>
          ) : (
            <GithubMarkdown>{file.content}</GithubMarkdown>
          )}
        </div>
      </article>
    </div>
  );
}
