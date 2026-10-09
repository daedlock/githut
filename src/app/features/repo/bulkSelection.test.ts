import { describe, expect, test } from "bun:test";
import { runBulkUpdate, toggleSelection } from "./bulkSelection";

describe("bulk selection", () => {
  test("selects and deselects ranges in display order", () => {
    const order = [9, 2, 7, 1];
    expect([...toggleSelection(new Set([9]), order, 2, 0, true)]).toEqual([9, 2, 7]);
    expect([...toggleSelection(new Set(order), order, 1, 3, true)]).toEqual([9]);
  });
  test("ignores missing anchors and deduplicates grouped items", () => {
    expect([...toggleSelection(new Set(), [3, 1, 3, 2], 3, 0, true)]).toEqual([3, 1, 2]);
    expect([...toggleSelection(new Set([3]), [1, 2], 1, -1, true)]).toEqual([3, 2]);
  });
  test("range anchors distinguish repeated rows across groups", () => {
    expect([...toggleSelection(new Set([3]), [3, 1, 3, 2], 3, 2, true)]).toEqual([3, 2]);
  });
  test("bounds concurrency, reports partial failures and retries only failures", async () => {
    let active = 0;
    let peak = 0;
    const progress: number[] = [];
    const failed = await runBulkUpdate(
      [1, 2, 3, 4, 5, 6],
      async (number) => {
        peak = Math.max(peak, ++active);
        await Bun.sleep(2);
        active--;
        if (number === 2 || number === 5) throw new Error("Permission denied");
      },
      (value) => progress.push(value),
    );
    expect(peak).toBe(3);
    expect(failed.map((item) => item.number).sort()).toEqual([2, 5]);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
    const retried: number[] = [];
    expect(
      await runBulkUpdate(
        failed.map((item) => item.number),
        async (number) => {
          retried.push(number);
        },
        () => {},
      ),
    ).toEqual([]);
    expect(retried.sort()).toEqual([2, 5]);
  });
});
