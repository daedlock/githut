import { MessageSquarePlus } from "lucide-react";
import { Fragment, memo, useMemo, type ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import { Skeleton } from "@/app/components/ui/skeleton";
import { countChanges, type DiffHunk, type DiffLine, parseUnifiedDiff } from "./parseDiff";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "./types";
import type { CodeLine, CodeLineWithHtml, CodeToken } from "./types";
import { useCodeTokens } from "./useCodeTokens";
import { computeLinePairs, wordDiff, type WordSegment } from "./wordDiff";

// ── Component ────────────────────────────────────────────────────────────────

export type DiffMode = "unified" | "split";

/**
 * Optional review affordances. When provided, each unified-mode row shows a
 * hover "+" button that fires `onAddComment`; `renderLineTrailer` is called
 * once per rendered row and its return value is mounted directly below —
 * used to inline existing review threads and the active composer.
 * Split mode intentionally opts out; matches GitHub's own behavior.
 */
export type DiffReviewHooks = {
  onAddComment?: (args: { side: "LEFT" | "RIGHT"; line: number }) => void;
  renderLineTrailer?: (args: {
    side: "LEFT" | "RIGHT";
    line: number;
  }) => ReactNode;
};

export type DiffViewProps = {
  /** The unified-diff text — typically the `patch` field from GitHub's files API. */
  patch: string | null | undefined;
  /** Language hint for syntax highlighting. Omit to render plain. */
  lang?: string;
  /** "unified" stacks +/- inline; "split" is side-by-side with aligned rows. */
  mode?: DiffMode;
  className?: string;
  /** Opt-in review mode hooks. */
  review?: DiffReviewHooks;
};

export const DiffView = memo(function DiffView({
  patch,
  lang = "text",
  mode = "unified",
  className,
  review,
}: DiffViewProps) {
  const hunks = useMemo(() => parseUnifiedDiff(patch), [patch]);

  // Build the two "virtual" source files from the patch: old (context + dels)
  // and new (context + adds). We feed each to Shiki in one go so token
  // highlighting has full multi-line context (strings, block comments, etc.)
  // rather than getting each line tokenized in isolation.
  const { oldSource, newSource, oldLineMap, newLineMap } = useMemo(
    () => buildSources(hunks),
    [hunks],
  );

  const { data: oldTokens, isPending: oldPending } = useCodeTokens(oldSource, lang);
  const { data: newTokens, isPending: newPending } = useCodeTokens(newSource, lang);

  if (!patch) return null;
  if (hunks.length === 0) {
    return (
      <div className="px-4 py-6 text-center font-mono text-ui uppercase tracking-widest text-[var(--color-fg-faint)]">
        No changes to display
      </div>
    );
  }

  if (oldPending || newPending || !oldTokens || !newTokens) {
    return <DiffSkeleton />;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-[color-mix(in_oklab,var(--color-bg)_94%,var(--color-bg-sunken))]",
        className,
      )}
    >
      <div
        className={cn("overflow-x-auto text-code font-feature-settings-code @container/diff")}
        // Force the mono token inline — Tailwind's @layer utility for `font-mono`
        // loses to body's unlayered `font-family: var(--font-sans)` rule, so an
        // inline style is the only way to guarantee the code font wins. Same
        // trick CodeView uses for the same reason.
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {/*
         * Content wrapper grows to the widest row (w-max) and never shrinks
         * below the viewport (min-w-full). All children render `w-full` of
         * this wrapper, so hunk headers, diff rows, short lines, long lines
         * all share the same box width — no ragged right edge when scrolled.
         * Split mode uses `w-full` so the 50/50 grid stays within viewport.
         */}
        <div className={mode === "split" ? "w-full" : "w-max min-w-full"}>
          {hunks.map((hunk, hIdx) => (
            <Fragment key={hIdx}>
              {hIdx > 0 && <div className="h-px bg-border" />}
              <HunkHeader hunk={hunk} />
              {mode === "unified" ? (
                <UnifiedHunk
                  hunk={hunk}
                  oldTokens={oldTokens}
                  newTokens={newTokens}
                  oldLineMap={oldLineMap}
                  newLineMap={newLineMap}
                  review={review}
                />
              ) : (
                <SplitHunk
                  hunk={hunk}
                  oldTokens={oldTokens}
                  newTokens={newTokens}
                  oldLineMap={oldLineMap}
                  newLineMap={newLineMap}
                />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Exports for composition ─────────────────────────────────────────────────

export { countChanges, parseUnifiedDiff };
export type { DiffHunk, DiffLine };

// ── Hunk header ─────────────────────────────────────────────────────────────

const HunkHeader = memo(function HunkHeader({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="flex items-center gap-3 border-y border-[var(--color-border)] bg-[var(--diff-hunk-bg)] px-4 py-0.5">
      <span className="font-mono text-micro tabular-nums text-[var(--diff-hunk-fg)]">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </span>
      {hunk.header && (
        <span className="truncate text-micro text-[var(--color-fg-faint)]">{hunk.header}</span>
      )}
    </div>
  );
});

// ── Unified view ────────────────────────────────────────────────────────────

const UnifiedHunk = memo(function UnifiedHunk({
  hunk,
  oldTokens,
  newTokens,
  oldLineMap,
  newLineMap,
  review,
}: {
  hunk: DiffHunk;
  oldTokens: CodeLineWithHtml[];
  newTokens: CodeLineWithHtml[];
  oldLineMap: Map<number, number>;
  newLineMap: Map<number, number>;
  review?: DiffReviewHooks;
}) {
  const pairs = useMemo(() => computeLinePairs(hunk.lines), [hunk]);
  const inversePairs = useMemo(() => {
    const inv = new Map<number, number>();
    for (const [d, a] of pairs) inv.set(a, d);
    return inv;
  }, [pairs]);

  // Pre-compute word diffs for each paired line
  const wordDiffs = useMemo(() => {
    const map = new Map<number, { oldSegs: WordSegment[]; newSegs: WordSegment[] }>();
    for (const [delIdx, addIdx] of pairs) {
      const delLine = hunk.lines[delIdx];
      const addLine = hunk.lines[addIdx];
      if (!delLine || !addLine) continue;
      const { oldSegments, newSegments } = wordDiff(delLine.content, addLine.content);
      map.set(delIdx, { oldSegs: oldSegments, newSegs: [] });
      map.set(addIdx, { oldSegs: [], newSegs: newSegments });
    }
    return map;
  }, [hunk, pairs]);

  return (
    <div>
      {hunk.lines.map((line, idx) => {
        const emphasis = wordDiffs.get(idx);
        const segments =
          line.kind === "del"
            ? emphasis?.oldSegs
            : line.kind === "add"
              ? emphasis?.newSegs
              : undefined;
        const tokens =
          line.kind === "del"
            ? tokensForOld(line, oldTokens, oldLineMap)
            : tokensForNew(line, newTokens, newLineMap);
        // Un-paired add/del: don't show word emphasis (would be misleading)
        const showEmphasis =
          segments != null && (line.kind === "del" ? pairs.has(idx) : inversePairs.has(idx));

        // Which side + line the trailer / comment affordance anchors to.
        // Deletions live on LEFT; additions and context on RIGHT (GitHub's
        // convention for anchoring inline threads).
        const side: "LEFT" | "RIGHT" = line.kind === "del" ? "LEFT" : "RIGHT";
        const lineNum = side === "LEFT" ? line.oldNum : line.newNum;
        const trailer =
          lineNum != null && review?.renderLineTrailer
            ? review.renderLineTrailer({ side, line: lineNum })
            : null;
        return (
          <Fragment key={idx}>
            <DiffRow
              kind={line.kind}
              oldNum={line.oldNum}
              newNum={line.newNum}
              tokens={tokens}
              rawText={line.content}
              emphasis={showEmphasis ? segments : undefined}
              onAddComment={review?.onAddComment}
              commentSide={lineNum != null ? side : undefined}
              commentLine={lineNum}
            />
            {trailer}
          </Fragment>
        );
      })}
    </div>
  );
});

const DiffRow = memo(function DiffRow({
  kind,
  oldNum,
  newNum,
  tokens,
  rawText,
  emphasis,
  onAddComment,
  commentSide,
  commentLine,
}: {
  kind: DiffLine["kind"];
  oldNum?: number;
  newNum?: number;
  tokens: CodeLineWithHtml;
  rawText: string;
  emphasis?: WordSegment[];
  onAddComment?: DiffReviewHooks["onAddComment"];
  commentSide?: "LEFT" | "RIGHT";
  commentLine?: number;
}) {
  const lineClass = kind === "add" ? "diff-line-add" : kind === "del" ? "diff-line-del" : undefined;
  const canComment = !!onAddComment && commentSide != null && commentLine != null;
  return (
    <div className={cn("group relative flex w-full items-stretch", lineClass)}>
      {canComment && (
        <button
          type="button"
          onClick={() => onAddComment!({ side: commentSide!, line: commentLine! })}
          aria-label="Add a comment on this line"
          className={cn(
            "absolute left-0 top-0 z-10 inline-flex size-5 items-center justify-center",
            "rounded-sm bg-primary text-primary-foreground opacity-0",
            "transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
            "outline-none shadow-sm",
          )}
        >
          <MessageSquarePlus className="size-3" aria-hidden />
        </button>
      )}
      <div className="diff-gutter flex flex-shrink-0 select-none font-mono tabular-nums text-[var(--color-fg-faint)]">
        <span className="w-10 px-1 text-right">{oldNum ?? ""}</span>
        <span className="w-10 px-1 text-right">{newNum ?? ""}</span>
      </div>
      <span
        className={cn(
          "w-5 flex-shrink-0 select-none text-center",
          kind === "add" && "text-[var(--diff-add-marker)]",
          kind === "del" && "text-[var(--diff-del-marker)]",
          kind === "context" && "text-[var(--color-fg-faint)] opacity-60",
        )}
      >
        {kind === "add" ? "+" : kind === "del" ? "−" : " "}
      </span>
      {/*
       * Long lines: parent column is `overflow-x-auto`, so content here is
       * just `whitespace-pre` with no per-line overflow. One horizontal
       * scrollbar at the bottom of the whole file, not one per line.
       */}
      <span className="whitespace-pre pr-3">
        <RenderedLine tokens={tokens} rawText={rawText} emphasis={emphasis} />
      </span>
    </div>
  );
});

// ── Split view ──────────────────────────────────────────────────────────────

const SplitHunk = memo(function SplitHunk({
  hunk,
  oldTokens,
  newTokens,
  oldLineMap,
  newLineMap,
}: {
  hunk: DiffHunk;
  oldTokens: CodeLineWithHtml[];
  newTokens: CodeLineWithHtml[];
  oldLineMap: Map<number, number>;
  newLineMap: Map<number, number>;
}) {
  // Build paired rows: each row has an optional left (del/context) and optional right (add/context)
  const pairs = useMemo(() => computeLinePairs(hunk.lines), [hunk]);
  const inversePairs = useMemo(() => {
    const inv = new Map<number, number>();
    for (const [d, a] of pairs) inv.set(a, d);
    return inv;
  }, [pairs]);

  const wordDiffs = useMemo(() => {
    const map = new Map<number, WordSegment[]>();
    for (const [delIdx, addIdx] of pairs) {
      const delLine = hunk.lines[delIdx];
      const addLine = hunk.lines[addIdx];
      if (!delLine || !addLine) continue;
      const { oldSegments, newSegments } = wordDiff(delLine.content, addLine.content);
      map.set(delIdx, oldSegments);
      map.set(addIdx, newSegments);
    }
    return map;
  }, [hunk, pairs]);

  type SplitRow = {
    left?: { idx: number; line: DiffLine };
    right?: { idx: number; line: DiffLine };
  };
  const rows = useMemo<SplitRow[]>(() => {
    const out: SplitRow[] = [];
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];
      if (!line) {
        i++;
        continue;
      }

      if (line.kind === "context") {
        out.push({ left: { idx: i, line }, right: { idx: i, line } });
        i++;
        continue;
      }

      // Collect consecutive del/add block
      const delStart = i;
      while (i < hunk.lines.length && hunk.lines[i]?.kind === "del") i++;
      const delEnd = i;
      while (i < hunk.lines.length && hunk.lines[i]?.kind === "add") i++;
      const addEnd = i;

      const delCount = delEnd - delStart;
      const addCount = addEnd - delEnd;
      const max = Math.max(delCount, addCount);

      for (let k = 0; k < max; k++) {
        const leftIdx = delStart + k;
        const rightIdx = delEnd + k;
        const leftLine = k < delCount ? hunk.lines[leftIdx] : undefined;
        const rightLine = k < addCount ? hunk.lines[rightIdx] : undefined;
        out.push({
          left: leftLine ? { idx: leftIdx, line: leftLine } : undefined,
          right: rightLine ? { idx: rightIdx, line: rightLine } : undefined,
        });
      }
    }
    return out;
  }, [hunk]);

  return (
    // `min-w-0` on grid children is the key: it lets each column shrink to its
    // share (50%) so overflow-x-auto can actually compute a scrollable overflow
    // instead of the column growing to fit content and pushing the grid wider.
    <div className="grid grid-cols-2 divide-x divide-border">
      <div className="min-w-0 overflow-x-auto">
        {/* Same w-max/min-w-full pattern as unified mode — all rows in this
            column share the widest-row width so bg tints don't stop mid-row
            when the column is scrolled. */}
        <div className="w-max min-w-full">
          {rows.map((row, rIdx) => {
            if (!row.left) return <SplitPadRow key={`l-${rIdx}`} />;
            const { idx, line } = row.left;
            const tokens = tokensForOld(line, oldTokens, oldLineMap);
            const emphasis = line.kind === "del" && pairs.has(idx) ? wordDiffs.get(idx) : undefined;
            return (
              <SplitRow
                key={`l-${rIdx}`}
                side="old"
                kind={line.kind}
                num={line.oldNum}
                tokens={tokens}
                rawText={line.content}
                emphasis={emphasis}
              />
            );
          })}
        </div>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <div className="w-max min-w-full">
          {rows.map((row, rIdx) => {
            if (!row.right) return <SplitPadRow key={`r-${rIdx}`} />;
            const { idx, line } = row.right;
            const tokens = tokensForNew(line, newTokens, newLineMap);
            const emphasis =
              line.kind === "add" && inversePairs.has(idx) ? wordDiffs.get(idx) : undefined;
            return (
              <SplitRow
                key={`r-${rIdx}`}
                side="new"
                kind={line.kind}
                num={line.newNum}
                tokens={tokens}
                rawText={line.content}
                emphasis={emphasis}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

const SplitRow = memo(function SplitRow({
  kind,
  num,
  tokens,
  rawText,
  emphasis,
}: {
  side: "old" | "new";
  kind: DiffLine["kind"];
  num?: number;
  tokens: CodeLineWithHtml;
  rawText: string;
  emphasis?: WordSegment[];
}) {
  const lineClass = kind === "add" ? "diff-line-add" : kind === "del" ? "diff-line-del" : undefined;
  return (
    <div className={cn("flex w-full items-stretch", lineClass)}>
      <span className="diff-gutter w-10 flex-shrink-0 select-none px-1 text-right font-mono tabular-nums text-[var(--color-fg-faint)]">
        {num ?? ""}
      </span>
      <span
        className={cn(
          "w-5 flex-shrink-0 select-none text-center",
          kind === "add" && "text-[var(--diff-add-marker)]",
          kind === "del" && "text-[var(--diff-del-marker)]",
          kind === "context" && "text-[var(--color-fg-faint)] opacity-60",
        )}
      >
        {kind === "add" ? "+" : kind === "del" ? "−" : " "}
      </span>
      {/* Per-line overflow would create one scrollbar per row — ugly. The
          parent column carries `overflow-x-auto` so one scrollbar per side
          handles all the long lines below it. */}
      <span className="whitespace-pre pr-3">
        <RenderedLine tokens={tokens} rawText={rawText} emphasis={emphasis} />
      </span>
    </div>
  );
});

function SplitPadRow() {
  // Empty counterpart on the other side of a split — tinted with bg-subtle so
  // the viewer reads the asymmetry at a glance. No gutter digit, no marker.
  return (
    <div className="flex h-[20px] items-stretch bg-muted/60">
      <span className="w-10 flex-shrink-0" />
      <span className="w-5 flex-shrink-0" />
      <span className="flex-1" />
    </div>
  );
}

// ── Line renderer: Shiki tokens with optional word-level emphasis overlay ──

const RenderedLine = memo(function RenderedLine({
  tokens,
  rawText,
  emphasis,
}: {
  tokens: CodeLineWithHtml;
  rawText: string;
  emphasis?: WordSegment[];
}) {
  // Fast path: no emphasis → inject pre-built HTML string. This avoids
  // creating React elements per token (the #1 perf bottleneck for large
  // diffs). A 200-line file goes from ~1000 React elements to ~200.
  if (!emphasis || emphasis.length === 0) {
    // eslint-disable-next-line react/no-danger
    return <span dangerouslySetInnerHTML={{ __html: tokens.html }} />;
  }

  // Emphasis path: walk tokens AND segments together, splitting tokens at
  // segment boundaries so we can add `.diff-word` to the exact changed ranges.
  const pieces = buildEmphasizedPieces(tokens.tokens, rawText, emphasis);
  return (
    <>
      {pieces.map((p, i) => (
        <TokenSpan key={i} token={p.token} emphasis={p.emphasis} />
      ))}
    </>
  );
});

function TokenSpan({ token, emphasis }: { token: CodeToken; emphasis?: boolean }) {
  return (
    <span
      className={cn("code-token", emphasis && "diff-word")}
      style={{ color: token.color, ...fontStyleToCSS(token.fontStyle) }}
    >
      {token.content}
    </span>
  );
}

const EMPTY_STYLE: React.CSSProperties = {};
const FONT_STYLE_CACHE = new Map<number, React.CSSProperties>();

function fontStyleToCSS(fs: number | undefined): React.CSSProperties {
  if (!fs || fs <= 0) return EMPTY_STYLE;
  let cached = FONT_STYLE_CACHE.get(fs);
  if (cached) return cached;
  cached = {
    fontStyle: fs & FS_ITALIC ? "italic" : undefined,
    fontWeight: fs & FS_BOLD ? "bold" : undefined,
    textDecoration:
      [fs & FS_UNDERLINE ? "underline" : "", fs & FS_STRIKETHROUGH ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  FONT_STYLE_CACHE.set(fs, cached);
  return cached;
}

// Split tokens at word-diff segment boundaries so we can apply `.diff-word`
// to the exact char ranges without losing syntax highlighting.
function buildEmphasizedPieces(
  tokens: CodeLine,
  rawText: string,
  segments: WordSegment[],
): Array<{ token: CodeToken; emphasis: boolean }> {
  // Build a flat list of "cut points" — every position where emphasis state changes
  const cuts = new Set<number>([0, rawText.length]);
  for (const s of segments) {
    if (s.kind === "changed") {
      cuts.add(s.start);
      cuts.add(s.end);
    }
  }

  const pieces: Array<{ token: CodeToken; emphasis: boolean }> = [];
  let charPos = 0;

  for (const token of tokens) {
    const tokStart = charPos;
    const tokEnd = charPos + token.content.length;

    // Collect cuts inside this token
    const localCuts = [...cuts].filter((c) => c > tokStart && c < tokEnd).sort((a, b) => a - b);
    const bounds = [tokStart, ...localCuts, tokEnd];

    for (let i = 0; i < bounds.length - 1; i++) {
      const segStart = bounds[i] ?? tokStart;
      const segEnd = bounds[i + 1] ?? tokEnd;
      const mid = (segStart + segEnd) / 2;
      const isEmphasis = segments.some(
        (s) => s.kind === "changed" && s.start <= mid && s.end >= mid,
      );
      pieces.push({
        token: {
          content: token.content.slice(segStart - tokStart, segEnd - tokStart),
          color: token.color,
          fontStyle: token.fontStyle,
        },
        emphasis: isEmphasis,
      });
    }

    charPos = tokEnd;
  }

  return pieces;
}

// ── Source assembly: collapse hunks into per-side virtual files ─────────────

export function buildSources(hunks: DiffHunk[]) {
  // The trick: Shiki is a stateful lexer (string literals, block comments span
  // lines), so tokenizing line-by-line gives wrong highlighting. We reconstruct
  // a virtual "old file" that contains only the old lines of each hunk (context
  // + dels), and a "new file" for the adds. We track where each source line
  // ended up so the renderer can look up tokens by the hunk-line's old/new num.
  const oldParts: string[] = [];
  const newParts: string[] = [];
  const oldLineMap = new Map<number, number>(); // old file line num → index in oldSource lines
  const newLineMap = new Map<number, number>();

  let oldRow = 0;
  let newRow = 0;
  let lastOldEnd = 0;
  let lastNewEnd = 0;

  for (const hunk of hunks) {
    // Gap marker between hunks keeps Shiki's per-line indexing consistent —
    // any "missing" rows between hunks get filled with blank lines.
    if (hunk.oldStart > lastOldEnd + 1) {
      const gap = hunk.oldStart - lastOldEnd - 1;
      for (let k = 0; k < gap; k++) oldParts.push("");
      oldRow += gap;
    }
    if (hunk.newStart > lastNewEnd + 1) {
      const gap = hunk.newStart - lastNewEnd - 1;
      for (let k = 0; k < gap; k++) newParts.push("");
      newRow += gap;
    }

    for (const line of hunk.lines) {
      if (line.kind === "del" || line.kind === "context") {
        oldParts.push(line.content);
        if (line.oldNum != null) oldLineMap.set(line.oldNum, oldRow);
        oldRow++;
      }
      if (line.kind === "add" || line.kind === "context") {
        newParts.push(line.content);
        if (line.newNum != null) newLineMap.set(line.newNum, newRow);
        newRow++;
      }
    }

    lastOldEnd = hunk.oldStart + hunk.oldLines - 1;
    lastNewEnd = hunk.newStart + hunk.newLines - 1;
  }

  return {
    oldSource: oldParts.join("\n"),
    newSource: newParts.join("\n"),
    oldLineMap,
    newLineMap,
  };
}

function tokensForOld(line: DiffLine, oldTokens: CodeLineWithHtml[], map: Map<number, number>): CodeLineWithHtml {
  if (line.oldNum == null) return plainTokens(line.content);
  const idx = map.get(line.oldNum);
  if (idx == null) return plainTokens(line.content);
  return oldTokens[idx] ?? plainTokens(line.content);
}

function tokensForNew(line: DiffLine, newTokens: CodeLineWithHtml[], map: Map<number, number>): CodeLineWithHtml {
  if (line.newNum == null) return plainTokens(line.content);
  const idx = map.get(line.newNum);
  if (idx == null) return plainTokens(line.content);
  return newTokens[idx] ?? plainTokens(line.content);
}

function plainTokens(content: string): CodeLineWithHtml {
  return { tokens: [{ content }], html: content.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c)) };
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function DiffSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted">
      <div className="border-b border-border bg-muted px-3 py-1.5">
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="skeleton-fade flex flex-col gap-1 p-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${50 + ((i * 17) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
}
