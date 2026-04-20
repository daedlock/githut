import type { ReactionContent, ReactionsMap } from "@/app/features/issues/schemas";

// ─── Reactions ──────────────────────────────────────────────────────────────

export const REACTION_EMOJIS: Record<ReactionContent, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

export const REACTION_CONTENTS: ReactionContent[] = [
  "+1",
  "-1",
  "laugh",
  "hooray",
  "confused",
  "heart",
  "rocket",
  "eyes",
];

export function reactionsHaveAny(reactions: ReactionsMap): boolean {
  return REACTION_CONTENTS.some((k) => (reactions[k] ?? 0) > 0);
}

// ─── Label colors ──────────────────────────────────────────────────────────
//
// GitHub labels carry a hex color from the API (no token possible — it's
// user-authored per label). We can't route this through --color-* tokens,
// but we DO compute a readable fg from the raw hex.
//
// The two literal hex values here are strictly neutral text colors chosen to
// pair with arbitrary user-authored label fills. They are not theme surface
// colors and intentionally do NOT use tokens — token values shift between
// light/dark while this computation must stay stable regardless of app theme
// (the label fill itself is user-provided, not themed).

/** Choose either near-black or near-white text for readable contrast on a hex fill. */
export function pickTextColor(hexColor: string): "#111827" | "#f9fafb" {
  const hex = hexColor.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#111827";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.63 ? "#111827" : "#f9fafb";
}

export function labelStyle(color: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `#${color}`, color: pickTextColor(color) };
}
