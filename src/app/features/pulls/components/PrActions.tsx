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
import { useCanMutate } from "@/app/lib/connectivity";

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
  const { canMutate } = useCanMutate();

  if (state === "merged") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {state === "open" && (
          <DropdownMenuItem
            disabled={setDraft.isPending || !canMutate}
            onClick={() => setDraft.mutate({ draft: true, nodeId: pr.node_id })}
          >
            <GitPullRequestDraft className="text-muted-foreground" />
            <span className="whitespace-nowrap">Convert to draft</span>
          </DropdownMenuItem>
        )}

        {state === "draft" && (
          <DropdownMenuItem
            disabled={setDraft.isPending || !canMutate}
            onClick={() => setDraft.mutate({ draft: false, nodeId: pr.node_id })}
          >
            <CheckCircle2 className="text-muted-foreground" />
            <span className="whitespace-nowrap">Ready for review</span>
          </DropdownMenuItem>
        )}

        {(state === "open" || state === "draft") && (
          <DropdownMenuItem
            variant="destructive"
            disabled={toggleState.isPending || !canMutate}
            onClick={() => toggleState.mutate({ state: "closed" })}
          >
            <GitPullRequestClosed />
            <span className="whitespace-nowrap">Close pull request</span>
          </DropdownMenuItem>
        )}

        {state === "closed" && (
          <DropdownMenuItem
            disabled={toggleState.isPending || !canMutate}
            onClick={() => toggleState.mutate({ state: "open" })}
          >
            <CircleDot className="text-[var(--color-success)]" />
            <span className="whitespace-nowrap">Reopen pull request</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
