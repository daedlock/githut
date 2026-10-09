import { GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { ViewTab } from "@/app/components/ViewTab";
import type { PullsState } from "@/app/features/pulls/hooks";

export function PrStateTab({
  state,
  count,
  isActive,
  onClick,
}: {
  state: PullsState;
  count: number | undefined;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <ViewTab
      icon={state === "open" ? GitPullRequest : GitPullRequestClosed}
      activeIconClassName={state === "open" ? "text-(--color-success)" : "text-muted-foreground"}
      label={state === "open" ? "Open" : "Closed"}
      count={count}
      active={isActive}
      onClick={onClick}
    />
  );
}
