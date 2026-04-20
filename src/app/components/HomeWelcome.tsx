export type HomeWelcomeProps = {
  name: string;
  login: string;
};

export function HomeWelcome({ name, login }: HomeWelcomeProps) {
  return (
    <div className="space-y-4">
      <h1 className="font-mono text-display font-medium">
        Welcome, <span className="text-[var(--color-accent)]">{name || login}</span>
      </h1>
      <p className="max-w-md text-body text-[var(--color-fg-muted)]">
        Authenticated via GitHub. Token lives in your browser only — the Worker never sees it after
        callback.
      </p>
    </div>
  );
}
