import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useThemeStore } from "@/app/stores/theme";

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABEL = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
} as const;

export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const cycle = useThemeStore((s) => s.cyclePreference);
  const Icon = ICONS[preference];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`${LABEL[preference]} — click to cycle`}
      title={LABEL[preference]}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
