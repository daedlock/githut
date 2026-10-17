import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Env } from "./env";
import app from "./index";

const PREVIEW = "https://codex-pr-previews-githut.hossam-saraya.workers.dev";

// Previews run the same version config as production; only the host differs.
const env = {
  APP_URL: "https://githut.app",
  PREVIEW_HOST_SUFFIX: "githut.hossam-saraya.workers.dev",
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  OAUTH_STATE_SECRET: "state-secret",
} as unknown as Env;
const production = env;

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

/** Start a login on production and return the signed state GitHub would echo back. */
async function stateFor(returnTo?: string): Promise<string> {
  const q = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : "";
  const res = await app.request(`/api/auth/login${q}`, {}, production);
  const authorize = new URL(res.headers.get("Location")!);
  expect(authorize.origin).toBe("https://github.com");
  expect(authorize.searchParams.get("redirect_uri")).toBe("https://githut.app/api/auth/callback");
  return authorize.searchParams.get("state")!;
}

describe("PR preview sign-in", () => {
  test("a preview sends its login through production", async () => {
    const res = await app.request(`${PREVIEW}/api/auth/login`, {}, env);
    expect(res.status).toBe(302);
    const hop = new URL(res.headers.get("Location")!);
    expect(`${hop.origin}${hop.pathname}`).toBe("https://githut.app/api/auth/login");
    expect(hop.searchParams.get("return_to")).toBe(PREVIEW);
  });

  test("production hands the token back to the preview", async () => {
    const state = await stateFor(PREVIEW);
    fetchSpy.mockResolvedValueOnce(Response.json({ access_token: "gho_test" }));
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, {}, production);
    expect(res.headers.get("Location")).toBe(`${PREVIEW}/#t=gho_test`);
  });

  test("errors during a preview login return to the preview", async () => {
    const state = await stateFor(PREVIEW);
    const res = await app.request(
      `/api/auth/callback?state=${state}&error=access_denied`,
      {},
      production,
    );
    expect(res.headers.get("Location")).toBe(`${PREVIEW}/login?error=access_denied`);
  });

  test("a lookalike host never receives the token", async () => {
    const state = await stateFor("https://main-githut.attacker.workers.dev");
    fetchSpy.mockResolvedValueOnce(Response.json({ access_token: "gho_test" }));
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, {}, production);
    expect(res.headers.get("Location")).toBe("https://githut.app/#t=gho_test");
  });

  test("a localhost login is unaffected", async () => {
    const local = { ...env, APP_URL: "http://localhost:5173" } as unknown as Env;
    const res = await app.request("http://localhost:8787/api/auth/login", {}, local);
    expect(new URL(res.headers.get("Location")!).origin).toBe("https://github.com");
  });

  test("a normal production login is unchanged", async () => {
    const state = await stateFor();
    fetchSpy.mockResolvedValueOnce(Response.json({ access_token: "gho_test" }));
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, {}, production);
    expect(res.headers.get("Location")).toBe("https://githut.app/#t=gho_test");
  });

  test("a tampered state is rejected", async () => {
    const state = await stateFor(PREVIEW);
    const [nonce, issued, , sig] = state.split(".");
    const forged = `${nonce}.${issued}.${btoa("https://evil.example").replace(/=+$/, "")}.${sig}`;
    const res = await app.request(`/api/auth/callback?state=${forged}&code=abc`, {}, production);
    expect(res.headers.get("Location")).toBe("https://githut.app/login?error=bad_state");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
