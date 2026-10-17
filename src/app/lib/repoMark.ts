// ─── Repo marks ────────────────────────────────────────────────────────────
//
// A repo mark is the small rounded square, with the repo's initial, that tells
// you which repo a tab, sidebar row or link belongs to (GLOSSARY → Repo mark).
//
// Colour: the repo's full name hashes onto a curated set of hues. They share
// one lightness and chroma (`--repo-l` / `--repo-c`, per light/dark), and skip
// the status hues — green ~145, red ~25, amber ~85, purple ~295 — so a mark
// never reads as "passing" or "closed".
//
// Letter: the repo name's first letter, extended to two letters when another
// repo in view would show the same one.

const REPO_HUES = [60, 110, 175, 200, 230, 255, 330, 355] as const;

/** FNV-1a — tiny, stable across sessions and devices. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hue for a repo, from its case-insensitive `owner/name`. */
export function repoHue(fullName: string): number {
  return REPO_HUES[hash(fullName.toLowerCase()) % REPO_HUES.length]!;
}

function repoName(fullName: string): string {
  return fullName.split("/")[1] ?? fullName;
}

function initial(name: string): string {
  return (name.match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
}

/** Two-letter form: initial + the next word's initial, else the next letter. */
function twoLetters(name: string): string {
  const words = name.split(/[-_.\s]+/).filter(Boolean);
  const second = words[1]?.match(/[a-z0-9]/i)?.[0] ?? name.replace(/[^a-z0-9]/gi, "")[1] ?? "";
  return `${initial(name)}${second.toLowerCase()}`;
}

/**
 * The letter(s) each repo shows, given every repo currently in view. Repos
 * whose initials collide get two letters; everyone else keeps one.
 */
export function repoMarkLetters(fullNames: Iterable<string>): Map<string, string> {
  const unique = [...new Set([...fullNames].map((n) => n.toLowerCase()))];
  const byInitial = new Map<string, number>();
  for (const n of unique) {
    const i = initial(repoName(n));
    byInitial.set(i, (byInitial.get(i) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const n of unique) {
    const name = repoName(n);
    out.set(n, (byInitial.get(initial(name)) ?? 0) > 1 ? twoLetters(name) : initial(name));
  }
  return out;
}

export function repoMarkLetter(fullName: string, inView: Iterable<string>): string {
  const key = fullName.toLowerCase();
  return repoMarkLetters([...inView, key]).get(key) ?? initial(repoName(fullName));
}
