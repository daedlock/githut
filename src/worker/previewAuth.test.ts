import { describe, expect, test } from "bun:test";
import { previewOrigin } from "./previewAuth";

const SUFFIX = "githut.daedlock.workers.dev";

describe("previewOrigin", () => {
  test("accepts our PR preview hosts", () => {
    expect(previewOrigin("https://pr-12-githut.daedlock.workers.dev", SUFFIX)).toBe(
      "https://pr-12-githut.daedlock.workers.dev",
    );
    expect(previewOrigin("https://PR-7-githut.daedlock.workers.dev/some/path?x=1", SUFFIX)).toBe(
      "https://pr-7-githut.daedlock.workers.dev",
    );
  });

  test("rejects other accounts, workers and lookalikes", () => {
    expect(previewOrigin("https://pr-12-githut.attacker.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://pr-12-other.daedlock.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://evil-pr-12-githut.daedlock.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://pr-12-githut.daedlock.workers.dev.evil.com", SUFFIX)).toBeNull();
    expect(previewOrigin("https://githut.daedlock.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://pr-x-githut.daedlock.workers.dev", SUFFIX)).toBeNull();
  });

  test("rejects non-https, ports, credentials and junk", () => {
    expect(previewOrigin("http://pr-12-githut.daedlock.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://pr-12-githut.daedlock.workers.dev:8443", SUFFIX)).toBeNull();
    expect(previewOrigin("https://a:b@pr-12-githut.daedlock.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("javascript:alert(1)", SUFFIX)).toBeNull();
    expect(previewOrigin("not a url", SUFFIX)).toBeNull();
    expect(previewOrigin(undefined, SUFFIX)).toBeNull();
  });

  test("is disabled without a configured suffix", () => {
    expect(previewOrigin("https://pr-12-githut.daedlock.workers.dev", undefined)).toBeNull();
    expect(previewOrigin("https://pr-12-githut.daedlock.workers.dev", "")).toBeNull();
  });
});
