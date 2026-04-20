import { Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";

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
      <Button variant="ghost" size="icon" asChild aria-label="Settings" title="Settings">
        <Link to="/settings">
          <Settings />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut />
      </Button>
    </>
  );
}
