#!/usr/bin/env bun
/**
 * Design lint: enforces the rules in DESIGN.md that a regex can see.
 *
 *   bun run lint:design            fail if any file has more violations than
 *                                  the baseline (new files must be clean)
 *   bun run lint:design --report   list every remaining violation
 *   bun run lint:design --update   rewrite the baseline (do this only when a
 *                                  change *removes* violations)
 *
 * The baseline is a ratchet: it records today's debt per file and rule, CI
 * fails if any count grows, and each design phase lowers it toward zero.
 * Silence a deliberate exception with a `design-lint-ignore` comment on the
 * same line or the line above, saying why.
 */
import { Glob } from "bun";

type Rule = {
  id: string;
  pattern: RegExp;
  message: string;
  /** Skip files whose path matches (e.g. shadcn primitives that own a style). */
  skip?: RegExp;
  /** Extra check on a match; return false to ignore it. */
  accept?: (source: string, index: number) => boolean;
};

const UI_PRIMITIVES = /src\/app\/components\/ui\/[a-z-]+\.tsx$/;

/** True when the nearest opening JSX tag before `index` is a button. */
function inButtonTag(source: string, index: number) {
  const open = source.lastIndexOf("<", index);
  if (open < 0 || source.lastIndexOf(">", index) > open) return false;
  const tag = /^<([A-Za-z.]+)/.exec(source.slice(open))?.[1] ?? "";
  return /^(button|Button|IconBtn|InputGroupButton)$/.test(tag);
}

