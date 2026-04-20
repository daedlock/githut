import { CheckCircle2, CircleDot } from "lucide-react";
import { cn } from "@/app/lib/cn";

export function IssueStatePill({ state }: { state: "open" | "closed" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-ui font-semibold",
        state === "open"
          ? "bg-[var(--color-issue-open-bg)] text-[var(--color-issue-open-fg)]"
          : "bg-[var(--color-issue-closed-bg)] text-[var(--color-issue-closed-fg)]",
      )}
    >
      {state === "open" ? <CircleDot className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {state === "open" ? "Open" : "Closed"}
    </span>
  );
}
