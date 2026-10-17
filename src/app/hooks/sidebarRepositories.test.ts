import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { clearETagCache } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";
import { fetchYourRepositories } from "./sidebarRepositories";

afterEach(() => {
  mock.restore();
  clearETagCache();
  useAuthStore.getState().clear();
});
test("Your repos requests only owned/direct collaborator access, one page at a time", async () => {
  useAuthStore.getState().setToken("sidebar-pagination");
  const requests: URL[] = [];
  spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    const second = url.searchParams.get("page") === "2";
    return new Response(
      JSON.stringify(
        second
          ? [
              { id: 1, name: "owned", full_name: "me/owned" },
              { id: 2, name: "direct", full_name: "org/direct" },
            ]
          : [{ id: 1, name: "owned", full_name: "me/owned" }],
      ),
      {
        headers: {
          "content-type": "application/json",
          ...(!second ? { link: '<https://api.github.com/user/repos?page=2>; rel="next"' } : {}),
        },
      },
    );
  }) as typeof fetch);
  const first = await fetchYourRepositories();
  expect(first.items.map((repo) => repo.full_name)).toEqual(["me/owned"]);
  expect(first.next).toBe(2);
  expect(requests).toHaveLength(1);
  const second = await fetchYourRepositories(2);
  expect(second.items.map((repo) => repo.full_name)).toEqual(["me/owned", "org/direct"]);
  expect(second.next).toBeNull();
  expect(requests).toHaveLength(2);
  expect(requests.every((url) => url.searchParams.get("per_page") === "30")).toBe(true);
  expect(
    requests.every((url) => url.searchParams.get("affiliation") === "owner,collaborator"),
  ).toBe(true);
});
