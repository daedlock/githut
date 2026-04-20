import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Container } from "@/app/components/ui/Container";
import { cn } from "@/app/lib/cn";

export type RepoTabDef = {
  to: string;
  label: string;
  meta?: ReactNode;
};

export type RepoTabsProps = {
  owner: string;
  repo: string;
  tabs: RepoTabDef[];
};

export function RepoTabs({ tabs }: RepoTabsProps) {
  return (
    <div className="border-b border-[var(--color-border)]">
      <Container as="nav" className="flex items-end gap-0" aria-label="Repository sections">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic route path is runtime-constructed
            to={tab.to as any}
            className={cn(
              // Sans UI font for navigation — mono is reserved for eyebrows,
              // code, and technical metadata. Navigation text should read as
              // body/UI, same family as the rest of the app's readable copy.
              // Weight is fixed (no 400→500 shift on active) so there's zero
              // metric reflow when sliding between tabs; color + underline
              // already signal active state clearly.
              "group relative flex items-center gap-1.5 px-3 py-2 text-ui",
              "text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]",
            )}
            activeProps={{
              className:
                "text-[var(--color-fg)] after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-[var(--color-accent)]",
            }}
          >
            <span>{tab.label}</span>
            {tab.meta ? (
              <span className="text-micro text-[var(--color-fg-faint)]">{tab.meta}</span>
            ) : null}
          </Link>
        ))}
      </Container>
    </div>
  );
}
