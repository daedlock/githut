import { CheckCircle2, MessageSquare, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { Textarea } from "@/app/components/ui/textarea";
import { useSubmitPrReview, type ReviewEvent } from "@/app/features/pulls/hooks";
import type { PendingComment } from "@/app/features/pulls/stores/review";
import { cn } from "@/app/lib/cn";

// ─── PrReviewDialog ────────────────────────────────────────────────────────
//
// Minimal "Finish your review" modal: type a body, pick a verdict
// (Comment / Approve / Request changes), submit. Matches the semantics
// of github.com's diff-tab "Review changes" dropdown — inline diff
// comments are layered on top in P5; this ships the top-level review
// flow in isolation.

const OPTIONS: Array<{
  id: ReviewEvent;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    id: "COMMENT",
    label: "Comment",
    hint: "Submit general feedback without explicit approval.",
    icon: MessageSquare,
    tone: "text-[var(--color-fg-muted)]",
  },
  {
    id: "APPROVE",
    label: "Approve",
    hint: "Submit feedback and approve merging these changes.",
    icon: CheckCircle2,
    tone: "text-[var(--color-success)]",
  },
  {
    id: "REQUEST_CHANGES",
    label: "Request changes",
    hint: "Submit feedback that must be addressed before merging.",
    icon: XCircle,
    tone: "text-[var(--color-danger)]",
  },
];

export type PrReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  repo: string;
  number: number;
  isAuthor: boolean;
  pendingComments?: PendingComment[];
  onReviewSubmitted?: () => void;
};

export function PrReviewDialog({
  open,
  onOpenChange,
  owner,
  repo,
  number,
  isAuthor,
  pendingComments = [],
  onReviewSubmitted,
}: PrReviewDialogProps) {
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useSubmitPrReview(owner, repo, number);

  function handleSubmit() {
    setError(null);
    // GitHub requires a body for REQUEST_CHANGES; enforce here to save a
    // round-trip.
    if (event === "REQUEST_CHANGES" && !body.trim()) {
      setError("A comment is required when requesting changes.");
      return;
    }
    const comments = pendingComments.map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    }));
    submit.mutate(
      { event, body, comments },
      {
        onSuccess: () => {
          setBody("");
          setEvent("COMMENT");
          onReviewSubmitted?.();
          onOpenChange(false);
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : "Failed to submit review.",
          );
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Finish your review</DialogTitle>
          <DialogDescription>
            {pendingComments.length > 0
              ? `${pendingComments.length} pending inline ${
                  pendingComments.length === 1 ? "comment" : "comments"
                } will be submitted with this review.`
              : "Submit your feedback for this pull request."}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Leave a review summary…"
          className="font-mono text-caption"
        />

        <fieldset className="flex flex-col gap-2">
          {OPTIONS.map((o) => {
            const disabled = o.id === "APPROVE" && isAuthor;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2",
                  "outline-none transition-colors",
                  event === o.id
                    ? "border-primary bg-[var(--color-bg-sunken)]"
                    : "border-border hover:bg-[var(--color-bg-sunken)]",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <input
                  type="radio"
                  name="review-event"
                  value={o.id}
                  checked={event === o.id}
                  disabled={disabled}
                  onChange={() => setEvent(o.id)}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <o.icon className={cn("mt-0.5 size-4", o.tone)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">{o.label}</div>
                  <div className="text-caption text-muted-foreground">
                    {disabled
                      ? "You can't approve your own pull request."
                      : o.hint}
                  </div>
                </div>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <div className="rounded-md border border-[var(--color-danger)] bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-bg))] px-3 py-2 text-caption text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
