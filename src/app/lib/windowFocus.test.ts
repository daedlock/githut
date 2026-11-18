import { expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { listenForWindowFocus } from "./windowFocus";

test("app focus refreshes stale queries once, preserving fresh data and opt-outs", async () => {
  const target = new EventTarget();
  const client = new QueryClient();
  const calls = [0, 0, 0];
  const stops = [0, 1, 2].map((i) => {
    client.setQueryData([i], "cached", { updatedAt: Date.now() - 60_000 });
    return new QueryObserver(client, {
      queryKey: [i],
      queryFn: () => ++calls[i]!,
      staleTime: i === 1 ? Infinity : 0,
      refetchOnMount: false,
      refetchOnWindowFocus: i !== 2,
    }).subscribe(() => {});
  });
  let visible = true;
  let notifications = 0;
  const stop = listenForWindowFocus(
    () => {
      notifications++;
      if (visible) client.getQueryCache().onFocus();
    },
    target,
    () => visible,
  );
  target.dispatchEvent(new Event("focus"));
  target.dispatchEvent(new Event("visibilitychange"));
  await Bun.sleep(150);
  expect(calls).toEqual([1, 0, 0]);
  expect(notifications).toBe(1);
  visible = false;
  target.dispatchEvent(new Event("focus"));
  await Bun.sleep(150);
  expect(calls).toEqual([1, 0, 0]);
  visible = true;
  target.dispatchEvent(new Event("focus"));
  stop();
  await Bun.sleep(150);
  expect(calls).toEqual([1, 0, 0]);
  stops.forEach((dispose) => {
    dispose();
  });
  client.clear();
});
