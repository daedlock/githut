import { createContext, Fragment, memo, useContext, useMemo, type ReactNode } from "react";
import { cn } from "@/app/lib/cn";
import { Skeleton } from "@/app/components/ui/skeleton";
import { countChanges, type DiffHunk, type DiffLine, parseUnifiedDiff } from "./parseDiff";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "./types";
import type { CodeLine, CodeLineWithHtml, CodeToken } from "./types";
import { useCodeTokens } from "./useCodeTokens";
import { computeLinePairs, wordDiff, type WordSegment } from "./wordDiff";

// ── Component ────────────────────────────────────────────────────────────────

export type DiffMode = "unified" | "split";

export const DiffModeContext = createContext<DiffMode>("split");
export function useDiffMode() { return useContext(DiffModeContext); }

export type DiffReviewHooks = {
  onAddComment?: (args: { side: "LEFT" | "RIGHT"; line: number }) => void;
  renderLineTrailer?: (args: { side: "LEFT" | "RIGHT"; line: number }) => ReactNode;
  hasComment?: (args: { side: "LEFT" | "RIGHT"; line: number }) => boolean;
  useComposerLine?: () => { side: "LEFT" | "RIGHT"; line: number } | null;
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

  const singleHunk = hunks.length === 1;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className={cn("overflow-x-auto bg-[var(--color-code-bg)] text-code font-feature-settings-code @container/diff")}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {mode === "split" ? (
          <div className="w-full">
            {hunks.map((hunk, hIdx) => (
              <Fragment key={hIdx}>
                {!singleHunk && (
                  <>
                    {hIdx > 0 && <div className="h-px bg-border" />}
                    <HunkHeader hunk={hunk} />
                  </>
                )}
                <SplitHunk
                  hunk={hunk}
                  oldTokens={oldTokens}
                  newTokens={newTokens}
                  oldLineMap={oldLineMap}
                  newLineMap={newLineMap}
                  review={review}
                />
              </Fragment>
            ))}
          </div>
        ) : (
          hunks.map((hunk, hIdx) => (
            <Fragment key={hIdx}>
              {!singleHunk && (
                <div className="w-max min-w-full">
                  {hIdx > 0 && <div className="h-px bg-border" />}
                  <HunkHeader hunk={hunk} />
                </div>
              )}
              <UnifiedHunk
                hunk={hunk}
                oldTokens={oldTokens}
                newTokens={newTokens}
                oldLineMap={oldLineMap}
                newLineMap={newLineMap}
                review={review}
              />
            </Fragment>
          ))
        )}
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
    <div className="flex items-center gap-3 border-y border-[var(--color-border)] bg-[var(--diff-hunk-bg)] px-4 py-1">
      <span className="font-mono text-code tabular-nums text-[var(--diff-hunk-fg)]">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </span>
      {hunk.header && (
        <span className="truncate text-code text-[var(--color-fg-faint)]">{hunk.header}</span>
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
  // Subscribe to composer for this file — 1 subscription per hunk, not per line.
  // When the composer targets a line in this hunk, we re-render so hasComment
  // returns true and renderLineTrailer creates the slot.
  review?.useComposerLine?.();

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

  // Build per-line render data
  const lineData = hunk.lines.map((line, idx) => {
    const emphasis = wordDiffs.get(idx);
    const segs =
      line.kind === "del" ? emphasis?.oldSegs : line.kind === "add" ? emphasis?.newSegs : undefined;
    const tokens =
      line.kind === "del"
        ? tokensForOld(line, oldTokens, oldLineMap)
        : tokensForNew(line, newTokens, newLineMap);
    const showEmphasis =
      segs != null && (line.kind === "del" ? pairs.has(idx) : inversePairs.has(idx));
    const side: "LEFT" | "RIGHT" = line.kind === "del" ? "LEFT" : "RIGHT";
    const lineNum = side === "LEFT" ? line.oldNum : line.newNum;
    const hasComment = lineNum != null && (review?.hasComment?.({ side, line: lineNum }) ?? false);
    const trailer =
      lineNum != null && review?.renderLineTrailer
        ? review.renderLineTrailer({ side, line: lineNum })
        : null;
    return {
      line,
      idx,
      tokens,
      segs: showEmphasis ? segs : undefined,
      side,
      lineNum,
      trailer,
      hasComment,
    };
  });

  // Segment: group consecutive code lines, break after any line with a trailer.
  // Code lines go inside w-max (horizontal scroll). Trailers sit outside
  // w-max so they take the scroll container's visible width — no overflow.
  type Seg = { rows: typeof lineData; trailer: ReactNode };
  const segments: Seg[] = [];
  let buf: typeof lineData = [];
  for (const item of lineData) {
    buf.push(item);
    if (item.trailer) {
      segments.push({ rows: buf, trailer: item.trailer });
      buf = [];
    }
  }
  if (buf.length > 0) segments.push({ rows: buf, trailer: null });

  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          <div className="w-max min-w-full">
            {seg.rows.map((r) => (
              <DiffRow
                key={r.idx}
                kind={r.line.kind}
                oldNum={r.line.oldNum}
                newNum={r.line.newNum}
                tokens={r.tokens}
                rawText={r.line.content}
                emphasis={r.segs}
                onAddComment={review?.onAddComment}
                commentSide={r.lineNum != null ? r.side : undefined}
                commentLine={r.lineNum}
                hasComment={r.hasComment}
              />
            ))}
          </div>
          {seg.trailer}
        </Fragment>
      ))}
    </>
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
  hasComment,
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
  hasComment?: boolean;
}) {
  const lineClass = kind === "add" ? "diff-line-add" : kind === "del" ? "diff-line-del" : undefined;
  const canComment = !!onAddComment && commentSide != null && commentLine != null;
  return (
    <div
      className={cn(
        "group flex w-full items-stretch",
        lineClass,
        hasComment && "diff-line-comment",
      )}
    >
      <div className="diff-gutter flex flex-shrink-0 items-center select-none font-mono tabular-nums text-[var(--color-fg-faint)]">
        <span className="w-10 px-1 text-right">{newNum ?? oldNum ?? ""}</span>
        {canComment ? (
          <button
            type="button"
            onClick={() => onAddComment!({ side: commentSide!, line: commentLine! })}
            aria-label="Add comment"
            className="flex size-[18px] items-center justify-center rounded-full bg-[var(--diff-comment-border)] text-[11px] font-semibold leading-none text-white opacity-0 transition-opacity duration-75 outline-none group-hover:opacity-100 focus-visible:opacity-100"
          >
            +
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
      </div>
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
  review,
}: {
  hunk: DiffHunk;
  oldTokens: CodeLineWithHtml[];
  newTokens: CodeLineWithHtml[];
  oldLineMap: Map<number, number>;
  newLineMap: Map<number, number>;
  review?: DiffReviewHooks;
}) {
  review?.useComposerLine?.();

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

  // Pre-compute per-row data + trailers
  const rowData = rows.map((row) => {
    const leftTokens = row.left ? tokensForOld(row.left.line, oldTokens, oldLineMap) : EMPTY_LINE;
    const rightTokens = row.right ? tokensForNew(row.right.line, newTokens, newLineMap) : EMPTY_LINE;
    const leftEmphasis = row.left && row.left.line.kind === "del" && pairs.has(row.left.idx)
      ? wordDiffs.get(row.left.idx) : undefined;
    const rightEmphasis = row.right && row.right.line.kind === "add" && inversePairs.has(row.right.idx)
      ? wordDiffs.get(row.right.idx) : undefined;
    const leftTrailer = row.left?.line.oldNum != null && review?.renderLineTrailer
      ? review.renderLineTrailer({ side: "LEFT", line: row.left.line.oldNum }) : null;
    const rightTrailer = row.right?.line.newNum != null && review?.renderLineTrailer
      ? review.renderLineTrailer({ side: "RIGHT", line: row.right.line.newNum }) : null;
    return { ...row, leftTokens, rightTokens, leftEmphasis, rightEmphasis, leftTrailer, rightTrailer };
  });

  // Segment: group rows, break after any row with a trailer.
  // Each code segment = two-column grid with flush lines.
  // Trailers sit between segments in their own grid — both sides get equal height.
  type Seg = { rows: typeof rowData; leftTrailer: ReactNode; rightTrailer: ReactNode };
  const segments: Seg[] = [];
  let buf: typeof rowData = [];
  for (const rd of rowData) {
    buf.push(rd);
    if (rd.leftTrailer || rd.rightTrailer) {
      segments.push({ rows: buf, leftTrailer: rd.leftTrailer, rightTrailer: rd.rightTrailer });
      buf = [];
    }
  }
  if (buf.length > 0) segments.push({ rows: buf, leftTrailer: null, rightTrailer: null });

  return (
    <>
      {segments.map((seg, sIdx) => (
        <Fragment key={sIdx}>
          <div className="grid grid-cols-2">
            <div className="min-w-0 overflow-hidden">
              {seg.rows.map((r, rIdx) =>
                r.left ? (
                  <SplitRow
                    key={rIdx}
                    side="old"
                    kind={r.left.line.kind}
                    num={r.left.line.oldNum}
                    tokens={r.leftTokens}
                    rawText={r.left.line.content}
                    emphasis={r.leftEmphasis}
                    onAddComment={review?.onAddComment}
                    hasComment={r.left.line.oldNum != null && (review?.hasComment?.({ side: "LEFT", line: r.left.line.oldNum }) ?? false)}
                  />
                ) : (
                  <NopArea key={rIdx} />
                ),
              )}
            </div>
            <div className="min-w-0 overflow-hidden border-l border-border">
              {seg.rows.map((r, rIdx) =>
                r.right ? (
                  <SplitRow
                    key={rIdx}
                    side="new"
                    kind={r.right.line.kind}
                    num={r.right.line.newNum}
                    tokens={r.rightTokens}
                    rawText={r.right.line.content}
                    emphasis={r.rightEmphasis}
                    onAddComment={review?.onAddComment}
                    hasComment={r.right.line.newNum != null && (review?.hasComment?.({ side: "RIGHT", line: r.right.line.newNum }) ?? false)}
                  />
                ) : (
                  <NopArea key={rIdx} />
                ),
              )}
            </div>
          </div>
          {(seg.leftTrailer || seg.rightTrailer) && (
            <div className="grid grid-cols-2">
              <div className="min-w-0">{seg.leftTrailer ?? <div className="diff-split-spacer" />}</div>
              <div className="min-w-0 border-l border-border">{seg.rightTrailer ?? <div className="diff-split-spacer" />}</div>
            </div>
          )}
        </Fragment>
      ))}
    </>
  );
});

const SplitRow = memo(function SplitRow({
  side: splitSide,
  kind,
  num,
  tokens,
  rawText,
  emphasis,
  onAddComment,
  hasComment,
}: {
  side: "old" | "new";
  kind: DiffLine["kind"];
  num?: number;
  tokens: CodeLineWithHtml;
  rawText: string;
  emphasis?: WordSegment[];
  onAddComment?: DiffReviewHooks["onAddComment"];
  hasComment?: boolean;
}) {
  const lineClass = kind === "add" ? "diff-line-add" : kind === "del" ? "diff-line-del" : undefined;
  const commentSide: "LEFT" | "RIGHT" = splitSide === "old" ? "LEFT" : "RIGHT";
  const canComment = !!onAddComment && num != null;
  return (
    <div
      className={cn(
        "group flex w-full items-stretch",
        lineClass,
        hasComment && "diff-line-comment",
      )}
    >
      <span className="diff-gutter flex flex-shrink-0 items-center select-none font-mono tabular-nums text-[var(--color-fg-faint)]">
        <span className="w-10 px-1 text-right">{num ?? ""}</span>
        {canComment ? (
          <button
            type="button"
            onClick={() => onAddComment!({ side: commentSide, line: num! })}
            aria-label="Add comment"
            className="flex size-[18px] items-center justify-center rounded-full bg-[var(--diff-comment-border)] text-[11px] font-semibold leading-none text-white opacity-0 transition-opacity duration-75 outline-none group-hover:opacity-100 focus-visible:opacity-100"
          >
            +
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-3">
        <RenderedLine tokens={tokens} rawText={rawText} emphasis={emphasis} />
      </span>
    </div>
  );
});

function NopArea() {
  return (
    <div
      className="h-[20px]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='10' x2='10' y2='0' stroke='white' stroke-opacity='0.1' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "10px 10px",
        backgroundPosition: "0 var(--nop-offset, 0px)",
        backgroundColor: "color-mix(in oklab, var(--color-fg) 4%, var(--color-bg))",
      }}
    ></div>
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

const EMPTY_LINE: CodeLineWithHtml = { tokens: [], html: "" };
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

function tokensForOld(
  line: DiffLine,
  oldTokens: CodeLineWithHtml[],
  map: Map<number, number>,
): CodeLineWithHtml {
  if (line.oldNum == null) return plainTokens(line.content);
  const idx = map.get(line.oldNum);
  if (idx == null) return plainTokens(line.content);
  return oldTokens[idx] ?? plainTokens(line.content);
}

function tokensForNew(
  line: DiffLine,
  newTokens: CodeLineWithHtml[],
  map: Map<number, number>,
): CodeLineWithHtml {
  if (line.newNum == null) return plainTokens(line.content);
  const idx = map.get(line.newNum);
  if (idx == null) return plainTokens(line.content);
  return newTokens[idx] ?? plainTokens(line.content);
}

function plainTokens(content: string): CodeLineWithHtml {
  return {
    tokens: [{ content }],
    html: content.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
    ),
  };
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
