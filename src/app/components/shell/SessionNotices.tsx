import { KeyRound, LogIn, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { RateLimitNotice } from "@/app/components/shell/RateLimitNotice";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { startReauth } from "@/app/lib/auth";
import { useBrowserOnline } from "@/app/lib/connectivity";
import { useAuthStore } from "@/app/stores/auth";

// ─── Session notices ───────────────────────────────────────────────────────
//
// Resilience chrome for the workspace:
// - OfflinePill: a quiet floating notice while the browser is offline.
//   Cached pages stay readable; mutating actions disable themselves.
// - SignInBanner: floats over the workspace when GitHub rejects the token.
//   Signing in again runs in a popup and resumes in place (lib/session.ts),
//   so layout, tabs and drafts are untouched.

export function OfflinePill() {
  const online = useBrowserOnline();
  if (online) return null;
  const detail = "Showing cached pages. Changes are disabled until you reconnect.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          role="status"
          tabIndex={0}
          aria-label={`Offline. ${detail}`}
          className="text-caption font-normal"
        >
          <WifiOff aria-hidden data-icon="inline-start" className="text-(--color-warning)" />
          Offline
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}

const SIGN_IN_TOAST = "sign-in-expired";

/** A persistent sonner toast while the token is rejected; never replaces tabs or drafts. */
export function SignInBanner() {
  const expired = useAuthStore((s) => s.expired);
  useEffect(() => {
    if (!expired) return;
    toast.custom(
      () => (
        <div
          role="alert"
          className="flex min-w-0 max-w-full items-center gap-3 rounded-xl bg-popover py-2 pr-2 pl-3 font-sans shadow-lg ring-1 ring-foreground/10"
        >
          <KeyRound aria-hidden className="size-4 shrink-0 text-(--color-warning)" />
          <p className="min-w-0 text-ui">
            <span className="font-medium text-foreground">Your GitHub sign-in expired.</span>{" "}
            <span className="text-muted-foreground">Your tabs and drafts are kept.</span>
          </p>
          <Button size="sm" onClick={startReauth} className="shrink-0">
            <LogIn data-icon="inline-start" />
            Sign in again
          </Button>
        </div>
      ),
      {
        id: SIGN_IN_TOAST,
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
        position: "top-center",
      },
    );
    return () => {
      toast.dismiss(SIGN_IN_TOAST);
    };
  }, [expired]);
  return null;
}

/** Transient connection status never reserves workspace space. */
export function WorkspaceNotices() {
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-2 [&>*]:pointer-events-auto">
      <RateLimitNotice />
      <OfflinePill />
    </div>
  );
}
