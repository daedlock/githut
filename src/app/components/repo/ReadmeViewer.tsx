import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import type { ReadmePayload } from "@/app/hooks/useRepoReadme";

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function ReadmeViewer({
  readme,
  owner,
  repo,
  ref,
}: {
  readme: ReadmePayload;
  owner: string;
  repo: string;
  ref?: string;
}) {
  return (
    <article className="rounded-md border border-border bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="font-mono text-ui font-medium uppercase tracking-widest text-muted-foreground">
          readme
        </span>
        <span className="font-mono text-micro text-[var(--color-fg-faint)]">{readme.path}</span>
      </header>
      <div className="readme-prose p-6">
        <GithubMarkdown
          assetContext={{ owner, repo, ref, basePath: dirname(readme.path) }}
        >
          {readme.markdown}
        </GithubMarkdown>
      </div>
    </article>
  );
}
