import { Check, CircleAlert, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { type ReviewEvent, useSubmitPrReview } from "@/app/features/pulls/hooks";
import type { PendingComment } from "@/app/features/pulls/stores/review";
import { cn } from "@/app/lib/cn";
import { useCanMutate } from "@/app/lib/connectivity";

const VERDICTS: Array<{
  id: ReviewEvent;
  label: string;
  hint: string;
  icon: typeof Check;
  color: string;
}> = [
  {
    id: "COMMENT",
    label: "Comment",
    hint: "General feedback without approval",
    icon: MessageSquare,
    color: "--color-fg-muted",
  },
  {
    id: "APPROVE",
    label: "Approve",
    hint: "Approve merging these changes",
    icon: Check,
    color: "--color-success",
  },
  {
    id: "REQUEST_CHANGES",
    label: "Request changes",
    hint: "Changes must be addressed first",
    icon: CircleAlert,
    color: "--color-danger",
  },
];

export type PrReviewPopoverProps = {
  owner: string;
  repo: string;
  number: number;
  isAuthor: boolean;
  pendingComments?: PendingComment[];
  onReviewSubmitted?: () => void;
};

export function PrReviewPopover({
  owner,
  repo,
  number,
  isAuthor,
  pendingComments = [],
  onReviewSubmitted,
}: PrReviewPopoverProps) {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitPrReview(owner, repo, number);
  const { canMutate, reason: cannotMutateReason } = useCanMutate();

  const verdict = VERDICTS.find((v) => v.id === event)!;

  function handleSubmit() {
    setError(null);
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
          setOpen(false);
          onReviewSubmitted?.();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to submit review.");
        },
      },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="xs">Submit review</Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        aria-label="Submit review"
        className="w-[360px] max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] gap-3 overflow-y-auto p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-ui font-semibold text-foreground">Submit review</span>
          {pendingComments.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-micro font-medium text-muted-foreground tabular-nums">
              {pendingComments.length} pending
            </span>
          )}
        </div>

        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
          rows={3}
          placeholder="Leave a summary…"
          aria-label="Review summary"
          autoFocus
          className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-ui text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-[var(--color-fg-muted)]/20 focus:bg-[var(--color-fg-muted)]/5 focus:outline-none"
        />

        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Review verdict</legend>
          {VERDICTS.map((v) => {
            const selected = event === v.id;
            const disabled = v.id === "APPROVE" && isAuthor;
            const Icon = v.icon;
            return (
              <label
                key={v.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
                  selected ? "border" : "border border-transparent hover:bg-muted",
                  disabled && "pointer-events-none opacity-40",
                )}
                style={
                  selected
                    ? {
                        borderColor: `color-mix(in oklab, var(${v.color}) 40%, var(--color-border))`,
                        backgroundColor: `color-mix(in oklab, var(${v.color}) 8%, var(--color-bg-subtle))`,
                      }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="review-event"
                  value={v.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => {
                    setEvent(v.id);
                    setError(null);
                  }}
                  className="sr-only"
                />
                <Icon
                  className="size-3.5 shrink-0 transition-colors"
                  style={{ color: selected ? `var(${v.color})` : undefined }}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-caption font-medium text-foreground">{v.label}</span>
                  <span className="ml-1.5 text-caption text-muted-foreground">
                    {disabled ? "Can't approve own PR" : v.hint}
                  </span>
                </div>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <p role="alert" className="text-caption text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setOpen(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={handleSubmit}
            disabled={submit.isPending || !canMutate}
            title={cannotMutateReason}
            className="min-w-[6rem]"
            style={{
              backgroundColor: `color-mix(in oklab, var(${verdict.color}) 30%, var(--color-bg-subtle))`,
              borderColor: `color-mix(in oklab, var(${verdict.color}) 40%, var(--color-border))`,
              color: `var(--color-fg)`,
            }}
          >
            {submit.isPending ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
