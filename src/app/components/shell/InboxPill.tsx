import { cn } from "@/app/lib/cn";

export type InboxPillProps = {
  /**
   * Unread count. 0 hides the count (but the button still renders) so the
   * top bar shape doesn't jump when counts flip to/from zero.
   */
  count?: number;
  /** Click handler — P2.T2.b will wire this to the peek drawer. */
  onClick?: () => void;
};

/**
 * Inbox pill — STUB for P1.T1.a.
 *
 * Visual: a filled status dot + a count, shaped as a single pill.
 * Until P2.G3 lands `useNotifications()` this always renders count=0 and
 * the click is a no-op. The shape is kept stable so P2.T2.b only has to
 * replace the click handler and plumb a real count in.
 *
 * Dot uses --color-accent because the inbox IS the attention surface —
 * anything in it wants your eye. When empty the dot fades to --color-fg-faint.
 */
export function InboxPill({ count = 0, onClick }: InboxPillProps) {
  const hasUnread = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnread ? `Inbox — ${count} unread` : "Inbox"}
      title="Inbox"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1",
        "text-caption tabular-nums",
        "text-[var(--color-fg-muted)]",
        "transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          hasUnread ? "bg-[var(--color-accent)]" : "bg-[var(--color-fg-faint)]",
        )}
      />
      <span>{count}</span>
    </button>
  );
}
