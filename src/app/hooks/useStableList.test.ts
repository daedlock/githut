import { expect, test } from "bun:test";
import { holdGroupItems, holdListOrder } from "@/app/hooks/useStableList";

type Row = { id: number; author: string };
type Group = { key: string; items: Row[] };

const a1 = { id: 1, author: "a" };
const a2 = { id: 2, author: "a" };
const b1 = { id: 3, author: "b" };

test("holding a grouped list keeps each group's rows to its own members", () => {
  const groups: Group[] = [
    { key: "a", items: [a1, a2] },
    { key: "b", items: [b1] },
  ];
  const held = holdListOrder(
    groups,
    groups,
    (g) => g.key,
    holdGroupItems((r: Row) => r.id),
  );
  expect(held.map((g) => g.items.map((r) => r.id))).toEqual([[1, 2], [3]]);
});

test("rows that arrive while held append to their own group only", () => {
  const before: Group[] = [
    { key: "a", items: [a1] },
    { key: "b", items: [b1] },
  ];
  const after: Group[] = [
    { key: "a", items: [a2, a1] },
    { key: "b", items: [b1] },
  ];
  const held = holdListOrder(
    before,
    after,
    (g) => g.key,
    holdGroupItems((r: Row) => r.id),
  );
  expect(held.map((g) => g.items.map((r) => r.id))).toEqual([[1, 2], [3]]);
});
