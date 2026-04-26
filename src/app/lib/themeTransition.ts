import { flushSync } from "react-dom";

export type ThemeTransitionVariant =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "rectangle"
  | "star";

interface RunOptions {
  duration?: number;
  variant?: ThemeTransitionVariant;
  fromCenter?: boolean;
}

const lastPointer = { x: 0, y: 0, set: false };
let inTransition = false;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      lastPointer.set = true;
    },
    { capture: true, passive: true },
  );
}

function polygonCollapsed(cx: number, cy: number, n: number): string {
  const pairs = Array.from({ length: n }, () => `${cx}px ${cy}px`).join(", ");
  return `polygon(${pairs})`;
}

function getClipPaths(
  variant: ThemeTransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  vw: number,
  vh: number,
): [string, string] {
  switch (variant) {
    case "circle":
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ];
    case "square": {
      const halfW = Math.max(cx, vw - cx);
      const halfH = Math.max(cy, vh - cy);
      const half = Math.max(halfW, halfH) * 1.05;
      const end = [
        `${cx - half}px ${cy - half}px`,
        `${cx + half}px ${cy - half}px`,
        `${cx + half}px ${cy + half}px`,
        `${cx - half}px ${cy + half}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "triangle": {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      const verts = [
        `${cx}px ${cy - scale}px`,
        `${cx + dx}px ${cy + 0.5 * scale}px`,
        `${cx - dx}px ${cy + 0.5 * scale}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 3), `polygon(${verts})`];
    }
    case "diamond": {
      const R = maxRadius * Math.SQRT2;
      const end = [
        `${cx}px ${cy - R}px`,
        `${cx + R}px ${cy}px`,
        `${cx}px ${cy + R}px`,
        `${cx - R}px ${cy}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "hexagon": {
      const R = maxRadius * Math.SQRT2;
      const verts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        verts.push(`${cx + R * Math.cos(a)}px ${cy + R * Math.sin(a)}px`);
      }
      return [polygonCollapsed(cx, cy, 6), `polygon(${verts.join(", ")})`];
    }
    case "rectangle": {
      const halfW = Math.max(cx, vw - cx);
      const halfH = Math.max(cy, vh - cy);
      const end = [
        `${cx - halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy + halfH}px`,
        `${cx - halfW}px ${cy + halfH}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "star": {
      const R = maxRadius * Math.SQRT2 * 1.03;
      const innerRatio = 0.42;
      const star = (radius: number) => {
        const verts: string[] = [];
        for (let i = 0; i < 5; i++) {
          const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(
            `${cx + radius * Math.cos(outer)}px ${cy + radius * Math.sin(outer)}px`,
          );
          const inner = outer + Math.PI / 5;
          verts.push(
            `${cx + radius * innerRatio * Math.cos(inner)}px ${cy + radius * innerRatio * Math.sin(inner)}px`,
          );
        }
        return `polygon(${verts.join(", ")})`;
      };
      const startR = Math.max(2, R * 0.025);
      return [star(startR), star(R)];
    }
  }
}

export function runThemeTransition(
  updateFn: () => void,
  options: RunOptions = {},
): void {
  // Reentrancy guard: if a transition is already wrapping us, just run the
  // update synchronously so back-to-back action calls coalesce into one reveal.
  if (inTransition) {
    updateFn();
    return;
  }

  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function"
  ) {
    updateFn();
    return;
  }

  const { duration = 400, variant = "circle", fromCenter = false } = options;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const x = fromCenter || !lastPointer.set ? vw / 2 : lastPointer.x;
  const y = fromCenter || !lastPointer.set ? vh / 2 : lastPointer.y;
  const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

  inTransition = true;
  const transition = document.startViewTransition(() => {
    flushSync(updateFn);
  });

  const cleanup = () => {
    inTransition = false;
  };
  if (typeof transition.finished?.finally === "function") {
    transition.finished.finally(cleanup);
  } else {
    cleanup();
  }

  if (typeof transition.ready?.then === "function") {
    const clipPath = getClipPaths(variant, x, y, maxRadius, vw, vh);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath },
        {
          duration,
          easing: variant === "star" ? "linear" : "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }
}
