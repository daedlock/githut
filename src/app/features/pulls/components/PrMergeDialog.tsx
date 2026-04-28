import { GitMerge } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import type { MergeMethod } from "@/app/features/pulls/hooks";
import type { PullRequest } from "@/app/features/pulls/schemas";
import { cn } from "@/app/lib/cn";

// ─── PrMergeDialog ─────────────────────────────────────────────────────────
//
// Merge confirmation modal. GitHub offers three strategies; we let the
// user pick inline and customize the merge-commit title/body (only
// applicable to "merge" — "squash" and "rebase" commit titles come from
// the PR itself, matching github.com behavior).

export type PrMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pr: PullRequest;
  onConfirm: (vars: {
    method: MergeMethod;
    commitTitle?: string;
    commitMessage?: string;
  }) => void;
  isPending?: boolean;
};

const METHODS: Array<{
  id: MergeMethod;
  label: string;
  hint: string;
}> = [
  {
    id: "merge",
    label: "Create a merge commit",
    hint: "All commits from this branch will be added to the base branch via a merge commit.",
  },
  {
    id: "squash",
    label: "Squash and merge",
    hint: "The commits from this branch will be combined into one commit in the base branch.",
  },
  {
    id: "rebase",
    label: "Rebase and merge",
    hint: "The commits from this branch will be rebased and added to the base branch.",
  },
];

export function PrMergeDialog({
  open,
  onOpenChange,
  pr,
  onConfirm,
  isPending,
}: PrMergeDialogProps) {
  const [method, setMethod] = useState<MergeMethod>("merge");
  const [title, setTitle] = useState(`${pr.title} (#${pr.number})`);
  const [message, setMessage] = useState(pr.body?.trim() ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4 text-[var(--color-pr-merged)]" />
            Merge pull request
          </DialogTitle>
          <DialogDescription>
            Merging will close this pull request and write the branch into{" "}
            <span className="font-mono">{pr.base.ref}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2",
                "outline-none transition-colors",
                method === m.id
                  ? "border-primary bg-[var(--color-bg-sunken)]"
                  : "border-border hover:bg-[var(--color-bg-sunken)]",
              )}
            >
              <input
                type="radio"
                name="merge-method"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="mt-1 accent-[var(--color-brand)]"
              />
              <div className="min-w-0 flex-1">
                <div className="text-body font-medium text-foreground">{m.label}</div>
                <div className="text-caption text-muted-foreground">{m.hint}</div>
              </div>
            </label>
          ))}
        </div>

        {method === "merge" && (
          <div className="flex flex-col gap-2">
            <label className="text-caption font-medium text-foreground">
              Commit title
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="text-caption font-medium text-foreground">
              Commit message
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="mt-1 font-mono text-caption"
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                method,
                commitTitle: method === "merge" ? title : undefined,
                commitMessage: method === "merge" ? message : undefined,
              })
            }
            disabled={isPending}
          >
            {isPending ? "Merging…" : `Confirm ${method}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
