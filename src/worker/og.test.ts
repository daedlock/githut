import { afterEach, expect, mock, test } from "bun:test";
import { fetchGitHubMeta, githubPathFor, injectMeta, isLinkPreviewBot } from "./og";

const path = (u: string) => githubPathFor(new URL(u, "https://githut.app"));

test("maps GitHut routes to the matching github.com page", () => {
  expect(path("/gaearon")).toBe("/gaearon");
  expect(path("/react/react")).toBe("/react/react");
  expect(path("/react/react/pull/31000/commits")).toBe("/react/react/pull/31000");
  expect(path("/react/react/pr/31000/code")).toBe("/react/react/pull/31000");
  expect(path("/react/react/review/7")).toBe("/react/react/pull/7");
  expect(path("/react/react/pulls")).toBe("/react/react/pulls");
  expect(path("/react/react/issues/5")).toBe("/react/react/issues/5");
  expect(path("/react/react/commit/abc123")).toBe("/react/react/commit/abc123");
  expect(path("/react/react/actions/runs/99")).toBe("/react/react/actions/runs/99");
  expect(path("/react/react/code?path=packages/react&branch=main")).toBe(
    "/react/react/tree/main/packages/react",
  );
  expect(path("/react/react/code?path=README.md&view=blob")).toBe(
    "/react/react/blob/HEAD/README.md",
  );
});

test("skips app routes and static files", () => {
  expect(path("/")).toBeNull();
  expect(path("/settings")).toBeNull();
  expect(path("/login")).toBeNull();
  expect(path("/robots.txt")).toBeNull();
});

test("detects link-preview crawlers, not browsers", () => {
  expect(isLinkPreviewBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
  expect(
    isLinkPreviewBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"),
  ).toBe(true);
  expect(isLinkPreviewBot("facebookexternalhit/1.1")).toBe(true);
  expect(isLinkPreviewBot("Twitterbot/1.0")).toBe(true);
  expect(
    isLinkPreviewBot(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    ),
  ).toBe(false);
  expect(isLinkPreviewBot(null)).toBe(false);
});

const GITHUB_HEAD = `<!DOCTYPE html><html><head>
<title>Fix &quot;thing&quot; by someone · Pull Request #7 · acme/widgets · GitHub</title>
<meta name="description" content="Fixes the thing." />
<meta name="twitter:site" content="@github" />
<meta name="twitter:card" content="summary_large_image" />
<meta property="og:image" content="https://opengraph.githubassets.com/abc/acme/widgets/pull/7" />
<meta property="og:site_name" content="GitHub" />
<meta property="og:title" content="Fix &quot;thing&quot; by someone · Pull Request #7 · acme/widgets" />
<meta property="og:url" content="https://github.com/acme/widgets/pull/7" />
</head><body>${"x".repeat(1000)}</body></html>`;

const SHELL = `<!doctype html><html><head><title>GitHut</title>
<meta property="og:title" content="GitHut" />
<meta property="og:image" content="https://githut.app/og.png" />
<meta property="og:url" content="https://githut.app" />
<meta name="twitter:card" content="summary_large_image" />
</head><body><div id="root"></div></body></html>`;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("lifts GitHub's tags into the shell, pointing og:url at GitHut", async () => {
  globalThis.fetch = mock(async () => new Response(GITHUB_HEAD)) as unknown as typeof fetch;
  const meta = await fetchGitHubMeta("/acme/widgets/pull/7");
  expect(meta).not.toBeNull();
  if (!meta) return;

  const html = await injectMeta(
    new Response(SHELL, { headers: { "Content-Type": "text/html" } }),
    meta,
    "https://githut.app/acme/widgets/pull/7",
  ).text();

  expect(html).toContain(
    '<title>Fix "thing" by someone · Pull Request #7 · acme/widgets · GitHut</title>',
  );
  expect(html).toContain('content="https://opengraph.githubassets.com/abc/acme/widgets/pull/7"');
  expect(html).toContain(
    'content="Fix &quot;thing&quot; by someone · Pull Request #7 · acme/widgets"',
  );
  expect(html).toContain(
    '<meta property="og:url" content="https://githut.app/acme/widgets/pull/7" />',
  );
  expect(html).toContain('<meta property="og:site_name" content="GitHut" />');
  expect(html).not.toContain("githut.app/og.png");
  expect(html).not.toContain("@github");
  expect(html.match(/property="og:title"/g)).toHaveLength(1);
  expect(html.match(/name="twitter:card"/g)).toHaveLength(1);
});

test("returns null when GitHub has no page (private or missing)", async () => {
  globalThis.fetch = mock(
    async () => new Response("Not Found", { status: 404 }),
  ) as unknown as typeof fetch;
  expect(await fetchGitHubMeta("/acme/secret")).toBeNull();
});
