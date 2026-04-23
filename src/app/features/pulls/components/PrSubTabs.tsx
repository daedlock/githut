import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, Code2, GitCommit, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  suffix: string;
};

export type PrSubTabsProps = {
  owner: string;
  repo: string;
  number: number;
  counts: {
    conversation?: number;
    commits?: number;
    checks?: number;
    files?: number;
  };
  deltas?: { additions: number; deletions: number };
};

export function PrSubTabs({ owner, repo, number, counts, deltas }: PrSubTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${owner}/${repo}/pulls/${number}`;

  const tabs: Tab[] = [
    {
      to: `${base}`,
      suffix: "",
      label: "Conversation",
      icon: MessageSquare,
      count: counts.conversation,
    },
    {
      to: `${base}/commits`,
      suffix: "/commits",
      label: "Commits",
      icon: GitCommit,
      count: counts.commits,
    },
    {
      to: `${base}/checks`,
      suffix: "/checks",
      label: "Checks",
      icon: CheckCircle2,
      count: counts.checks,
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

      {/* Review CTA — links to the dedicated full-width review view */}
      <a
        href={`/${owner}/${repo}/review/${number}`}
        className={cn(
          "ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1 my-1",
          "text-caption font-medium",
          "bg-primary text-primary-foreground",
          "outline-none transition-colors hover:bg-primary/90",
          "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        )}
      >
        <Code2 className="size-3.5" aria-hidden />
        Review
        {typeof counts.files === "number" && (
          <span className="tabular-nums opacity-80">
            {counts.files}
          </span>
        )}
        {deltas && (
          <span className="tabular-nums opacity-70 text-micro">
            +{deltas.additions} −{deltas.deletions}
          </span>
        )}
      </a>
    </nav>
  );
}
