import { expect, test } from "bun:test";
import { type Frames, restoreScroll } from "@/app/lib/scrollRestore";

// A scroll container whose content height can grow, like a pane whose page
// is still loading: the browser clamps scrollTop to what the content allows.
function pane(maxScroll: number) {
  let top = 0;
  let writes = 0;
  return {
    get scrollTop() {
      return top;
    },
    set scrollTop(value: number) {
      writes++;
      top = Math.max(0, Math.min(value, this.maxScroll));
    },
    maxScroll,
    get writes() {
      return writes;
    },
  };
}

function manualFrames(): Frames & { tick(ms?: number): void; pending(): number } {
  let clock = 0;
  let next = 1;
  const queue = new Map<number, () => void>();
  return {
    request(callback) {
      const id = next++;
      queue.set(id, callback);
      return id;
    },
    cancel(id) {
      queue.delete(id);
    },
    now: () => clock,
    tick(ms = 16) {
      clock += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const callback of due) callback();
    },
    pending: () => queue.size,
  };
}

test("revealing a tab restores its scroll position in the next frame, not during the reveal", () => {
  const el = pane(5000);
  const frames = manualFrames();
  const restore = restoreScroll(el, 1200, frames);
  expect(el.writes).toBe(0);
  expect(restore.restoring).toBe(true);
  frames.tick();
  expect(el.scrollTop).toBe(1200);
  expect(restore.restoring).toBe(false);
  expect(frames.pending()).toBe(0);
});

test("a page still loading keeps being restored each frame until it is tall enough", () => {
  const el = pane(300);
  const frames = manualFrames();
  restoreScroll(el, 1200, frames);
  frames.tick();
  expect(el.scrollTop).toBe(300);
  el.maxScroll = 5000;
  frames.tick();
  expect(el.scrollTop).toBe(1200);
  expect(frames.pending()).toBe(0);
});

test("restoring gives up after the timeout when the page never gets tall enough", () => {
  const el = pane(300);
  const frames = manualFrames();
  restoreScroll(el, 1200, frames, 100);
  for (let i = 0; i < 10; i++) frames.tick(16);
  expect(frames.pending()).toBe(0);
  expect(el.scrollTop).toBe(300);
});

test("the user taking over the scroll stops the restore", () => {
  const el = pane(300);
  const frames = manualFrames();
  const restore = restoreScroll(el, 1200, frames);
  frames.tick();
  restore.stop();
  expect(restore.restoring).toBe(false);
  el.maxScroll = 5000;
  frames.tick();
  expect(el.scrollTop).toBe(300);
  expect(frames.pending()).toBe(0);
});

test("a tab at the top is left alone", () => {
  const el = pane(5000);
  const frames = manualFrames();
  const restore = restoreScroll(el, 0, frames);
  expect(restore.restoring).toBe(false);
  frames.tick();
  expect(el.writes).toBe(0);
  expect(frames.pending()).toBe(0);
});
