import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { KeyRound, LogIn, WifiOff } from "lucide-react";

import { RateLimitNotice } from "@/app/components/shell/RateLimitNotice";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { startReauth } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2",
            "text-caption text-muted-foreground",
          )}
        >
          <WifiOff aria-hidden className="size-3.5 text-(--color-warning)" />
          Offline
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Showing cached pages. Changes are disabled until you reconnect.
      </TooltipContent>
    </Tooltip>
  );
}

export function SignInBanner() {
  const expired = useAuthStore((s) => s.expired);
  const reduced = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-40 flex justify-center px-4">
      <AnimatePresence>
        {expired && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: reduced ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "pointer-events-auto flex min-w-0 max-w-full items-center gap-3 py-2 pr-2 pl-3",
              "rounded-xl bg-popover shadow-lg ring-1 ring-foreground/10",
            )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
