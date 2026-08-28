import { describe, expect, test } from "bun:test";
import { resolvePaletteDataTheme, THEME_OPTIONS } from "@/app/lib/themeCatalog";

const NEW_THEME_IDS = new Set([
  "catppuccin-light",
  "catppuccin-dark",
  "solarized-light",
  "solarized-dark",
]);

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("theme catalog", () => {
  test("keeps option ids unique", () => {
    const ids = THEME_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("provides paired Catppuccin and Solarized variants", () => {
    expect(resolvePaletteDataTheme("catppuccin", "light")).toBe("catppuccin-light");
    expect(resolvePaletteDataTheme("catppuccin", "dark")).toBe("catppuccin-dark");
    expect(resolvePaletteDataTheme("solarized", "light")).toBe("solarized-light");
    expect(resolvePaletteDataTheme("solarized", "dark")).toBe("solarized-dark");
  });

  test("keeps new theme text swatches at WCAG AA contrast", () => {
    const newOptions = THEME_OPTIONS.filter((option) => NEW_THEME_IDS.has(option.id));
    expect(newOptions).toHaveLength(4);
    for (const option of newOptions) {
      const [background, foreground] = option.swatches;
      expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
