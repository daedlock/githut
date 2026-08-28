import { describe, expect, test } from "bun:test";
import { getActivePrSubTab } from "./PrSubTabs";

describe("pull request subnavigation", () => {
  test("matches the pull request detail routes", () => {
    expect(
      getActivePrSubTab("/getnickai/nickai-app/pull/586", "getnickai", "nickai-app", 586),
    ).toBe("conversation");
    expect(
      getActivePrSubTab("/getnickai/nickai-app/pull/586/commits", "getnickai", "nickai-app", 586),
    ).toBe("commits");
    expect(
      getActivePrSubTab("/getnickai/nickai-app/pull/586/checks", "getnickai", "nickai-app", 586),
    ).toBe("checks");
  });

  test("does not mark a detail tab active for the separate review workspace", () => {
    expect(
      getActivePrSubTab("/getnickai/nickai-app/pr/586", "getnickai", "nickai-app", 586),
    ).toBeNull();
    expect(
      getActivePrSubTab("/getnickai/nickai-app/pull/587", "getnickai", "nickai-app", 586),
    ).toBeNull();
  });
});
