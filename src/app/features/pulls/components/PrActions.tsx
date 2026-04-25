import {
  CheckCircle2,
  CircleDot,
  GitPullRequestClosed,
  GitPullRequestDraft,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  useSetPrDraft,
  useTogglePrState,
} from "@/app/features/pulls/hooks";
import { toUiState } from "@/app/features/pulls/lib/prStatus";
import type { PullRequest } from "@/app/features/pulls/schemas";

export function PrActions({
  owner,
  repo,
  pr,
}: {
  owner: string;
  repo: string;
  pr: PullRequest;
}) {
  const state = toUiState(pr);
  const toggleState = useTogglePrState(owner, repo, pr.number);
  const setDraft = useSetPrDraft(owner, repo, pr.number);

  if (state === "merged") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {state === "open" && (
          <DropdownMenuItem
            disabled={setDraft.isPending}
            onClick={() => setDraft.mutate({ draft: true, nodeId: pr.node_id })}
          >
            <GitPullRequestDraft />
            Convert to draft
          </DropdownMenuItem>
        )}

        {state === "draft" && (
          <DropdownMenuItem
            disabled={setDraft.isPending}
            onClick={() => setDraft.mutate({ draft: false, nodeId: pr.node_id })}
          >
            <CheckCircle2 />
            Ready for review
          </DropdownMenuItem>
        )}

        {(state === "open" || state === "draft") && (
          <DropdownMenuItem
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "closed" })}
          >
            <GitPullRequestClosed />
            Close pull request
          </DropdownMenuItem>
        )}

        {state === "closed" && (
          <DropdownMenuItem
            disabled={toggleState.isPending}
            onClick={() => toggleState.mutate({ state: "open" })}
          >
            <CircleDot />
            Reopen pull request
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
