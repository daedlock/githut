import { describe, expect, test } from "bun:test";
import { previewOrigin } from "./previewAuth";

const ZONE = "githut.app";

describe("previewOrigin", () => {
  test("accepts preview and deployment hosts under our zone", () => {
    expect(previewOrigin("https://codex-pr-previews.githut.app", ZONE)).toBe(
      "https://codex-pr-previews.githut.app",
    );
    expect(previewOrigin("https://0b7a6f96-codex-pr-previews.githut.app/a?b=1", ZONE)).toBe(
      "https://0b7a6f96-codex-pr-previews.githut.app",
    );
  });

  test("rejects production, other zones, nested hosts and lookalikes", () => {
    expect(previewOrigin("https://githut.app", ZONE)).toBeNull();
    expect(previewOrigin("https://main.evilgithut.app", ZONE)).toBeNull();
    expect(previewOrigin("https://main.githut.app.evil.com", ZONE)).toBeNull();
    expect(previewOrigin("https://a.b.githut.app", ZONE)).toBeNull();
    expect(previewOrigin("https://main-githut.hossam-saraya.workers.dev", ZONE)).toBeNull();
  });

  test("rejects non-https, ports, credentials and junk", () => {
    expect(previewOrigin("http://main.githut.app", ZONE)).toBeNull();
    expect(previewOrigin("https://main.githut.app:8443", ZONE)).toBeNull();
    expect(previewOrigin("https://a:b@main.githut.app", ZONE)).toBeNull();
    expect(previewOrigin("javascript:alert(1)", ZONE)).toBeNull();
    expect(previewOrigin(undefined, ZONE)).toBeNull();
  });

  test("is disabled without a configured zone", () => {
    expect(previewOrigin("https://main.githut.app", undefined)).toBeNull();
  });
});
