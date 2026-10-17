import { Badge } from "@/app/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useRateLimitStore } from "@/app/stores/rateLimit";

export function RateLimitNotice() {
  const until = useRateLimitStore((state) => state.slowUntil);
  if (!until) return null;
  const reset = new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const detail = `GitHub's rate limit is low. Automatic updates run four times less often until ${reset}.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          role="status"
          aria-label={detail}
          className="text-caption font-normal"
        >
          Updates slowed
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
