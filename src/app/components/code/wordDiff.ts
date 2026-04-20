/**
 * Word-level intra-line diff.
 *
 * Given two strings (e.g., paired -/+ lines in a hunk), produce segment lists
 * that tell the renderer which character ranges changed. We tokenize into
 * "words" (a run of word-chars, or a single punctuation/whitespace char) so
 * changes land on human-meaningful units, not individual letters.
 *
 * Algorithm: classic LCS dynamic-programming on the token arrays. O(n*m) — more
 * than fast enough for a single line (typically <200 tokens). Using Myers would
 * save memory on huge lines but the code stays simpler this way.
 *
 * Output shape gives each SIDE (old/new) its own segment list, with ranges
 * in original-string offsets so the renderer can overlay word-highlight spans
 * without re-tokenizing.
 */

export type WordSegment = {
  start: number;
  end: number;
  kind: "same" | "changed";
};

export type WordDiffResult = {
  /** Segments over the OLD line string. `changed` = this text only exists on the left. */
  oldSegments: WordSegment[];
  /** Segments over the NEW line string. `changed` = this text only exists on the right. */
  newSegments: WordSegment[];
};

// Word tokenizer: keep each contiguous alphanumeric run as one token; every
// other single char is its own token. Tracks each token's start offset so we
// can map back to string positions after the diff.
type Tok = { text: string; start: number };
const WORD_RE = /[A-Za-z0-9_$]+|[\s\S]/gu;

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  m = WORD_RE.exec(s);
  while (m !== null) {
    toks.push({ text: m[0], start: m.index });
    m = WORD_RE.exec(s);
  }
  return toks;
}

export function wordDiff(oldLine: string, newLine: string): WordDiffResult {
  // Trivial cases — skip the DP
  if (oldLine === newLine) {
    return {
      oldSegments: [{ start: 0, end: oldLine.length, kind: "same" }],
      newSegments: [{ start: 0, end: newLine.length, kind: "same" }],
    };
  }

  const a = tokenize(oldLine);
  const b = tokenize(newLine);
  const m = a.length;
  const n = b.length;

  // LCS table — dp[i][j] = LCS length of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const row = dp[i];
      if (!row) continue;
      const equal = a[i]?.text === b[j]?.text;
      row[j] = equal
        ? (dp[i + 1]?.[j + 1] ?? 0) + 1
        : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
    }
  }

  // Walk the edit script to build segments
  const oldSegs: WordSegment[] = [];
  const newSegs: WordSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i]?.text === b[j]?.text) {
      pushSegment(oldSegs, a[i]!.start, a[i]!.start + a[i]!.text.length, "same");
      pushSegment(newSegs, b[j]!.start, b[j]!.start + b[j]!.text.length, "same");
      i++;
      j++;
    } else if (j >= n || (i < m && (dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0))) {
      pushSegment(oldSegs, a[i]!.start, a[i]!.start + a[i]!.text.length, "changed");
      i++;
    } else {
      pushSegment(newSegs, b[j]!.start, b[j]!.start + b[j]!.text.length, "changed");
      j++;
    }
  }

  // If either side ended up empty (e.g., one line was empty string), emit a
  // sentinel same-segment at [0,0] so downstream code doesn't have to null-check.
  if (oldSegs.length === 0) oldSegs.push({ start: 0, end: oldLine.length, kind: "same" });
  if (newSegs.length === 0) newSegs.push({ start: 0, end: newLine.length, kind: "same" });

  return { oldSegments: oldSegs, newSegments: newSegs };
}

// Merge consecutive segments of the same kind that touch — keeps the segment
// list short and makes the renderer emit fewer spans.
function pushSegment(segs: WordSegment[], start: number, end: number, kind: WordSegment["kind"]) {
  const last = segs[segs.length - 1];
  if (last && last.kind === kind && last.end === start) {
    last.end = end;
  } else {
    segs.push({ start, end, kind });
  }
}

/**
 * Pair up consecutive -/+ blocks in a hunk so we know which line maps to which
 * for word-diffing. Typical hunk pattern:
 *
 *   context
 *   del  del  del
 *   add  add  add
 *   context
 *
 * Lines within a -/+ pair at the same block-local index are word-diffed.
 * Extra lines on the longer side have no pair — renderer shows them as
 * solid-highlighted without intra-line emphasis.
 */
export function computeLinePairs(
  lines: Array<{ kind: "context" | "add" | "del" }>,
): Map<number, number> {
  const pairs = new Map<number, number>();
  let delStart = -1;
  let delCount = 0;
  let addStart = -1;
  let addCount = 0;

  const flush = () => {
    if (delCount > 0 && addCount > 0) {
      const pairCount = Math.min(delCount, addCount);
      for (let k = 0; k < pairCount; k++) {
        pairs.set(delStart + k, addStart + k);
      }
    }
    delStart = -1;
    delCount = 0;
    addStart = -1;
    addCount = 0;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    if (!l) continue;
    if (l.kind === "del") {
      if (addCount > 0) flush();
      if (delCount === 0) delStart = idx;
      delCount++;
    } else if (l.kind === "add") {
      if (addCount === 0) addStart = idx;
      addCount++;
    } else {
      flush();
    }
  }
  flush();
  return pairs;
}
