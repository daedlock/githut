import { Link } from "@tanstack/react-router";
import { KeyRound, LogOut, Monitor, Moon, PanelsTopLeft, Settings, Sun, User2 } from "lucide-react";
import { ThemePalettePicker } from "@/app/components/shell/ThemePalettePicker";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/lib/cn";
import { openSettings } from "@/app/stores/settingsModal";
import type { ThemePreference } from "@/app/stores/theme";
import { useThemeStore } from "@/app/stores/theme";
import { dispatch } from "@/app/workspace/store";

export type UserMenuProps = {
  login?: string;
  avatarUrl?: string;
  onSignOut: () => void;
  onReAuth?: () => void;
  onNavigate?: () => void;
  variant?: "full" | "compact";
};

const THEME_OPTIONS: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function UserMenu({
  login,
  avatarUrl,
  onSignOut,
  onReAuth,
  onNavigate,
  variant = "full",
}: UserMenuProps) {
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
              "rounded-full outline-none transition-opacity hover:opacity-80",
              "focus-visible:ring-2 focus-visible:ring-(--color-focus) focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            )}
          >
            {avatarUrl ? (
              <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" />
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User2 className="size-3.5" />
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[320px] overflow-hidden rounded-xl bg-popover p-2.5"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            {avatarUrl ? (
              <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" />
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-background text-muted-foreground">
                <User2 className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-code font-medium leading-tight text-foreground">
                {login ? `@${login}` : "Account"}
              </p>
              <p className="mt-0.5 truncate text-caption leading-tight text-muted-foreground">
                github.com
              </p>
            </div>
          </div>

          <DropdownMenuGroup className="my-2 flex flex-col gap-1">
            {login ? (
              <DropdownMenuItem asChild className="h-8.5 gap-2 px-2.5 text-ui">
                <Link to="/$username" params={{ username: login }} onClick={onNavigate}>
                  <User2 />
                  Profile
                </Link>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem
              onSelect={() => {
                onNavigate?.();
                openSettings();
              }}
              className="h-8.5 gap-2 px-2.5 text-ui"
            >
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => dispatch({ type: "resetLayout" })}
              className="h-8.5 gap-2 px-2.5 text-ui"
            >
              <PanelsTopLeft />
              Reset layout
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <fieldset
            className="rounded-md bg-muted p-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") e.stopPropagation();
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <legend className="text-caption font-medium text-foreground">Appearance</legend>
              <div className="flex items-center gap-1 rounded-md bg-background p-1">
                {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={themePreference === value}
                    title={label}
                    aria-label={`${label} theme`}
                    onClick={() => setThemePreference(value)}
                    className={cn(
                      "flex size-6.5 items-center justify-center rounded transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
                      themePreference === value
                        ? "bg-muted text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3" />
                  </button>
                ))}
              </div>
            </div>

            <ThemePalettePicker />
          </fieldset>

          <DropdownMenuGroup className="mt-2 flex flex-col gap-1">
            {onReAuth ? (
              <DropdownMenuItem
                className="h-8.5 gap-2 px-2.5 text-ui"
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
              className="h-8.5 gap-2 px-2.5 text-ui"
              onSelect={(e) => {
                e.preventDefault();
                onSignOut();
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {avatarUrl ? <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" /> : null}
      <ThemeToggle />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => openSettings()}
        aria-label="Settings"
        title="Settings"
      >
        <Settings />
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
