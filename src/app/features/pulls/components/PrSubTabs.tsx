import { Link, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, FileDiff, GitCommit, MessageSquare } from "lucide-react";
import { ChangeStatsBadge } from "@/app/components/code";
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
  changeStats?: {
    additions: number;
    deletions: number;
  };
};

export type PrSubTabKey = "conversation" | "commits" | "checks";

export function getActivePrSubTab(
  pathname: string,
  owner: string,
  repo: string,
  number: number,
): PrSubTabKey | null {
  const base = `/${owner}/${repo}/pull/${number}`;
  if (pathname === `${base}/commits` || pathname.startsWith(`${base}/commits/`)) return "commits";
  if (pathname === `${base}/checks` || pathname.startsWith(`${base}/checks/`)) return "checks";
  if (pathname === base || pathname === `${base}/`) return "conversation";
  return null;
}

export function PrSubTabs({ owner, repo, number, counts, changeStats }: PrSubTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${owner}/${repo}/pull/${number}`;
  const activeTab = getActivePrSubTab(pathname, owner, repo, number);

  const tabs = [
    {
      key: "conversation" as const,
      to: `${base}`,
      label: "Conversation",
      icon: MessageSquare,
      count: counts.conversation,
    },
    {
      key: "commits" as const,
      to: `${base}/commits`,
      label: "Commits",
      icon: GitCommit,
      count: counts.commits,
    },
    {
      key: "checks" as const,
      to: `${base}/checks`,
      label: "Checks",
      icon: CheckCircle2,
      count: counts.checks,
    },
    {
      key: "files" as const,
      to: `/${owner}/${repo}/pr/${number}`,
      label: "Files changed",
      icon: FileDiff,
      count: counts.files,
    },
  ];

  return (
    <nav aria-label="Pull request sections" className="flex min-w-0 items-center overflow-x-auto py-3">
      <div className="flex shrink-0 items-center gap-1">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          const Icon = t.icon;
          return (
            <Button key={t.key} variant="ghost" asChild>
              <Link
                to={t.to}
                className={cn(isActive && "bg-muted !text-foreground font-medium")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon data-icon="inline-start" className="@max-xl/pane:hidden" />
                <span>{t.label}</span>
                {typeof t.count === "number" && (
                  <span className="tabular-nums text-muted-foreground">{t.count}</span>
                )}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="ml-auto hidden items-center gap-2 @2xl/pane:flex">
        {changeStats && (
          <ChangeStatsBadge additions={changeStats.additions} deletions={changeStats.deletions} />
        )}
      </div>
    </nav>
  );
}
