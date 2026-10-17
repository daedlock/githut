import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { onlineManager } from "@tanstack/react-query";
import { useAuthStore } from "@/app/stores/auth";
import { getGitHubClient } from "./github/client";
import { queryClient } from "./query";
import { resumeSession } from "./session";

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

afterEach(() => {
  mock.restore();
  if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  else Reflect.deleteProperty(globalThis, "navigator");
  useAuthStore.getState().clear();
  onlineManager.setOnline(true);
  queryClient.clear();
});

test("direct GitHub writes are rejected offline without sending a request", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  useAuthStore.getState().setToken("direct-write-token");
  const send = spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  await expect(
    getGitHubClient().request("POST /repos/{owner}/{repo}/issues", {
      owner: "demo",
      repo: "project",
      title: "Unsent",
    }),
  ).rejects.toThrow("offline");
  expect(send).not.toHaveBeenCalled();
});

test("a delayed 401 from the previous token cannot expire a recovered session", async () => {
  useAuthStore.getState().setToken("old-token");
  spyOn(globalThis, "fetch").mockImplementation((async (_input: string | URL | Request) => {
    useAuthStore.getState().setToken("fresh-token");
    return new Response(JSON.stringify({ message: "Bad credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch);
  await expect(getGitHubClient().request("GET /user")).rejects.toMatchObject({ status: 401 });
  expect(useAuthStore.getState().expired).toBe(false);
  expect(useAuthStore.getState().token).toBe("fresh-token");
});

test("a rejected sign-in handoff keeps the expired session and cached page", async () => {
  useAuthStore.getState().setToken("kept-token");
  useAuthStore.getState().markExpired();
  queryClient.setQueryData(["page"], { body: "Cached reading" });
  spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
  await resumeSession("rejected-token");
  expect(useAuthStore.getState().token).toBe("kept-token");
  expect(useAuthStore.getState().expired).toBe(true);
  expect(queryClient.getQueryData<{ body: string }>(["page"])).toEqual({ body: "Cached reading" });
});

test("offline mutations fail before optimistic changes and never run on reconnect", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  useAuthStore.getState().setToken("test-token");
  onlineManager.setOnline(false);
  let changes = 0;
  let sends = 0;
  const mutation = queryClient.getMutationCache().build(queryClient, {
    onMutate: () => {
      changes += 1;
    },
    mutationFn: async () => {
      sends += 1;
    },
  });
  await expect(mutation.execute(undefined)).rejects.toThrow("offline");
  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();
  expect(changes).toBe(0);
  expect(sends).toBe(0);
});
