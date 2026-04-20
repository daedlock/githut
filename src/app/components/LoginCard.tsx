import { Button } from "@/app/components/ui/Button";
import { Kbd } from "@/app/components/ui/Kbd";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export type LoginCardProps = {
  errorMessage?: string;
  onLogin: () => void;
};

export function LoginCard({ errorMessage, onLogin }: LoginCardProps) {
  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 font-mono text-ui uppercase tracking-widest text-[var(--color-fg-faint)]">
          <span className="h-px w-6 bg-[var(--color-border-strong)]" />
          <span>v0.1 — dev</span>
        </div>
        <h1 className="font-mono text-display font-medium">
          Sign&nbsp;in
          <span className="text-[var(--color-accent)]">_</span>
        </h1>
        <p className="text-body text-[var(--color-fg-muted)]">
          A faster read-path for GitHub. Built for engineers who live in issues, PRs, and diffs.
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 font-mono text-ui text-[var(--color-danger)]"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onLogin}>
          <GitHubMark className="h-4 w-4" />
          Continue with GitHub
        </Button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-ui text-[var(--color-fg-faint)]">
          <span>No password.</span>
          <span>No server-held tokens.</span>
        </p>
      </div>

      <div className="mt-16 flex items-center gap-3 border-t border-[var(--color-border)] pt-5 text-caption text-[var(--color-fg-faint)]">
        <span className="font-mono uppercase tracking-widest">Shortcuts</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Kbd>?</Kbd>
          <span>help</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
          <span>command</span>
        </div>
      </div>
    </div>
  );
}
