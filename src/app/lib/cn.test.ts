import { describe, expect, test } from "bun:test";
import { cn } from "./cn";

describe("cn", () => {
  test("merges conditional classes", () => {
    expect(cn("base", false && "hidden", null, "active")).toBe("base active");
  });

  test("resolves project typography conflicts", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
  });
});
