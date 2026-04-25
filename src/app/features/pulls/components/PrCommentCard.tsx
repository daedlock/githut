import type { ReactNode } from "react";
import { formatRelativeTime } from "@/app/lib/time";

/**
 * Comment block for PR conversation. Flat on page surface,
 * header gets subtle bg-muted strip. No border wrapper.
 */
export function PrCommentCard({
  login,
  date,
  isAuthor,
  header,
  children,
}: {
  login: string;
  date: string;
  isAuthor?: boolean;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg bg-muted overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-caption">
        <span className="font-medium text-foreground">{login}</span>
        {isAuthor && (
          <span className="rounded bg-background px-1.5 text-micro text-muted-foreground">
            Author
          </span>
        )}
        <span className="text-muted-foreground">commented</span>
        <span className="text-[var(--color-fg-faint)]">{formatRelativeTime(date)}</span>
        {header && <div className="ml-auto">{header}</div>}
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </article>
  );
}
