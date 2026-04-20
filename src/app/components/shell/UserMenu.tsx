import { LogOut } from "lucide-react";
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
