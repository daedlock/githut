import { Link } from "@tanstack/react-router";
import { KeyRound, LogOut, Monitor, Moon, Settings, Sun, User2 } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/lib/cn";
import type { ThemePreference } from "@/app/stores/theme";
import { useThemeStore } from "@/app/stores/theme";

export type UserMenuProps = {
  login?: string;
  avatarUrl?: string;
  onSignOut: () => void;
  onReAuth?: () => void;
  variant?: "full" | "compact";
};

const THEME_OPTIONS: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function UserMenu({ login, avatarUrl, onSignOut, onReAuth, variant = "full" }: UserMenuProps) {
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open user menu"
            title="User menu"
            className={cn(
              "rounded-full outline-none transition-opacity",
              "hover:opacity-80",
              "focus-visible:ring-2 focus-visible:ring-(--color-focus) focus-visible:ring-offset-1 focus-visible:ring-offset-(--color-bg)",
            )}
          >
            {avatarUrl ? (
              <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" />
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-(--color-bg-sunken) text-muted-foreground">
                <User2 className="size-3.5" />
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={10} className="w-56 p-1.5">
          {/* Identity header */}
          <div className="flex items-center gap-3 px-2 pb-2.5 pt-1.5">
            {avatarUrl ? (
              <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="xl" />
            ) : (
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-(--color-bg-sunken) text-muted-foreground">
                <User2 className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-code font-semibold leading-tight text-foreground">
                {login ? `@${login}` : "Account"}
              </p>
              <p className="mt-0.5 truncate text-caption leading-tight text-muted-foreground">
                github.com
              </p>
            </div>
          </div>

          <DropdownMenuSeparator className="-mx-1.5 mb-1" />

          {/* Navigation */}
          {login ? (
            <DropdownMenuItem asChild>
              <Link to="/$username" params={{ username: login }}>
                <User2 />
                Profile
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>

          {/* Theme — inline segmented control, no flyout */}
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <span className="flex-1 text-ui text-muted-foreground">Theme</span>
            <div className="flex items-center gap-0.5 rounded-md bg-(--color-bg-sunken) p-0.5">
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={`${label} theme`}
                  aria-pressed={themePreference === value}
                  onClick={() => setThemePreference(value)}
                  className={cn(
                    "flex h-5.5 w-5.5 items-center justify-center rounded transition-colors",
                    themePreference === value
                      ? "bg-(--color-bg) text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                </button>
              ))}
            </div>
          </div>

          <DropdownMenuSeparator className="-mx-1.5 mt-1" />

          {/* Account actions */}
          {onReAuth ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onReAuth();
              }}
            >
              <KeyRound />
              Manage GitHub access
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              onSignOut();
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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
      {onReAuth ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onReAuth}
          aria-label="Manage GitHub access"
          title="Manage GitHub access"
        >
          <KeyRound />
        </Button>
      ) : null}
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
