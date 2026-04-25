import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cn } from "@/app/lib/cn";
import { FS_BOLD, FS_ITALIC, FS_STRIKETHROUGH, FS_UNDERLINE } from "./types";
import type { CodeLine, CodeLineWithHtml, LineKind } from "./types";

const LINE_H = 20; // px — Berkeley Mono 13px × 1.5 line-height ≈ 20px
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

export type CodeViewProps = {
  lines: (CodeLine | CodeLineWithHtml)[];
  /** Per-line decoration — if omitted, renders as a plain viewer with sequential line numbers */
  decorations?: LineDecoration[];
  startLine?: number;
  className?: string;
};

export function CodeView({ lines, decorations, startLine = 1, className }: CodeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDiff = !!decorations;

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_H,
    overscan: 12,
  });

  const containerH = Math.min(lines.length * LINE_H, window.innerHeight * 0.75);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-auto bg-[color-mix(in_oklab,var(--color-bg)_94%,var(--color-bg-sunken))] text-code",
        "font-feature-settings-code",
        className,
      )}
      style={{
        height: containerH,
        maxHeight: MAX_H,
        // Force the mono token inline so Tailwind's @layer utilities cascade
        // (which body's unlayered font-family: var(--font-sans) can outrank)
        // can never steal the code viewer's font.
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const line = lines[item.index];
          const dec = decorations?.[item.index];
          const kind = dec?.kind ?? "context";
          const lineNum = startLine + item.index;

          return (
            <div
              key={item.key}
              style={{ position: "absolute", top: item.start, left: 0, right: 0, height: LINE_H }}
              className={cn(
                "flex items-center select-text",
                kind === "added" && "bg-[var(--color-success)]/10",
                kind === "removed" && "bg-[var(--color-danger)]/10",
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
                <span className="w-12 flex-shrink-0 select-none text-right pr-5 text-[var(--color-fg-faint)] opacity-50">
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
                  // eslint-disable-next-line react/no-danger
                  <span dangerouslySetInnerHTML={{ __html: line.html }} />
                ) : line?.map((token: { content: string; color?: string; fontStyle?: number }, i: number) => (
                  <span
                    key={i}
                    style={{
                      color: token.color,
                      ...fontStyleToCSS(token.fontStyle),
                    }}
                  >
                    {token.content}
                  </span>
                ))
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
