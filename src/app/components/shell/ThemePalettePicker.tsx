import { Palette as PaletteIcon } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/app/lib/cn";
import { type Palette, useResolvedTheme, useThemeStore } from "@/app/stores/theme";

/**
 * Palette picker — 10 theme chips in a 5×2 grid, each rendered in its own
 * `data-theme` scope so the chip LITERALLY previews the theme's palette.
 *
 * Every chip shows a miniature "H_" — fg letter + accent underscore — which
 * is our wordmark in microcosm. Immediate visual read of the two most
 * meaningful colors: content color and brand color, against the theme bg.
 *
 * Accessibility: roving-tabindex radiogroup. Arrow keys walk the grid
 * (←/→ within a row, ↑/↓ across rows). Enter/Space selects (default radio
 * behavior). Only the active chip is tabbable; Tab exits the group.
 */

type PaletteDef = {
  id: Palette;
  name: string;
};

const PALETTES: PaletteDef[] = [
  { id: "main", name: "main" },
  { id: "stone", name: "stone" },
  { id: "ember", name: "ember" },
  { id: "ember-soft", name: "ember-soft" },
  { id: "dune", name: "dune" },
  { id: "haze", name: "haze" },
  { id: "lagoon", name: "lagoon" },
  { id: "lagoon-light", name: "lagoon-light" },
  { id: "matrix", name: "matrix" },
  { id: "moss", name: "moss" },
  { id: "sagecream", name: "sagecream" },
];

const COLS = 6;

export function ThemePalettePicker() {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);
  const groupRef = useRef<HTMLDivElement>(null);

  const focusIdx = (idx: number) => {
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[idx]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIdx = PALETTES.findIndex((p) => p.id === palette);
    if (currentIdx < 0) return;
    const n = PALETTES.length;

    let next = currentIdx;
    switch (e.key) {
      case "ArrowRight":
        next = (currentIdx + 1) % n;
        break;
      case "ArrowLeft":
        next = (currentIdx - 1 + n) % n;
        break;
      case "ArrowDown":
        next = (currentIdx + COLS) % n;
        break;
      case "ArrowUp":
        next = (currentIdx - COLS + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = PALETTES[next];
    if (target) {
      setPalette(target.id);
      requestAnimationFrame(() => focusIdx(next));
    }
  };

  return (
    <div className="px-1.5 py-1.5">
      <div
        id="palette-heading"
        className="mb-1.5 flex items-center justify-between px-0.5 font-mono text-micro uppercase tracking-widest text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          <PaletteIcon className="size-3 text-(--color-fg-faint)" aria-hidden />
          Palette
        </span>
        <span className="font-mono text-micro normal-case tracking-normal italic text-(--color-fg-faint)">
          {PALETTES.find((p) => p.id === palette)?.name}
        </span>
      </div>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="palette-heading"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-6 gap-1"
      >
        {PALETTES.map((p, i) => (
          <PaletteChip
            key={p.id}
            palette={p}
            active={palette === p.id}
            onSelect={() => setPalette(p.id)}
            delayMs={i * 18}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Chip ───────────────────────────────────────────────────────────────────

function PaletteChip({
  palette: p,
  active,
  onSelect,
  delayMs,
}: {
  palette: PaletteDef;
  active: boolean;
  onSelect: () => void;
  delayMs: number;
}) {
  const resolved = useResolvedTheme();
  const chipTheme = p.id === "main"
    ? (resolved === "dark" ? "main-dark" : "main-light")
    : p.id;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${p.name} palette`}
      title={p.name}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "group flex flex-col items-center gap-1 rounded-[var(--radius-sm)] p-0.5",
        "outline-none",
        "focus-visible:bg-(--color-bg-sunken)",
        "animate-[chip-in_200ms_ease-out_backwards]",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        data-theme={chipTheme}
        className={cn(
          "relative flex h-7 w-full items-center justify-center overflow-hidden",
          "rounded-[var(--radius-xs)] border bg-(--color-bg)",
          "transition-[transform,border-color] duration-150 ease-out",
          active
            ? [
                "border-(--color-accent)",
                "ring-1 ring-(--color-accent)",
              ]
            : [
                "border-(--color-border-strong)",
                "group-hover:scale-[1.08] group-hover:border-(--color-fg-faint)",
              ],
        )}
      >
        {/* Wordmark — the "H_" preview, content color + brand color */}
        <span className="font-mono text-[11px] font-semibold leading-none text-(--color-fg)">
          H<span className="text-(--color-accent)">_</span>
        </span>

        {/* Active confirmation — tiny accent dot bottom-right */}
        {active && (
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0.5 right-0.5 size-1 rounded-full bg-(--color-accent)",
              "animate-[chip-pulse_1.4s_ease-in-out_infinite]",
            )}
          />
        )}
      </div>

      {/* Label below — in normal (outer) theme tokens */}
      <span
        className={cn(
          "w-full truncate text-center font-mono text-[9px] leading-tight transition-colors",
          active
            ? "font-medium text-foreground"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {p.name}
      </span>
    </button>
  );
}
