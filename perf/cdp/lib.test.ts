import { expect, test } from "bun:test";
import { discoverTargets } from "./lib.mjs";

test("CDP discovery falls back to IPv6 after non-JSON IPv4 and keeps the port", async () => {
  const urls: string[] = [];
  const targets = [{ type: "page", url: "http://localhost:4173" }];
  const result = await discoverTargets("http://127.0.0.1:9333", async (url: string) => {
    urls.push(url);
    return urls.length === 1 ? new Response("") : Response.json(targets);
  });
  expect(result).toEqual(targets);
  expect(urls).toEqual(["http://127.0.0.1:9333/json/list", "http://[::1]:9333/json/list"]);
});

test("CDP discovery reports actionable failures instead of a JSON parse exception", async () => {
  await expect(
    discoverTargets("http://[::1]:9333", async () => new Response("", { status: 404 })),
  ).rejects.toThrow("Check --remote-debugging-port and PERF_CDP");
});
