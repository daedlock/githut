import { Check, CircleAlert, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Separator } from "@/app/components/ui/separator";
import { Textarea } from "@/app/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { type ReviewEvent, useSubmitPrReview } from "@/app/features/pulls/hooks";
import type { PendingComment } from "@/app/features/pulls/stores/review";
import { cn } from "@/app/lib/cn";

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
    hint: "Leave feedback without approving.",
    icon: MessageSquare,
    color: "--color-fg-muted",
  },
  {
    id: "APPROVE",
    label: "Approve",
    hint: "Approve merging these changes.",
    icon: Check,
    color: "--color-success",
  },
  {
    id: "REQUEST_CHANGES",
    label: "Request changes",
    hint: "Block merge until this is addressed.",
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
  const verdict = VERDICTS.find((v) => v.id === event)!;

  function handleSubmit() {
    setError(null);
    if (event === "REQUEST_CHANGES" && !body.trim()) {
      setError("Add a summary before requesting changes.");
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
        <Button size="xs">
          <MessageSquare data-icon="inline-start" />
          Submit review
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[400px] gap-0 overflow-hidden p-0">
        <PopoverHeader className="bg-muted px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <PopoverTitle className="text-ui text-foreground">Submit review</PopoverTitle>
              <PopoverDescription className="mt-0.5 text-caption">
                Send a verdict with your pending line comments.
              </PopoverDescription>
            </div>
            {pendingComments.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {pendingComments.length} pending
              </Badge>
            )}
          </div>
        </PopoverHeader>

        <div className="flex flex-col gap-3 p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Leave a summary…"
            autoFocus
            aria-invalid={!!error}
            className="min-h-24 resize-none text-ui"
          />

          <ToggleGroup
            type="single"
            value={event}
            onValueChange={(value) => {
              if (value) setEvent(value as ReviewEvent);
            }}
            orientation="vertical"
            className="w-full items-stretch gap-1"
          >
            {VERDICTS.map((v) => {
              const selected = event === v.id;
              const disabled = v.id === "APPROVE" && isAuthor;
              const Icon = v.icon;
              return (
                <ToggleGroupItem
                  key={v.id}
                  value={v.id}
                  disabled={disabled}
                  className={cn(
                    "h-auto w-full justify-start gap-2.5 rounded-lg border px-3 py-2 text-left",
                    "border-transparent bg-transparent hover:bg-muted data-[state=on]:bg-muted",
                    disabled && "opacity-45",
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
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background"
                    style={selected ? { color: `var(${v.color})` } : undefined}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption font-medium text-foreground">
                      {v.label}
                    </span>
                    <span className="block text-caption font-normal text-muted-foreground">
                      {disabled ? "You can’t approve your own pull request." : v.hint}
                    </span>
                  </span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          {error && <p className="text-caption text-destructive">{error}</p>}
        </div>

        <Separator />
        <div className="flex items-center justify-between gap-3 bg-muted/50 px-3 py-2.5">
          <span className="text-caption text-muted-foreground">
            {event === "REQUEST_CHANGES" ? "Summary required" : "Summary optional"}
          </span>
          <div className="flex items-center gap-2">
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
              disabled={submit.isPending}
              className="min-w-28"
              style={{
                backgroundColor: `color-mix(in oklab, var(${verdict.color}) 30%, var(--color-bg-subtle))`,
                borderColor: `color-mix(in oklab, var(${verdict.color}) 40%, var(--color-border))`,
                color: "var(--color-fg)",
              }}
            >
              {submit.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {submit.isPending ? "Submitting" : "Submit review"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
