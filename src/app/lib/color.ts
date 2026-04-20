/**
 * Small, dependency-free color utility.
 *
 * Scope is deliberately narrow: the conversions we actually need for theme
 * work (hex ↔ rgb ↔ hsl), perceptual-ish mixing, WCAG contrast ratios, and
 * lighten/darken helpers. Everything operates on `#rrggbb` (6-char hex)
 * strings at the boundary so values flow cleanly in/out of CSS tokens.
 *
 * If we ever need OKLCH or other perceptual spaces, reach for `culori` —
 * the gains aren't worth hand-rolling that matrix here.
 */

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

// ─── hex ↔ rgb ──────────────────────────────────────────────────────────────

/** Parse `#rgb`, `#rrggbb`, or `#rrggbbaa` into an RGB. Alpha is dropped. */
export function hexToRgb(hex: string): RGB {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = Number.parseInt(h[0]! + h[0]!, 16);
    const g = Number.parseInt(h[1]! + h[1]!, 16);
    const b = Number.parseInt(h[2]! + h[2]!, 16);
    return { r, g, b };
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function channel(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

// ─── hex ↔ hsl ──────────────────────────────────────────────────────────────

/**
 * RGB → HSL using the standard algorithm. H in [0, 360), S and L in [0, 100].
 * Note: HSL is NOT perceptual — same numeric delta ≠ same visual delta. For
 * uniform-lightness palette work, prefer CIELAB/OKLCH with a proper library.
 */
export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: HSL): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r1, g1, b1] =
    hn < 60
      ? [c, x, 0]
      : hn < 120
        ? [x, c, 0]
        : hn < 180
          ? [0, c, x]
          : hn < 240
            ? [0, x, c]
            : hn < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex({
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  });
}

// ─── Operations ─────────────────────────────────────────────────────────────

/**
 * Linear RGB blend of two colors. `t` in [0, 1]; 0 returns `a`, 1 returns `b`.
 * Sufficient for UI tinting (hover states, mixing surfaces with accents).
 * For perceptual mixing, use CSS `color-mix(in oklab, …)` at the stylesheet
 * layer instead — it's more accurate and does the work for free.
 */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

/** Lighten by `amount` [0, 100] percentage points of L in HSL space. */
export function lighten(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ h: hsl.h, s: hsl.s, l: clamp(hsl.l + amount, 0, 100) });
}

/** Darken by `amount` [0, 100] percentage points of L in HSL space. */
export function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

/** Return an `rgba(r, g, b, a)` string; `alpha` in [0, 1]. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

// ─── WCAG contrast ──────────────────────────────────────────────────────────

/** sRGB relative luminance per WCAG 2.x — used by contrast(). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG 2.x contrast ratio between two colors. Returns a value in [1, 21].
 * Thresholds: 3.0 for non-text graphics, 4.5 for body text (AA),
 * 7.0 for enhanced text (AAA). Order-agnostic.
 */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick whichever of `light` / `dark` yields higher contrast against `bg`.
 * Handy for "readable fg on arbitrary bg" (e.g., label pills with user-
 * defined colors, like GitHub issue labels).
 */
export function pickReadableFg(
  bg: string,
  light: string = "#ffffff",
  dark: string = "#000000",
): string {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}
