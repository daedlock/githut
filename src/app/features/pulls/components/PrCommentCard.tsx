import type { ReactNode } from "react";
import { Comment } from "@/app/components/ui/CommentCard";

/**
 * PrCommentCard — PR conversation comment using unified Comment component.
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
    <Comment
      login={login}
      date={date}
      isAuthor={isAuthor}
      actions={header}
    >
      {children}
    </Comment>
  );
}
