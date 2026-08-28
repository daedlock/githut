import { Check } from "lucide-react";
import { track } from "@/app/lib/analytics";
import { cn } from "@/app/lib/cn";
import { THEME_OPTIONS } from "@/app/lib/themeCatalog";
import { type ThemePreference, useResolvedTheme, useThemeStore } from "@/app/stores/theme";

export function ThemePicker() {
  const palette = useThemeStore((s) => s.palette);
  const preference = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setPreference = useThemeStore((s) => s.setPreference);
  const resolvedTheme = useResolvedTheme();

  const effectivePreference = preference === "system" ? resolvedTheme : preference;
  const activeId = THEME_OPTIONS.find(
    (option) => option.palette === palette && option.preference === effectivePreference,
  )?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              track("theme_changed", { palette: option.palette, preference: option.preference });
              setTheme(option.palette, option.preference);
            }}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 text-left",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              activeId === option.id
                ? "border-input bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:bg-background hover:text-foreground",
            )}
            aria-pressed={activeId === option.id}
            aria-label={`${option.name} theme`}
          >
            <span className="inline-flex items-center gap-1">
              {option.swatches.map((c) => (
                <span
                  key={`${option.id}-${c}`}
                  className="size-2 rounded-full"
                  style={{ backgroundColor: c }}
                  aria-hidden
                />
              ))}
            </span>
            <span className="font-sans text-ui">{option.label}</span>
            <span className="ml-auto font-sans text-caption text-muted-foreground">
              {option.mode}
            </span>
            {activeId === option.id ? (
              <Check className="size-3.5 text-primary" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>

      <PreferenceToggle current={preference} onChange={setPreference} />
    </div>
  );
}

function PreferenceToggle({
  current,
  onChange,
}: {
  current: ThemePreference;
  onChange: (p: ThemePreference) => void;
}) {
  const options: { value: ThemePreference; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-sans text-ui font-medium text-foreground">Preference</span>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              track("theme_preference_changed", { preference: o.value });
              onChange(o.value);
            }}
            className={cn(
              "rounded-sm px-2.5 py-1 font-sans text-caption",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              current === o.value
                ? "bg-[var(--color-bg-sunken)] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={current === o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
