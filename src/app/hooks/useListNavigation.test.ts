import { describe, expect, test } from "bun:test";
import { getNextListIndex } from "@/app/hooks/useListNavigation";

describe("getNextListIndex", () => {
  test("starts at the closest edge", () => {
    expect(getNextListIndex(-1, 4, 1)).toBe(0);
    expect(getNextListIndex(-1, 4, -1)).toBe(3);
  });

  test("moves without wrapping past list bounds", () => {
    expect(getNextListIndex(1, 4, 1)).toBe(2);
    expect(getNextListIndex(3, 4, 1)).toBe(3);
    expect(getNextListIndex(0, 4, -1)).toBe(0);
  });

  test("handles an empty list", () => {
    expect(getNextListIndex(-1, 0, 1)).toBe(-1);
  });
});
