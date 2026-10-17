import { afterEach, expect, test } from "bun:test";
import { useAuthStore } from "@/app/stores/auth";
import { bootstrapAuthFromHash } from "./auth";

const globals = ["window", "sessionStorage", "localStorage"] as const;
const original = new Map(
  globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);
afterEach(() => {
  useAuthStore.getState().clear();
  for (const key of globals) {
    const descriptor = original.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function storage(values: Record<string, string> = {}) {
  const entries = new Map(Object.entries(values));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  };
}

test("an OAuth redirect in this window cannot consume another window's popup marker", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hash: "" } },
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage({ "githut.oauth_token": "new-token" }),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage({ "githut.reauth_pending": String(Date.now()) }),
  });
  expect(bootstrapAuthFromHash()).toBe("redirect");
});
