import {
  ChevronDown,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  PanelsTopLeft,
  Settings,
  Sun,
  User2,
} from "lucide-react";
import { ThemePalettePicker } from "@/app/components/shell/ThemePalettePicker";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { openOrJump } from "@/app/lib/tabActions";
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
  /** "account" shows avatar and login as the sidebar's account switcher; "avatar" is the bare avatar. */
  variant?: "avatar" | "account";
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
  variant = "avatar",
}: UserMenuProps) {
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {variant === "account" ? (
              <button
                type="button"
                aria-label="Open user menu"
                className="flex h-7 min-w-0 items-center gap-2 rounded-md px-1.5 text-ui font-medium outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-foreground/15 aria-expanded:bg-accent"
              >
                {avatarUrl ? (
                  <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="sm" />
                ) : (
                  <User2 className="size-4 text-muted-foreground" />
                )}
                <span className="truncate">{login ?? "Account"}</span>
                <ChevronDown aria-hidden className="size-3 shrink-0 text-(--color-fg-faint)" />
              </button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open user menu"
                className="rounded-full p-0"
              >
                {avatarUrl ? (
                  <Avatar login={login ?? "User avatar"} avatarUrl={avatarUrl} size="lg" />
                ) : (
                  <User2 />
                )}
              </Button>
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Account</TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align={variant === "account" ? "start" : "end"}
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
            <DropdownMenuItem
              // A launcher: jump to an open profile tab or open one, never
              // replacing the focused tab's page.
              onSelect={() => {
                onNavigate?.();
                openOrJump(`/${login}`);
              }}
              className="h-8.5 gap-2 px-2.5 text-ui"
            >
              <User2 />
              Profile
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
          <legend className="sr-only">Appearance</legend>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span aria-hidden className="text-caption font-medium text-foreground">
              Appearance
            </span>
            <ToggleGroup
              type="single"
              size="sm"
              aria-label="Theme"
              value={themePreference}
              onValueChange={(value) => {
                if (value) setThemePreference(value as ThemePreference);
              }}
              className="gap-1 rounded-md bg-background p-1"
            >
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value={value}
                      aria-label={`${label} theme`}
                      className="size-6.5 min-w-0 rounded p-0 data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-border"
                    >
                      <Icon className="size-3" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
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
