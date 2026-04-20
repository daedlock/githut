import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export type ProfileLinkProps = {
  login: string;
  children?: ReactNode;
  className?: string;
  stopPropagation?: boolean;
};

function isLinkableLogin(login: string): boolean {
  const normalized = login.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "ghost";
}

export function ProfileLink({
  login,
  children,
  className,
  stopPropagation = false,
}: ProfileLinkProps) {
  const content = children ?? login;

  if (!isLinkableLogin(login)) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link
      to="/$username"
      params={{ username: login }}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        "rounded-sm outline-none transition-colors",
        "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
        className,
      )}
    >
      {content}
    </Link>
  );
}
