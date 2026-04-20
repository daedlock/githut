import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
    <nav
      aria-label="Repository sections"
      className="flex items-end gap-0 border-b border-[var(--color-border)] px-6"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          // biome-ignore lint/suspicious/noExplicitAny: dynamic route path is runtime-constructed
          to={tab.to as any}
          className={cn(
            "group relative flex items-center gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-widest",
            "text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]",
          )}
          activeProps={{
            className:
              "text-[var(--color-fg)] after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-[var(--color-accent)]",
          }}
        >
          <span>{tab.label}</span>
          {tab.meta ? (
            <span className="font-sans text-[10px] text-[var(--color-fg-faint)] normal-case tracking-normal">
              {tab.meta}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
