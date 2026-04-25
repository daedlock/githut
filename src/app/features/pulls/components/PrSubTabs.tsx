import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, Code2, GitCommit, MessageSquare } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";

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
};

export function PrSubTabs({ owner, repo, number, counts }: PrSubTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${owner}/${repo}/pulls/${number}`;

  const tabs = [
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
    <nav aria-label="Pull request sections" className="flex items-center py-3">
      <div className="flex items-center gap-1">
        {tabs.map((t) => {
          const target = `${base}${t.suffix}`;
          const isActive =
            t.suffix === ""
              ? pathname === base || pathname === `${base}/`
              : pathname === target || pathname.startsWith(`${target}/`);
          const Icon = t.icon;
          return (
            <Button key={t.suffix} variant="ghost" asChild>
              <Link
                to={t.to}
                className={cn(isActive && "bg-muted !text-foreground font-medium")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-4" />
                <span>{t.label}</span>
                {typeof t.count === "number" && (
                  <span className="tabular-nums text-muted-foreground">{t.count}</span>
                )}
              </Link>
            </Button>
          );
        })}
      </div>

      <Button variant="default" asChild className="ml-auto">
        <a href={`/${owner}/${repo}/review/${number}`}>
          <Code2 className="size-4" />
          <span>Review</span>
        </a>
      </Button>
    </nav>
  );
}
