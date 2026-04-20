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
    <div className="border-b border-border">
      <Container as="nav" className="flex items-end gap-0" aria-label="Repository sections">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic route path is runtime-constructed
            to={tab.to as any}
            className={cn(
              // Sans UI font for navigation — mono reserved for eyebrows, code, identifiers.
              // Fixed weight across active/inactive so there's no metric reflow on tab change.
              "group relative flex items-center gap-1.5 px-3 py-2 text-ui",
              "text-muted-foreground transition-colors hover:text-foreground",
              "focus-visible:text-foreground focus-visible:outline-none",
            )}
            activeProps={{
              className:
                "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-primary",
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
