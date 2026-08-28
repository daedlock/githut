import { useRef } from "react";
import { cn } from "@/app/lib/cn";
import { PALETTE_FAMILIES, type Palette, resolvePaletteDataTheme } from "@/app/lib/themeCatalog";
import { useResolvedTheme, useThemeStore } from "@/app/stores/theme";

/**
 * Palette picker — theme-family chips in a 6-column grid, each rendered in its own
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

const PALETTES: readonly PaletteDef[] = PALETTE_FAMILIES;

const COLS = 6;

export function ThemePalettePicker() {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);
  const groupRef = useRef<HTMLFieldSetElement>(null);

  const focusIdx = (idx: number) => {
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>("[aria-pressed]");
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

  const selectedPalette = PALETTES.find((p) => p.id === palette)?.name;

  return (
    <div>
      <div id="palette-heading" className="mb-2 flex items-center justify-between text-caption">
        <span className="font-medium text-foreground">Palette</span>
        <span className="font-mono text-micro italic text-muted-foreground">{selectedPalette}</span>
      </div>

      <fieldset
        ref={groupRef}
        aria-labelledby="palette-heading"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-6 gap-1.5"
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
      </fieldset>
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
  const chipTheme =
    resolvePaletteDataTheme(p.id, resolved) ?? (resolved === "dark" ? "stone-dark" : "stone");

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${p.name} palette`}
      title={p.name}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "group rounded-md p-0.5",
        "outline-none",
        "focus-visible:bg-background",
        "animate-[chip-in_200ms_ease-out_backwards]",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        data-theme={chipTheme}
        className={cn(
          "relative flex h-8 w-full items-center justify-center overflow-hidden rounded-md",
          "bg-(--color-bg) ring-1 transition-[transform,box-shadow] duration-150 ease-out",
          active
            ? ["ring-2 ring-border-strong"]
            : [
                "ring-(--color-border-strong)",
                "group-hover:scale-105 group-hover:ring-(--color-fg-faint)",
              ],
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-(--color-brand)" aria-hidden />
        <span
          className="absolute bottom-1.5 left-1.5 size-2 rounded-full bg-(--color-fg)"
          aria-hidden
        />
        <span
          className="absolute right-1.5 bottom-1.5 h-2 w-4 rounded-full bg-(--color-bg-subtle) ring-1 ring-(--color-border)"
          aria-hidden
        />

        {active && (
          <span
            aria-hidden
            className={cn(
              "absolute right-1 top-1 size-1.5 rounded-full bg-(--color-fg)",
              "animate-[chip-pulse_1.4s_ease-in-out_infinite]",
            )}
          />
        )}
      </div>
    </button>
  );
}
