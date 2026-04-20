import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import type { ReadmePayload } from "@/app/hooks/useRepoReadme";

export function ReadmeViewer({ readme }: { readme: ReadmePayload }) {
  return (
    <article className="rounded-md border border-border bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="font-mono text-ui font-medium uppercase tracking-widest text-muted-foreground">
          readme
        </span>
        <span className="font-mono text-micro text-[var(--color-fg-faint)]">{readme.path}</span>
      </header>
      <div className="readme-prose p-6">
        <GithubMarkdown>{readme.markdown}</GithubMarkdown>
      </div>
    </article>
  );
}
