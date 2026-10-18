/**
 * Where a LiveUpdates list's tab pane is, as far as measuring goes:
 * - hidden: the pane is display:none (Activity hid it); geometry is meaningless.
 * - revealed: shown again (or just mounted) but not laid out yet. Reading
 *   geometry now would force a synchronous layout of the whole pane.
 * - settled: laid out at least once since it was shown; reads are cheap.
 */
export type PaneState = "hidden" | "revealed" | "settled";

/**
 * What a React commit of the list may measure. Only a settled pane whose
 * content changed does any work: when it already had content, the reader's
 * anchor is kept in place through the commit; when the first load just
 * arrived, the anchor is only re-captured, deferred to the next frame.
 */
export function commitMeasure(
  pane: PaneState,
  { previousReady, childrenChanged }: { previousReady: boolean; childrenChanged: boolean },
): "keep-place" | "recapture" | "none" {
  if (pane !== "settled" || !childrenChanged) return "none";
  return previousReady ? "keep-place" : "recapture";
}
