import { afterEach, expect, test } from "bun:test";
import { trackWorkspaceAction } from "@/app/lib/analytics";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function browser(track: (payload: unknown) => unknown, disabled = false) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: { getItem: () => (disabled ? "1" : null) },
      umami: { track },
    },
  });
}

test("workspace counts strip page identity and unknown IDs from the entire tracker payload", () => {
  const payloads: unknown[] = [];
  browser((build) => {
    expect(typeof build).toBe("function");
    payloads.push(
      (build as (props: object) => object)({
        website: "public-site-id",
        hostname: "private-preview.example",
        url: "/private-owner/secret-repo/pull/123?token=secret",
        title: "Confidential bug title",
        referrer: "https://github.com/private-owner/secret-repo",
        id: "person@example.com",
        data: { repository: "secret-repo" },
        language: "en-US",
        screen: "1440x900",
      }),
    );
  });
  trackWorkspaceAction("split");
  expect(payloads).toEqual([
    {
      website: "public-site-id",
      url: "/workspace",
      title: "Workspace",
      referrer: "",
      name: "workspace_action",
      data: { action: "split" },
    },
  ]);
});

test("workspace counts honor opt-out and failures never escape into an action", async () => {
  let calls = 0;
  browser(() => {
    calls++;
  }, true);
  trackWorkspaceAction("pin");
  expect(calls).toBe(0);
  browser(() => {
    throw Error("tracker unavailable");
  });
  expect(() => trackWorkspaceAction("shortcut")).not.toThrow();
  browser(() => Promise.reject(Error("network failure")));
  trackWorkspaceAction("drag-dock");
  await new Promise((resolve) => setTimeout(resolve, 0));
  browser(() => {
    calls++;
  });
  Object.defineProperty(window, "localStorage", {
    get: () => {
      throw Error("storage blocked");
    },
  });
  expect(() => trackWorkspaceAction("sidebar-toggled")).not.toThrow();
  expect(calls).toBe(0);
});
