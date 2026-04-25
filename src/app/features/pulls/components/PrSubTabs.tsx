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
      className="flex items-center gap-1"
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
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-ui",
              "outline-none transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
                  "tabular-nums",
                  isActive ? "text-muted-foreground" : "text-[var(--color-fg-faint)]",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}

      {/* Review CTA */}
      <a
        href={`/${owner}/${repo}/review/${number}`}
        className={cn(
          "ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5",
          "text-ui font-medium",
          "bg-primary text-primary-foreground",
          "outline-none transition-colors hover:bg-primary/90",
          "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
        )}
      >
        <Code2 className="size-3.5" aria-hidden />
        <span>Review</span>
        {typeof counts.files === "number" && (
          <span className="tabular-nums opacity-80">
            {counts.files}
          </span>
        )}
        {deltas && (
          <span className="tabular-nums opacity-60 text-caption">
            +{deltas.additions} −{deltas.deletions}
          </span>
        )}
      </a>
    </nav>
  );
}