const RULES: Rule[] = [
  {
    id: "type-scale",
    pattern: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
    message: "Use the type scale: text-micro/caption/ui/code/body/body-lg/title/heading/display",
  },
  {
    id: "pixel-font-size",
    pattern: /\btext-\[\d+(?:\.\d+)?px\]/g,
    message: "No pixel font sizes; use the type scale",
  },
  {
    id: "native-select",
    pattern: /<select[\s>]/g,
    message: "Use ui/select instead of a native <select>",
  },
  {
    id: "native-checkbox",
    pattern: /type=["']checkbox["']/g,
    message: "Use ui/checkbox instead of a native checkbox",
  },
  {
    id: "cursor-utility",
    pattern: /\bcursor-pointer\b/g,
    message: "base.css owns cursors (arrow on controls, hand on text links)",
  },
  {
    id: "space-utility",
    pattern: /\bspace-[xy]-/g,
    message: "Use flex + gap-* instead of space-x/y-*",
  },
  {
    id: "raw-semantic-token",
    pattern:
      /\b(?:bg|text|border|ring|divide)-(?:\[var\(|\()--color-(?:bg|bg-subtle|bg-sunken|fg|fg-muted|border|danger)\)\]?/g,
    message:
      "Use the semantic class: bg-background/bg-muted/bg-accent, text-foreground/text-muted-foreground, border-border, text-destructive",
  },
  {
    id: "brand-fill",
    // A primary button's own hover tint (hover:bg-primary/85) is not a fill.
    pattern: /(?<!hover:)\b(?:bg-primary\/\d+|ring-primary\/\d+|border-l-primary)\b/g,
    message: "Never use the brand color as a fill or stripe; selected is bg-accent",
  },
  {
    id: "brand-focus-ring",
    pattern:
      /focus(?:-visible)?:ring-(?:primary|ring|\(--color-focus\)|\[var\(--color-focus\)\])(?![\w/-])/g,
    message: "Custom controls focus with ring-1 ring-foreground/15; primitives own theirs",
    skip: UI_PRIMITIVES,
  },
  {
    id: "title-tooltip",
    pattern: /\btitle=[{"'`]/g,
    message: "Use Tooltip (ShortcutHint for shortcuts), not title=, on buttons",
    accept: inButtonTag,
  },
  {
    id: "unguarded-animation",
    pattern: /(?<![\w-]:)\banimate-(?:pulse|ping|bounce)\b/g,
    message: "Guard decorative animation with motion-safe:",
    skip: UI_PRIMITIVES,
  },
  {
    id: "in-flow-shadow",
    pattern: /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/g,
    message:
      "Shadows belong to overlays; if this is one, add a design-lint-ignore comment saying so",
    skip: UI_PRIMITIVES,
  },
  {
    id: "raw-color",
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
    message: "No raw colors; use tokens",
  },
  {
    id: "arbitrary-radius",
    pattern: /\brounded(?:-[a-z]{1,2})?-\[\d/g,
    message: "Use the radius scale (rounded-sm/md/lg/xl/full)",
  },
  {
    id: "z-index",
    pattern: /\bz-(?:\[\d+\]|0|60|70|80|90|100)\b/g,
    message: "Use the z-index scale: z-10 / 20 / 30 / 40 / 50",
  },
];

type Violation = { file: string; line: number; rule: string; text: string };
type Counts = Record<string, Record<string, number>>;

const BASELINE = "scripts/design-lint-baseline.json";

function ignored(lines: string[], line: number) {
  return (
    lines[line]?.includes("design-lint-ignore") || lines[line - 1]?.includes("design-lint-ignore")
  );
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  for await (const file of new Glob("src/app/**/*.{ts,tsx}").scan(".")) {
    if (file.endsWith(".test.ts") || file.endsWith("routeTree.gen.ts")) continue;
    const source = await Bun.file(file).text();
    const lines = source.split("\n");
    const lineStarts = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
    const lineOf = (index: number) => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid]! <= index) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    for (const rule of RULES) {
      if (rule.skip?.test(file)) continue;
      for (const match of source.matchAll(rule.pattern)) {
        const index = match.index ?? 0;
        if (rule.accept && !rule.accept(source, index)) continue;
        const line = lineOf(index);
        if (ignored(lines, line)) continue;
        violations.push({ file, line: line + 1, rule: rule.id, text: match[0] });
      }
    }
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function count(violations: Violation[]): Counts {
  const counts: Counts = {};
  for (const v of violations) {
    counts[v.file] ??= {};
    counts[v.file]![v.rule] = (counts[v.file]![v.rule] ?? 0) + 1;
  }
  return counts;
}

const args = new Set(process.argv.slice(2));
const violations = await scan();
const counts = count(violations);
const messages = new Map(RULES.map((rule) => [rule.id, rule.message]));

if (args.has("--update")) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  await Bun.write(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `Baseline updated: ${violations.length} violations in ${Object.keys(counts).length} files.`,
  );
  process.exit(0);
}

if (args.has("--report")) {
  for (const v of violations) console.log(`${v.file}:${v.line}  ${v.rule}  ${v.text}`);
  const byRule = new Map<string, number>();
  for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
  console.log("\nBy rule:");
  for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${rule}: ${n}`);
  console.log(`\n${violations.length} violations in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

const baselineFile = Bun.file(BASELINE);
const baseline: Counts = (await baselineFile.exists()) ? await baselineFile.json() : {};
const regressions: Violation[] = [];
for (const [file, rules] of Object.entries(counts)) {
  for (const [rule, n] of Object.entries(rules)) {
    if (n > (baseline[file]?.[rule] ?? 0)) {
      regressions.push(...violations.filter((v) => v.file === file && v.rule === rule));
    }
  }
}

if (regressions.length) {
  console.error("Design lint: these files gained violations (see DESIGN.md):\n");
  for (const v of regressions) {
    console.error(`  ${v.file}:${v.line}  ${v.rule}  ${v.text}\n    → ${messages.get(v.rule)}`);
  }
  process.exit(1);
}

const remaining = violations.length;
const baselineTotal = Object.values(baseline).reduce(
  (sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0),
  0,
);
console.log(
  `Design lint passed. ${remaining} known violations remain${
    remaining < baselineTotal ? ` (down from ${baselineTotal}; run --update to lock that in)` : ""
  }.`,
);
