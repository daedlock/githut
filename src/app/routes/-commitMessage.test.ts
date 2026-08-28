import { describe, expect, test } from "bun:test";
import { parseCommitMessage } from "./$owner.$repo.commit.$sha";

describe("commit message presentation", () => {
  test("turns hard-wrapped commit prose into readable paragraphs", () => {
    const message = [
      "Fix repeated execution",
      "",
      "The engine now threads its own loop iteration counter into",
      "the execution context for every node inside a loop.",
      "",
      "This keeps downstream order ids stable.",
    ].join("\n");

    expect(parseCommitMessage(message)).toEqual({
      title: "Fix repeated execution",
      paragraphs: [
        "The engine now threads its own loop iteration counter into the execution context for every node inside a loop.",
        "This keeps downstream order ids stable.",
      ],
      trailers: [],
    });
  });

  test("separates commit trailers from the prose", () => {
    const message = [
      "Fix repeated execution",
      "",
      "Preserve the loop index.",
      "",
      "Co-authored-by: Hossam <hossam@example.com>",
      "Signed-off-by: Niko <niko@example.com>",
    ].join("\n");

    expect(parseCommitMessage(message)).toEqual({
      title: "Fix repeated execution",
      paragraphs: ["Preserve the loop index."],
      trailers: [
        { label: "Co-authored-by:", value: "Hossam <hossam@example.com>" },
        { label: "Signed-off-by:", value: "Niko <niko@example.com>" },
      ],
    });
  });

  test("preserves intentional list formatting", () => {
    const message = [
      "Explain behavior",
      "",
      "- Keep the first item",
      "- Keep the second item",
    ].join("\n");

    expect(parseCommitMessage(message).paragraphs).toEqual([
      "- Keep the first item\n- Keep the second item",
    ]);
  });
});
