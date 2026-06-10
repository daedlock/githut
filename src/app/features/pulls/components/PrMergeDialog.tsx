import { AlertCircle, GitMerge } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
// Merge / auto-merge confirmation modal. GitHub offers three strategies;
// callers pass the repo-allowed subset so disabled merge methods never show.
// Commit title/body customization is kept for merge commits, matching the
// existing in-app behavior.

export type PrMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pr: PullRequest;
  onConfirm: (vars: { method: MergeMethod; commitTitle?: string; commitMessage?: string }) => void;
  isPending?: boolean;
  intent?: "merge" | "auto-merge" | "admin-merge";
  allowedMethods?: MergeMethod[];
  errorMessage?: string;
};

const DEFAULT_ALLOWED_METHODS: MergeMethod[] = ["merge", "squash", "rebase"];

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
  intent = "merge",
  allowedMethods = DEFAULT_ALLOWED_METHODS,
  errorMessage,
}: PrMergeDialogProps) {
  const availableMethods = useMemo(
    () => METHODS.filter((m) => allowedMethods.includes(m.id)),
    [allowedMethods],
  );
  const [method, setMethod] = useState<MergeMethod>(availableMethods[0]?.id ?? "merge");
  const [title, setTitle] = useState(`${pr.title} (#${pr.number})`);
  const [message, setMessage] = useState(pr.body?.trim() ?? "");
  const isAutoMerge = intent === "auto-merge";
  const isAdminMerge = intent === "admin-merge";

  useEffect(() => {
    const next = availableMethods[0]?.id ?? "merge";
    if (!allowedMethods.includes(method)) setMethod(next);
  }, [allowedMethods, availableMethods, method]);

  const titleId = `merge-title-${pr.number}`;
  const messageId = `merge-message-${pr.number}`;

  useEffect(() => {
    setTitle(`${pr.title} (#${pr.number})`);
    setMessage(pr.body?.trim() ?? "");
  }, [pr.body, pr.number, pr.title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4 text-[var(--color-pr-merged)]" />
            {isAutoMerge
              ? "Enable auto-merge"
              : isAdminMerge
                ? "Bypass requirements and merge"
                : "Merge pull request"}
          </DialogTitle>
          <DialogDescription>
            {isAutoMerge
              ? "GitHub will merge this pull request once all required checks and reviews pass."
              : isAdminMerge
                ? "Your GitHub permissions allow bypassing required checks or reviews. This will close the pull request and write the branch into"
                : "Merging will close this pull request and write the branch into"}{" "}
            <span className="font-mono">{pr.base.ref}</span>.
          </DialogDescription>
        </DialogHeader>

        {isAdminMerge && (
          <div className="rounded-md border border-[color-mix(in_oklab,var(--color-warning)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-bg-subtle))] px-3 py-2 text-caption text-foreground">
            This uses administrator bypass on GitHub. Only proceed if the remaining requirements are
            intentionally being overridden.
          </div>
        )}

        {errorMessage && (
          <div
            className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-danger)_8%,var(--color-bg-subtle))] px-3 py-2 text-caption text-foreground"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-danger)]" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {availableMethods.map((m) => (
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
            <label htmlFor={titleId} className="text-caption font-medium text-foreground">
              Commit title
              <Input
                id={titleId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </label>
            <label htmlFor={messageId} className="text-caption font-medium text-foreground">
              Commit message
              <Textarea
                id={messageId}
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
            {isPending
              ? isAutoMerge
                ? "Enabling…"
                : "Merging…"
              : isAutoMerge
                ? "Enable auto-merge"
                : isAdminMerge
                  ? `Bypass and ${method}`
                  : `Confirm ${method}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
