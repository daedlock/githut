import { CheckCircle2, CircleDot } from "lucide-react";
import { ViewTab } from "@/app/components/ViewTab";

export type StateFilter = "open" | "closed";

export function StateTab({
  state,
  count,
  isActive,
  onClick,
}: {
  state: StateFilter;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <ViewTab
      icon={state === "open" ? CircleDot : CheckCircle2}
      activeIconClassName={state === "open" ? "text-(--color-success)" : "text-(--color-pr-merged)"}
      label={state === "open" ? "Open" : "Closed"}
      count={count}
      active={isActive}
      onClick={onClick}
    />
  );
}
