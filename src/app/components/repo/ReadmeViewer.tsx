import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReadmePayload } from "@/app/hooks/useRepoReadme";

export function ReadmeViewer({ readme }: { readme: ReadmePayload }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
          readme
        </span>
        <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">{readme.path}</span>
      </header>
      <div className="readme-prose p-6">
        <Markdown remarkPlugins={[remarkGfm]}>{readme.markdown}</Markdown>
      </div>
    </article>
  );
}
