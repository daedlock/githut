import { LogOut } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

export type UserMenuProps = {
  login?: string;
  avatarUrl?: string;
  onSignOut: () => void;
};

export function UserMenu({ login, avatarUrl, onSignOut }: UserMenuProps) {
  return (
    <>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={login ?? "User avatar"}
          className="h-7 w-7 rounded-full border border-[var(--color-border-strong)]"
        />
      ) : null}
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
