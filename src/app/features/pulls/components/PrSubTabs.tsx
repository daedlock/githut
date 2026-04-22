import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, FileDiff, GitCommit, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";

// ─── PrSubTabs ─────────────────────────────────────────────────────────────
//
// Tabs inside the PR detail shell: Conversation · Files · Commits · Checks.
// Visual language matches `RepoSubTabs` (underline on active, muted text
// when inactive) so the PR page reads as a nested section rather than a
// new chrome pattern. Counts live next to the tab label — tabular-nums
// keeps them from shifting as values change.

type Tab = {
  to: "/$owner/$repo/pulls/$number"
    | "/$owner/$repo/pulls/$number/files"
    | "/$owner/$repo/pulls/$number/commits"
    | "/$owner/$repo/pulls/$number/checks";
  label: string;
  icon: LucideIcon;
  count?: number;
  /** Path suffix used for active matching (e.g. "", "/files", "/commits"). */
  suffix: string;
};

export type PrSubTabsProps = {
  owner: string;
  repo: string;
  number: number;
  counts: {
    conversation?: number;
    files?: number;
    commits?: number;
  };
};

export function PrSubTabs({ owner, repo, number, counts }: PrSubTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${owner}/${repo}/pulls/${number}`;

  const tabs: Tab[] = [
    {
      to: "/$owner/$repo/pulls/$number",
      suffix: "",
      label: "Conversation",
      icon: MessageSquare,
      count: counts.conversation,
    },
    {
      to: "/$owner/$repo/pulls/$number/files",
      suffix: "/files",
      label: "Files changed",
      icon: FileDiff,
      count: counts.files,
    },
    {
      to: "/$owner/$repo/pulls/$number/commits",
      suffix: "/commits",
      label: "Commits",
      icon: GitCommit,
      count: counts.commits,
    },
    {
      to: "/$owner/$repo/pulls/$number/checks",
      suffix: "/checks",
      label: "Checks",
      icon: CheckCircle2,
    },
  ];

  return (
    <nav
      aria-label="Pull request sections"
      className="mb-4 flex items-stretch gap-0 border-b border-border"
    >
      {tabs.map((t) => {
        const target = `${base}${t.suffix}`;
        const isActive =
          t.suffix === ""
            ? pathname === base || pathname === `${base}/`
            : pathname === target || pathname.startsWith(`${target}/`);
        const Icon = t.icon;
        return (
          <Link
            key={t.suffix}
            to={t.to}
            params={{ owner, repo, number }}
            className={cn(
              "group relative inline-flex items-center gap-1.5 px-3 py-2 text-ui",
              "text-muted-foreground outline-none transition-colors hover:text-foreground",
              "focus-visible:text-foreground",
              isActive && "text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "size-3.5",
                isActive ? "text-foreground" : "text-[var(--color-fg-faint)]",
              )}
              aria-hidden
            />
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-micro tabular-nums",
                  "bg-[var(--color-bg-sunken)] text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-[2px] bg-primary"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
