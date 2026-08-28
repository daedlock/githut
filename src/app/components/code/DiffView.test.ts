import { describe, expect, test } from "bun:test";
import { buildSources } from "./DiffView";
import { parseUnifiedDiff } from "./parseDiff";
import { codeTokenChunksQueryOptions } from "./useCodeTokens";

describe("diff syntax highlighting", () => {
  test("does not leak a block comment across omitted context between hunks", async () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      " /* comment starts in this hunk",
      " const before = true;",
      "@@ -20,1 +20,1 @@",
      "-const oldValue = 1;",
      "+const newValue = 2;",
    ].join("\n");
    const hunks = parseUnifiedDiff(patch);
    const { newSource, newLineMap, newChunkStarts } = buildSources(hunks);
    const tokenLines = await codeTokenChunksQueryOptions(
      newSource,
      "typescript",
      newChunkStarts,
    ).queryFn();
    const firstHunk = tokenLines[newLineMap.get(2)!];
    const laterHunk = tokenLines[newLineMap.get(20)!];

    expect(firstHunk?.html).toContain("var(--syntax-comment)");
    expect(laterHunk?.html).toContain("var(--syntax-keyword)");
    expect(laterHunk?.html).not.toContain("var(--syntax-comment)");
  });

  test("keeps semantic syntax colors intact inside changed lines", async () => {
    const patch = [
      "@@ -1,1 +1,1 @@",
      '-const oldValue = "before";',
      '+const newValue = "after";',
    ].join("\n");
    const hunks = parseUnifiedDiff(patch);
    const { newSource, newChunkStarts } = buildSources(hunks);
    const tokenLines = await codeTokenChunksQueryOptions(
      newSource,
      "typescript",
      newChunkStarts,
    ).queryFn();
    const html = tokenLines.map((line) => line.html).join("\n");

    expect(html).toContain("var(--syntax-keyword)");
    expect(html).toContain("var(--syntax-string)");
    expect(html).not.toContain("--diff-syntax-");
  });
});
