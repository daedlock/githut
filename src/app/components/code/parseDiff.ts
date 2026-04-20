/**
 * Unified diff parser. Accepts the `patch` text GitHub returns on each file in
 * a PR/compare response, or any standard unified diff hunk stream.
 *
 * We intentionally parse ONLY hunks — we do not try to interpret file headers
 * (`--- a/...` / `+++ b/...`), rename markers, or "diff --git" prelude. Those
 * pieces come from the surrounding API response (filename, status, etc.) and
 * embedding them in the parser would duplicate state and make this harder to
 * test.
 *
 *   @@ -oldStart,oldLines +newStart,newLines @@ [optional section header]
 *    context line                                  (prefix: space)
 *   -removed line                                  (prefix: -)
 *   +added line                                    (prefix: +)
 *   \ No newline at end of file                    (ignored)
 */

export type DiffLineKind = "context" | "add" | "del";

export type DiffLine = {
  kind: DiffLineKind;
  /** 1-indexed line in the OLD file. undefined for pure adds. */
  oldNum?: number;
  /** 1-indexed line in the NEW file. undefined for pure deletes. */
  newNum?: number;
  /** Line content with the diff prefix already stripped. */
  content: string;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Optional section header, e.g. the function name git pulls from context. */
  header: string;
  lines: DiffLine[];
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parseUnifiedDiff(patch: string | null | undefined): DiffHunk[] {
  if (!patch) return [];
  const rawLines = patch.split("\n");
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldCursor = 0;
  let newCursor = 0;

  for (const raw of rawLines) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      current = {
        oldStart: Number(header[1]),
        oldLines: header[2] ? Number(header[2]) : 1,
        newStart: Number(header[3]),
        newLines: header[4] ? Number(header[4]) : 1,
        header: (header[5] ?? "").trim(),
        lines: [],
      };
      oldCursor = current.oldStart;
      newCursor = current.newStart;
      hunks.push(current);
      continue;
    }
    if (!current) continue;

    // `\ No newline at end of file` is metadata, not content
    if (raw.startsWith("\\")) continue;

    const prefix = raw.charAt(0);
    const content = raw.slice(1);

    if (prefix === "+") {
      current.lines.push({ kind: "add", newNum: newCursor, content });
      newCursor++;
    } else if (prefix === "-") {
      current.lines.push({ kind: "del", oldNum: oldCursor, content });
      oldCursor++;
    } else if (prefix === " " || raw === "") {
      // Empty rawLines arise when the patch ends without a trailing newline;
      // treat as empty context so line pairing downstream stays aligned.
      current.lines.push({ kind: "context", oldNum: oldCursor, newNum: newCursor, content });
      oldCursor++;
      newCursor++;
    }
  }

  return hunks;
}

/** Sum of `+` / `-` lines across all hunks — useful for file headers. */
export function countChanges(hunks: DiffHunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.kind === "add") additions++;
      else if (l.kind === "del") deletions++;
    }
  }
  return { additions, deletions };
}
