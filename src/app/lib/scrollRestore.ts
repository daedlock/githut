/** Frame scheduling, injectable so the restore loop can be driven in tests. */
export type Frames = {
  request(callback: () => void): number;
  cancel(id: number): void;
  now(): number;
};

export const browserFrames: Frames = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
};

/**
 * Bring a revealed tab pane back to `target`. The first write happens in the
 * next animation frame — still before that frame paints, but outside the
 * React commit, where writing and reading back scrollTop would force a
 * synchronous layout of the whole freshly revealed pane. A page rebuilt after
 * its router was released may not be tall enough yet, so it retries each
 * frame until the position sticks or `timeout` ms pass. A target of 0 needs
 * no work: display:none already reset the pane to the top.
 */
export type ScrollRestore = {
  /** True until the position sticks, the timeout passes, or `stop` is called. */
  readonly restoring: boolean;
  stop(): void;
};

export function restoreScroll(
  el: { scrollTop: number },
  target: number,
  frames: Frames = browserFrames,
  timeout = 3000,
): ScrollRestore {
  let frame = 0;
  const handle = {
    restoring: target > 0,
    stop() {
      if (frame) frames.cancel(frame);
      frame = 0;
      handle.restoring = false;
    },
  };
  if (!handle.restoring) return handle;
  const deadline = frames.now() + timeout;
  let attempted = false;
  const step = () => {
    frame = 0;
    // Read the previous frame's result before writing. Reading immediately
    // after the write forces layout even inside requestAnimationFrame.
    if (attempted && (Math.abs(el.scrollTop - target) <= 1 || frames.now() > deadline)) {
      handle.restoring = false;
      return;
    }
    el.scrollTop = target;
    attempted = true;
    frame = frames.request(step);
  };
  frame = frames.request(step);
  return handle;
}
