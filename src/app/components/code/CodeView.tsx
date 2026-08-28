import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { cn } from "@/app/lib/cn";
import type { CodeLine, CodeLineWithHtml, LineKind } from "./types";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "./types";

const LINE_H = 20; // px — fixed reading rhythm across the 12–14px code-size options
const MAX_H = "75vh";

function fontStyleToCSS(fs: number | undefined): React.CSSProperties {
  if (!fs || fs <= 0) return {};
  return {
    fontStyle: fs & FS_ITALIC ? "italic" : undefined,
    fontWeight: fs & FS_BOLD ? "bold" : undefined,
    textDecoration:
      [fs & FS_UNDERLINE ? "underline" : "", fs & FS_STRIKETHROUGH ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

type LineDecoration = {
  kind: LineKind;
  oldNum?: number;
  newNum?: number;
  prefix?: string;
};

export type ActiveLineRange = { start: number; end: number };

export type CodeViewProps = {
  lines: (CodeLine | CodeLineWithHtml)[];
  /** Per-line decoration — if omitted, renders as a plain viewer with sequential line numbers */
  decorations?: LineDecoration[];
  /** Full-file mode highlight map keyed by 1-indexed line number. */
  lineHighlights?: ReadonlyMap<number, LineKind>;
  /** GitHub-style active line/range (for #L12 or #L12-L20 links). */
  activeLineRange?: ActiveLineRange;
  startLine?: number;
  className?: string;
};

export function CodeView({
  lines,
  decorations,
  lineHighlights,
  activeLineRange,
  startLine = 1,
  className,
}: CodeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDiff = !!decorations;

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_H,
    overscan: 12,
  });

  const containerH = Math.min(lines.length * LINE_H, window.innerHeight * 0.75);
  const activeStart = activeLineRange?.start;
  const activeEnd = activeLineRange?.end;

  useEffect(() => {
    if (!activeStart || lines.length === 0) return;
    const targetIndex = Math.min(
      Math.max(activeStart - startLine, 0),
      Math.max(lines.length - 1, 0),
    );
    virtualizer.scrollToIndex(targetIndex, { align: "center" });
  }, [activeStart, lines.length, startLine, virtualizer]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-auto bg-[var(--color-code-bg)] text-code",
        "font-feature-settings-code",
        className,
      )}
      style={{
        height: containerH,
        maxHeight: MAX_H,
        // Force the code-font token inline so Tailwind's @layer utilities cascade
        // (which body's unlayered font-family: var(--font-sans) can outrank)
        // can never steal the code viewer's font.
        fontFamily: "var(--font-code)",
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const line = lines[item.index];
          const dec = decorations?.[item.index];
          const lineNum = startLine + item.index;
          const kind = dec?.kind ?? lineHighlights?.get(lineNum) ?? "context";
          const isActiveLine =
            !!activeStart && !!activeEnd && lineNum >= activeStart && lineNum <= activeEnd;

          return (
            <div
              key={item.key}
              id={!isDiff ? `L${lineNum}` : undefined}
              style={{ position: "absolute", top: item.start, left: 0, right: 0, height: LINE_H }}
              className={cn(
                "flex items-center border-l-[3px] border-l-transparent select-text",
                kind === "added" && "border-l-[var(--diff-add-marker)] bg-[var(--diff-add-bg)]",
                kind === "removed" && "border-l-[var(--diff-del-marker)] bg-[var(--diff-del-bg)]",
                isActiveLine &&
                  "bg-[color-mix(in_oklab,var(--color-brand)_16%,var(--color-code-bg))]",
              )}
            >
              {/* line number(s) */}
              {isDiff ? (
                <span className="flex flex-shrink-0 select-none">
                  <span className="w-10 text-right pr-2 text-[var(--color-fg-faint)] opacity-60">
                    {dec?.oldNum ?? ""}
                  </span>
                  <span className="w-10 text-right pr-3 text-[var(--color-fg-faint)] opacity-60">
                    {dec?.newNum ?? ""}
                  </span>
                </span>
              ) : (
                <span
                  className={cn(
                    "w-12 flex-shrink-0 select-none text-right pr-5 text-[var(--color-fg-faint)] opacity-50",
                    kind === "added" && "bg-[var(--diff-add-gutter)] text-[var(--color-fg-muted)] opacity-100",
                    kind === "removed" && "bg-[var(--diff-del-gutter)] text-[var(--color-fg-muted)] opacity-100",
                    isActiveLine && "text-foreground opacity-100",
                  )}
                >
                  {lineNum}
                </span>
              )}

              {/* diff prefix */}
              {isDiff && (
                <span
                  className={cn(
                    "w-4 flex-shrink-0 select-none text-center",
                    kind === "added" && "text-[var(--color-success)]",
                    kind === "removed" && "text-[var(--color-danger)]",
                    kind === "context" && "text-[var(--color-fg-faint)]",
                  )}
                >
                  {kind === "added" ? "+" : kind === "removed" ? "−" : " "}
                </span>
              )}

              {/* code tokens */}
              <span className="whitespace-pre overflow-hidden">
                {line && "html" in line ? (
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated by our trusted Shiki pipeline.
                  <span dangerouslySetInnerHTML={{ __html: line.html }} />
                ) : (
                  line?.map(
                    (token: { content: string; color?: string; fontStyle?: number }, i: number) => {
                      return (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: Token order is stable within a rendered code line.
                          key={i}
                          style={{
                            color: token.color,
                            ...fontStyleToCSS(token.fontStyle),
                          }}
                        >
                          {token.content}
                        </span>
                      );
                    },
                  )
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
