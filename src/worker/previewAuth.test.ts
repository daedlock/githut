import { describe, expect, test } from "bun:test";
import { previewOrigin } from "./previewAuth";

const SUFFIX = "githut.hossam-saraya.workers.dev";

describe("previewOrigin", () => {
  test("accepts our preview hosts, whatever the alias", () => {
    expect(
      previewOrigin("https://codex-pr-previews-githut.hossam-saraya.workers.dev", SUFFIX),
    ).toBe("https://codex-pr-previews-githut.hossam-saraya.workers.dev");
    expect(previewOrigin("https://0b7a6f96-githut.hossam-saraya.workers.dev/a?b=1", SUFFIX)).toBe(
      "https://0b7a6f96-githut.hossam-saraya.workers.dev",
    );
  });

  test("rejects other accounts, other workers, production and lookalikes", () => {
    expect(previewOrigin("https://main-githut.attacker.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://main-other.hossam-saraya.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://githut.hossam-saraya.workers.dev", SUFFIX)).toBeNull();
    expect(
      previewOrigin("https://main-githut.hossam-saraya.workers.dev.evil.com", SUFFIX),
    ).toBeNull();
    expect(previewOrigin("https://a.b-githut.hossam-saraya.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://githut.app", SUFFIX)).toBeNull();
  });

  test("rejects non-https, ports, credentials and junk", () => {
    expect(previewOrigin("http://main-githut.hossam-saraya.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("https://main-githut.hossam-saraya.workers.dev:8443", SUFFIX)).toBeNull();
    expect(previewOrigin("https://a:b@main-githut.hossam-saraya.workers.dev", SUFFIX)).toBeNull();
    expect(previewOrigin("javascript:alert(1)", SUFFIX)).toBeNull();
    expect(previewOrigin(undefined, SUFFIX)).toBeNull();
  });

  test("is disabled without a configured suffix", () => {
    expect(previewOrigin("https://main-githut.hossam-saraya.workers.dev", undefined)).toBeNull();
  });
});
