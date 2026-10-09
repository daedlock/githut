export function toggleSelection(
  selected: ReadonlySet<number>,
  order: readonly number[],
  index: number,
  anchor: number | null,
  range: boolean,
): Set<number> {
  const next = new Set(selected);
  const number = order[index];
  if (number === undefined) return next;
  const from = anchor ?? -1;
  const to = index;
  const targets =
    range && from >= 0 && from < order.length && to >= 0
      ? order.slice(Math.min(from, to), Math.max(from, to) + 1)
      : [number];
  const removing = selected.has(number);
  for (const target of targets) {
    if (removing) next.delete(target);
    else next.add(target);
  }
  return next;
}

/** Bound GitHub writes, and retain individual failures for a targeted retry. */
export async function runBulkUpdate(
  numbers: number[],
  update: (number: number) => Promise<unknown>,
  onProgress: (completed: number) => void,
) {
  const failed: { number: number; message: string }[] = [];
  let cursor = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, numbers.length) }, async () => {
      while (cursor < numbers.length) {
        const number = numbers[cursor++];
        if (number === undefined) break;
        try {
          await update(number);
        } catch (error) {
          failed.push({
            number,
            message: error instanceof Error ? error.message : "Update failed",
          });
        }
        onProgress(++completed);
      }
    }),
  );
  return failed;
}
