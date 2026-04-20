import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";
import { cn } from "@/app/lib/cn";

/**
 * @deprecated New surfaces should render `<TopBar />` directly. This legacy
 * header stays for the `subtitle`/`right` composition used by `/login` and
 * `/settings`; new routes skip the slot shape and let `TopBar` compose itself.
 */
export type ShellHeaderProps = {
  /** Context slot — typically the owner/repo breadcrumb. Sits right of the wordmark. */
  subtitle?: ReactNode;
  /** Right-aligned chrome — theme toggle, user menu. */
  right?: ReactNode;
  /** Draw a hairline below the header. Turn OFF when a tab row follows (it closes the assembly instead). */
  bordered?: boolean;
  className?: string;
};

export function ShellHeader({ subtitle, right, bordered = false, className }: ShellHeaderProps) {
  return (
    <header className={cn(bordered && "border-b border-[var(--color-border)]", className)}>
      <Container className="flex items-center gap-4 py-3">
        {/*
         * Wordmark as terminal prompt — "GitHut_" with accent cursor.
         * Matches the login/coming-soon screens so the identity carries across
         * every view. Clickable home link (replaces the separate back-arrow
         * that used to sit in the subtitle, which read ambiguously).
         */}
        <Link
          to="/"
          className="group inline-flex items-baseline gap-0 font-mono text-body font-medium tracking-tight text-[var(--color-fg)] select-none"
          aria-label="Home"
        >
          GitHut
          <span
            aria-hidden
            className="text-[var(--color-accent)] transition-opacity duration-150 group-hover:opacity-60"
          >
            _
          </span>
        </Link>

        {subtitle ? (
          <div className="flex min-w-0 items-baseline text-ui text-[var(--color-fg-muted)]">
            {subtitle}
          </div>
        ) : null}

        {right ? <div className="ml-auto flex items-center gap-1">{right}</div> : null}
      </Container>
    </header>
  );
}
