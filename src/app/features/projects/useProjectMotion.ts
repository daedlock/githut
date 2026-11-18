import { useLayoutEffect, useRef } from "react";

const curve = "cubic-bezier(0.16,1,0.3,1)";
interface Snapshot {
  boxes: Map<string, DOMRect>;
  left: number;
  top: number;
  layout: string;
  revision: unknown;
}
// Measure just before replacing GitHub-confirmed data. Scroll, filter typing,
// off-screen items and reduced motion never trigger a layout animation.
export function useProjectMotion(revision: unknown, layout: string) {
  const root = useRef<HTMLElement>(null);
  const before = useRef<Snapshot | null>(null);
  const running = useRef(new Set<Animation>());
  function capture() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const scroller = root.current.querySelector(
      ".project-board,.project-tablewrap,.project-timeline",
    );
    before.current = {
      boxes: new Map(
        elements(root.current).map((el) => [el.dataset.motionItem!, el.getBoundingClientRect()]),
      ),
      top: scroller?.scrollTop ?? 0,
      left: scroller?.scrollLeft ?? 0,
      revision,
      layout,
    };
  }
  useLayoutEffect(() => {
    const previous = before.current;
    before.current = null;
    if (
      !previous ||
      previous.revision === revision ||
      layout !== previous.layout ||
      !root.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const scroller = root.current.querySelector(
      ".project-board,.project-tablewrap,.project-timeline",
    );
    if (
      previous.top !== (scroller?.scrollTop ?? 0) ||
      previous.left !== (scroller?.scrollLeft ?? 0)
    )
      return;
    for (const animation of running.current) animation.cancel();
    running.current.clear();
    const visible = elements(root.current);
    for (const el of visible) {
      const last = previous.boxes.get(el.dataset.motionItem!);
      if (!last) continue;
      const next = el.getBoundingClientRect();
      const x = last.left - next.left,
        y = last.top - next.top;
      if (Math.abs(x) + Math.abs(y) < 1) continue;
      const animation = el.animate(
        [{ transform: `translate(${x}px,${y}px)` }, { transform: "translate(0,0)" }],
        { duration: 200, easing: curve },
      );
      running.current.add(animation);
      animation.onfinish = () => running.current.delete(animation);
    }
  }, [revision, layout]);
  useLayoutEffect(
    () => () => {
      for (const a of running.current) a.cancel();
      running.current.clear();
    },
    [],
  );
  return { root, capture };
}
function elements(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>("[data-motion-item]") ?? []).filter(
    (el) => {
      const box = el.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        box.right > 0 &&
        box.left < innerWidth
      );
    },
  );
}
