import { Check } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { runThemeTransition } from "@/app/lib/themeTransition";
import { type Palette, type ThemePreference, useThemeStore } from "@/app/stores/theme";

type ThemeOption = {
  id: string;
  label: string;
  mode: "light" | "dark";
  palette: Palette;
  preference: "light" | "dark";
  swatches: [string, string, string];
};

const OPTIONS: ThemeOption[] = [
  {
    id: "stone-light",
    label: "Stone",
    mode: "light",
    palette: "stone",
    preference: "light",
    swatches: ["#fafaf9", "#1c1917", "#ea580c"],
  },
  {
    id: "stone-dark",
    label: "Stone",
    mode: "dark",
    palette: "stone",
    preference: "dark",
    swatches: ["#0c0a09", "#d6d3d1", "#fb923c"],
  },
  {
    id: "ember-light",
    label: "Ember",
    mode: "light",
    palette: "ember",
    preference: "light",
    swatches: ["#fef3e2", "#2f241f", "#e46f3a"],
  },
  {
    id: "ember-soft",
    label: "Ember Soft",
    mode: "dark",
    palette: "ember-soft",
    preference: "dark",
    swatches: ["#1d1a1a", "#e0d7d3", "#ea7a4a"],
  },
  {
    id: "ember",
    label: "Ember",
    mode: "dark",
    palette: "ember",
    preference: "dark",
    swatches: ["#141212", "#ddd6d3", "#f97316"],
  },
  {
    id: "dune",
    label: "Dune",
    mode: "dark",
    palette: "dune",
    preference: "dark",
    swatches: ["#1a1712", "#d9d2c6", "#d6a554"],
  },
  {
    id: "haze",
    label: "Haze",
    mode: "dark",
    palette: "haze",
    preference: "dark",
    swatches: ["#17131c", "#ded4e9", "#b38bd8"],
  },
  {
    id: "lagoon-light",
    label: "Lagoon",
    mode: "light",
    palette: "lagoon",
    preference: "light",
    swatches: ["#d8eae6", "#2d2818", "#b85540"],
  },
  {
    id: "lagoon",
    label: "Lagoon",
    mode: "dark",
    palette: "lagoon",
    preference: "dark",
    swatches: ["#0f1718", "#d7e3de", "#2aa29f"],
  },
  {
    id: "matrix",
    label: "Matrix",
    mode: "dark",
    palette: "matrix",
    preference: "dark",
    swatches: ["#0b120a", "#c5dcbf", "#4ad66d"],
  },
  {
    id: "moss",
    label: "Moss",
    mode: "dark",
    palette: "moss",
    preference: "dark",
    swatches: ["#12150f", "#d8decf", "#7ea66a"],
  },
  {
    id: "sagecream",
    label: "Sagecream",
    mode: "dark",
    palette: "sagecream",
    preference: "dark",
    swatches: ["#161715", "#ddddd5", "#9db89f"],
  },
];

export function ThemePicker() {
  const palette = useThemeStore((s) => s.palette);
  const preference = useThemeStore((s) => s.preference);
  const setPalette = useThemeStore((s) => s.setPalette);
  const setPreference = useThemeStore((s) => s.setPreference);

  const activeId = OPTIONS.find((o) => o.palette === palette && o.preference === preference)?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              runThemeTransition(() => {
                setPalette(option.palette);
                setPreference(option.preference);
              });
            }}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 text-left",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              activeId === option.id
                ? "border-primary bg-muted text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-input",
            )}
            aria-pressed={activeId === option.id}
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
            <span className="ml-auto font-mono text-micro uppercase tracking-widest text-fg-faint">
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
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        Preference
      </span>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-sm px-2.5 py-1 font-mono text-micro",
              "outline-none transition-colors",
              "focus-visible:ring-1 focus-visible:ring-foreground/15",
              current === o.value
                ? "bg-[var(--color-bg-sunken)] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
