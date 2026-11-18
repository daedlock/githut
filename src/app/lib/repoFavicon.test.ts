import { describe, expect, test } from "bun:test";
import {
  buildFaviconQuery,
  FAVICON_PATHS,
  faviconDataUrl,
  faviconVariables,
  HIT_TTL_MS,
  isFresh,
  MAX_FAVICON_BYTES,
  MISS_TTL_MS,
  parseRepo,
  pickFavicon,
} from "@/app/lib/repoFavicon";

const at = (path: string) => `p${FAVICON_PATHS.indexOf(path)}`;

describe("parseRepo", () => {
  test("accepts owner/name only", () => {
    expect(parseRepo("daedlock/githut")).toEqual({ owner: "daedlock", name: "githut" });
    expect(parseRepo("daedlock")).toBeNull();
    expect(parseRepo("a/b/c")).toBeNull();
    expect(parseRepo("/b")).toBeNull();
  });
});

describe("buildFaviconQuery", () => {
  test("asks every repo for every candidate path, owners as variables", () => {
    const query = buildFaviconQuery(2);
    expect(query).toContain(
      "query RepoFavicons($o0: String!, $n0: String!, $o1: String!, $n1: String!)",
    );
    expect(query).toContain("r0: repository(owner: $o0, name: $n0)");
    expect(query).toContain("r1: repository(owner: $o1, name: $n1)");
    expect(query).toContain('p0: object(expression: "HEAD:favicon.svg") { ...F }');
    expect(query.match(/object\(expression:/g)).toHaveLength(FAVICON_PATHS.length * 2);
    expect(query).toContain("fragment F on GitObject { ... on Blob { oid byteSize } }");
  });

  test("variables pair with the aliases", () => {
    expect(
      faviconVariables([
        { owner: "a", name: "b" },
        { owner: "c", name: "d" },
      ]),
    ).toEqual({ o0: "a", n0: "b", o1: "c", n1: "d" });
  });
});

describe("pickFavicon", () => {
  test("takes the first candidate in preference order", () => {
    expect(
      pickFavicon({
        [at("public/favicon.ico")]: { oid: "ico", byteSize: 4000 },
        [at("favicon.png")]: { oid: "png", byteSize: 900 },
      }),
    ).toEqual({ path: "favicon.png", oid: "png" });
  });

  test("skips empty and oversized files", () => {
    expect(
      pickFavicon({
        [at("favicon.svg")]: { oid: "empty", byteSize: 0 },
        [at("favicon.ico")]: { oid: "huge", byteSize: MAX_FAVICON_BYTES + 1 },
        [at("public/favicon.svg")]: { oid: "ok", byteSize: MAX_FAVICON_BYTES },
      }),
    ).toEqual({ path: "public/favicon.svg", oid: "ok" });
  });

  test("no repo, no candidates, or only trees: none", () => {
    expect(pickFavicon(null)).toBeNull();
    expect(pickFavicon({})).toBeNull();
    // A directory named like a candidate resolves to a Tree, which the fragment leaves empty.
    expect(pickFavicon({ [at("favicon.ico")]: {} as never })).toBeNull();
  });
});

describe("faviconDataUrl", () => {
  test("labels the bytes by extension and strips GitHub's line wrapping", () => {
    expect(faviconDataUrl("public/favicon.svg", "PHN2\nZz4=\n")).toBe(
      "data:image/svg+xml;base64,PHN2Zz4=",
    );
    expect(faviconDataUrl("favicon.ico", "AAA=")).toBe("data:image/x-icon;base64,AAA=");
    expect(faviconDataUrl("app/icon.png", "AAA=")).toBe("data:image/png;base64,AAA=");
  });
});

describe("isFresh", () => {
  test("hits live longer than misses", () => {
    const now = 1_000_000_000_000;
    const hit = { src: "data:image/png;base64,AAA=", oid: "x", checkedAt: now - MISS_TTL_MS - 1 };
    const miss = { src: null, oid: null, checkedAt: now - MISS_TTL_MS - 1 };
    expect(isFresh(hit, now)).toBe(true);
    expect(isFresh(miss, now)).toBe(false);
    expect(isFresh({ ...hit, checkedAt: now - HIT_TTL_MS }, now)).toBe(false);
  });
});
