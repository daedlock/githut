import Anser from "anser";

// ─── Log model ─────────────────────────────────────────────────────────────
//
// GitHub job logs are plain text with:
//   - ISO timestamp prefix:  `2026-04-22T10:00:00.1234567Z <rest>`
//   - Group markers:         `##[group]title`  `##[endgroup]`
//   - Workflow commands:     `::error::msg` / `::warning::msg` / `::notice::msg`
//     (optional attrs: `::error file=x,line=y::msg`)
//   - ANSI escape codes inside the body.
//
// parseLog() lifts all four into a structured stream so the viewer can
// render each line in one pass without string-splitting on every frame.

export type LogToken = {
  content: string;
  fg?: string; // rgb() string if set
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
};

export type LogLineKind = "normal" | "group-start" | "group-end" | "command";
export type LogCommandLevel = "error" | "warning" | "notice" | "debug";
export type LogSeverity = "error" | "warning";

export type LogLine = {
  kind: LogLineKind;
  timestamp?: string;
  tokens: LogToken[];
  groupTitle?: string;
  level?: LogCommandLevel;
  /**
   * Heuristic classification for *normal* lines that carry error/warning
   * text (e.g. `Error: ...`, `Process completed with exit code 1`, stack
   * traces). The LogViewer tints matching rows so the failing signal is
   * visible at a glance. Undefined for non-relevant lines.
   */
  severity?: LogSeverity;
};

const GROUP_START = /^##\[group\](.*)$/;
const GROUP_END = /^##\[endgroup\]\s*$/;
// `##[error]` / `##[warning]` etc — runner-emitted annotations (same
// severity signal as the `::error::` form, different bracket syntax).
const ANNOTATION = /^##\[(error|warning|notice|debug)\](.*)$/;
const COMMAND = /^::(error|warning|notice|debug)(?:\s[^:]*)?::(.*)$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s?/;

// Plain-text lines flagged as errors even without a workflow-command prefix.
// Covers the common CI-failure shapes across ecosystems. Tested against the
// timestamp-stripped line content (ANSI codes rarely obscure the keywords).
const ERROR_PATTERNS: RegExp[] = [
  /Process completed with exit code [1-9]\d*/,
  /\bexit status [1-9]\d*\b/,
  /^(?:\[.*?\]\s*)?(?:FATAL|fatal): /,
  /^(?:\[.*?\]\s*)?(?:ERROR|error): /,
  /^(?:\[.*?\]\s*)?Error: /,
  /^FAIL(?:ED)?\b/,
  /npm ERR!/,
  /\bSyntaxError\b/,
  /\bTypeError\b/,
  /\bRuntimeError\b/,
  /\bTraceback \(most recent call last\):/,
];
const WARNING_PATTERNS: RegExp[] = [
  /^(?:WARN|warn|warning|WARNING): /,
  /npm WARN/,
  /\bDeprecationWarning\b/,
];

function classifySeverity(line: string): LogSeverity | undefined {
  for (const p of ERROR_PATTERNS) if (p.test(line)) return "error";
  for (const p of WARNING_PATTERNS) if (p.test(line)) return "warning";
  return undefined;
}

export function parseLog(raw: string): LogLine[] {
  if (!raw) return [];
  const rawLines = raw.split(/\r?\n/);
  // Drop a single trailing empty line caused by the final \n — keep internal blanks.
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const out: LogLine[] = new Array(rawLines.length);

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i] ?? "";
    let timestamp: string | undefined;

    const ts = TIMESTAMP.exec(line);
    if (ts) {
      timestamp = ts[1];
      line = line.slice(ts[0].length);
    }

    const gs = GROUP_START.exec(line);
    if (gs) {
      out[i] = { kind: "group-start", timestamp, groupTitle: (gs[1] ?? "").trim(), tokens: [] };
      continue;
    }
    if (GROUP_END.test(line)) {
      out[i] = { kind: "group-end", timestamp, tokens: [] };
      continue;
    }

    // `##[error]message` — treat as a command row with severity from the bracket.
    const ann = ANNOTATION.exec(line);
    if (ann) {
      out[i] = {
        kind: "command",
        level: ann[1] as LogCommandLevel,
        timestamp,
        tokens: [{ content: ann[2] ?? "" }],
      };
      continue;
    }
    const cmd = COMMAND.exec(line);
    if (cmd) {
      out[i] = {
        kind: "command",
        level: cmd[1] as LogCommandLevel,
        timestamp,
        tokens: [{ content: cmd[2] ?? "" }],
      };
      continue;
    }

    // Normal line — ANSI parse + severity classification from plain text.
    const severity = classifySeverity(line);
    out[i] = { kind: "normal", timestamp, tokens: ansiTokens(line), severity };
  }

  return out;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function ansiTokens(line: string): LogToken[] {
  if (!line) return [];
  // Fast path: no ESC (0x1b) byte → no ANSI codes possible, skip the anser regex.
  if (line.indexOf("") === -1) return [{ content: line }];
  const parts = Anser.ansiToJson(line, { use_classes: false });
  return parts.map((p) => ({
    content: p.content,
    fg: p.fg ? `rgb(${p.fg})` : undefined,
    bold: p.decorations?.includes("bold") ?? false,
    italic: p.decorations?.includes("italic") ?? false,
    underline: p.decorations?.includes("underline") ?? false,
    dim: p.decorations?.includes("dim") ?? false,
  }));
}
