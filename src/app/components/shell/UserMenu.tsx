import { Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Avatar } from "@/app/components/ui/Avatar";
import { Button } from "@/app/components/ui/Button";

export type UserMenuProps = {
  login?: string;
  avatarUrl?: string;
  onSignOut: () => void;
};

export function UserMenu({ login, avatarUrl, onSignOut }: UserMenuProps) {
  return (
    <>
      {avatarUrl ? <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" /> : null}
      {/*
       * Theme toggle lives in the user menu per §3 — it's a preference,
       * not primary navigation, so it doesn't belong in the top-bar action row.
       */}
      <ThemeToggle />
      <Link
        to="/settings"
        aria-label="Settings"
        title="Settings"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
      >
        <Settings className="h-4 w-4" />
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </>
  );
}
