import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createJSONStorage } from "zustand/middleware";
import { useReviewStore } from "@/app/features/pulls/stores/review";
import { useAuthStore } from "@/app/stores/auth";
import { draftKey, draftPage, hasDraft, useDraftsStore } from "@/app/stores/drafts";
import { queryClient } from "./query";
import { resumeSession } from "./session";

const globals = ["window", "localStorage"] as const;
const original = new Map(
  globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);
const page = draftPage("demo", "project", 1);
const slots = ["comment", "reply:7", "inline:file.ts:RIGHT:1", "review"];

afterEach(() => {
  mock.restore();
  useAuthStore.getState().clear();
  queryClient.clear();
  for (const key of globals) {
    const descriptor = original.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function browserStorage() {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { reload() {} } },
  });
  useAuthStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) });
  return entries;
}

async function signIn(login: string, id: number, token: string) {
  spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ login, id }), { status: 200 }),
  );
  await resumeSession(token);
}

test("switching accounts hides every composer and pending review and recovers them only for their author", async () => {
  browserStorage();
  useAuthStore.getState().setToken("expired");
  await signIn("alice", 1, "alice-token");
  for (const slot of slots)
    useDraftsStore.getState().setDraft(draftKey(page, slot), `Alice ${slot}`);
  useReviewStore.getState().startReview("demo", "project", 1);
  useReviewStore.getState().addPending("demo", "project", 1, {
    path: "file.ts",
    side: "RIGHT",
    line: 1,
    body: "Alice pending",
  });
  useReviewStore.getState().openComposer("demo", "project", 1, {
    path: "file.ts",
    side: "RIGHT",
    line: 2,
  });

  await signIn("bob", 2, "bob-token");
  expect(useDraftsStore.getState().drafts).toEqual({});
  expect(slots.some((slot) => hasDraft(draftKey(page, slot)))).toBe(false);
  expect(useReviewStore.getState().pendingByPr).toEqual({});
  expect(useReviewStore.getState().composerByPr).toEqual({});
  expect(useReviewStore.getState().modeByPr).toEqual({});
  useDraftsStore.getState().setDraft(draftKey(page, "comment"), "Bob comment");

  await signIn("alice", 1, "alice-new-token");
  for (const slot of slots)
    expect(useDraftsStore.getState().drafts[draftKey(page, slot)]?.body).toBe(`Alice ${slot}`);
  expect(useReviewStore.getState().pendingByPr[page]?.[0]?.body).toBe("Alice pending");
  expect(useReviewStore.getState().composerByPr[page]?.line).toBe(2);
});

test("a verified token restores its drafts offline after reload and keeps them through same-account renewal", async () => {
  const entries = browserStorage();
  useAuthStore.getState().setToken("expired");
  await signIn("alice", 1, "alice-token");
  useDraftsStore.getState().setDraft(draftKey(page, "comment"), "Alice offline draft");
  const savedAuth = entries.get("githut.auth")!;
  useAuthStore.getState().clear();
  expect(useDraftsStore.getState().drafts).toEqual({});
  entries.set("githut.auth", savedAuth);
  // A cached /user response is not evidence for a different token's identity.
  queryClient.setQueryData(["me"], { id: 2, login: "bob" });
  spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  await useAuthStore.persist.rehydrate();
  await useDraftsStore.persist.rehydrate();
  expect(useDraftsStore.getState().drafts[draftKey(page, "comment")]?.body).toBe(
    "Alice offline draft",
  );
  useAuthStore.getState().markExpired();
  await signIn("alice-renamed", 1, "alice-renewed");
  expect(useDraftsStore.getState().drafts[draftKey(page, "comment")]?.body).toBe(
    "Alice offline draft",
  );
  useAuthStore.getState().setToken("unknown-token");
  expect(useDraftsStore.getState().drafts).toEqual({});
});

test("sign-out preserves owned drafts but legacy unowned records are never assigned to the next account", async () => {
  const entries = browserStorage();
  const legacy = JSON.stringify({
    state: { drafts: { [draftKey(page, "comment")]: { body: "Unowned", at: Date.now() } } },
    version: 0,
  });
  const legacyReview = JSON.stringify({
    state: {
      pendingByPr: {
        [page]: [{ id: -1, body: "Unowned inline", path: "file.ts", side: "RIGHT", line: 1 }],
      },
    },
    version: 0,
  });
  entries.set("githut.drafts.v1", legacy);
  entries.set("githut.review-drafts.v1", legacyReview);
  useAuthStore.getState().setToken("unverified");
  await useDraftsStore.persist.rehydrate();
  await useReviewStore.persist.rehydrate();
  useDraftsStore.getState().setDraft(draftKey(page, "comment"), "Must not own this");
  await signIn("alice", 1, "alice-token");
  expect(useDraftsStore.getState().drafts).toEqual({});
  expect(useReviewStore.getState().pendingByPr).toEqual({});
  useDraftsStore.getState().setDraft(draftKey(page, "comment"), "Owned by Alice");
  useAuthStore.getState().clear();
  expect(useDraftsStore.getState().drafts).toEqual({});
  useAuthStore.getState().setToken("new-login");
  entries.set("githut.drafts.v1.account.2", "corrupt");
  entries.set("githut.review-drafts.v1.account.2", "corrupt");
  await signIn("bob", 2, "bob-token");
  expect(useDraftsStore.getState().drafts).toEqual({});
  await signIn("alice", 1, "alice-return");
  expect(useDraftsStore.getState().drafts[draftKey(page, "comment")]?.body).toBe("Owned by Alice");
  expect(entries.get("githut.drafts.v1")).toBe(legacy);
  expect(entries.get("githut.review-drafts.v1")).toBe(legacyReview);
});
