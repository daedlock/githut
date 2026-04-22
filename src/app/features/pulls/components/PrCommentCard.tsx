import type { ReactNode } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { formatRelativeTime } from "@/app/lib/time";

// ─── PrCommentCard ─────────────────────────────────────────────────────────
//
// Framed comment block for PR conversation entries (PR body + issue-level
// comments + review summary bodies). Visually mirrors `issues/CommentCard`
// but without the reactions bar — P3 ships without reactions on PR
// comments; they come back in P10 polish when we unify the primitive.

export function PrCommentCard({
  login,
  avatarUrl,
  date,
  isAuthor,
  header,
  children,
}: {
  login: string;
  avatarUrl?: string;
  date: string;
  isAuthor?: boolean;
  /** Optional slot to the right of the author line (e.g. review state pill). */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card radius="md" tone="default" border="soft" as="article">
      <CardHeader>
        <Avatar login={login} avatarUrl={avatarUrl ?? ""} size="sm" />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-body">
          <ProfileLink login={login} className="font-medium text-foreground">
            {login}
          </ProfileLink>
          {isAuthor && (
            <span className="rounded-sm border border-border bg-[var(--color-bg-subtle)] px-1.5 py-0 text-micro text-muted-foreground">
              Author
            </span>
          )}
          <span className="text-muted-foreground">commented {formatRelativeTime(date)}</span>
          {header && <div className="ml-auto">{header}</div>}
        </div>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
