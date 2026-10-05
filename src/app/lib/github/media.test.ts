import { afterEach, describe, expect, test } from "bun:test";
import { useAuthStore } from "@/app/stores/auth";
import {
  githubBlobUrl,
  isBinaryPath,
  mediaKindForPath,
  proxyGitHubImage,
  rawFileUrl,
} from "./media";

describe("mediaKindForPath", () => {
  test("classifies by extension, case-insensitively", () => {
    expect(mediaKindForPath("public/logo.png")).toBe("image");
    expect(mediaKindForPath("assets/Icon.SVG")).toBe("image");
    expect(mediaKindForPath("docs/demo.mp4")).toBe("video");
    expect(mediaKindForPath("sounds/ding.flac")).toBe("audio");
  });

  test("returns null for text files and extension-less names", () => {
    expect(mediaKindForPath("src/app.ts")).toBeNull();
    expect(mediaKindForPath("Dockerfile")).toBeNull();
    expect(mediaKindForPath(".png")).toBeNull();
  });
});

describe("isBinaryPath", () => {
  test("treats media, fonts, and archives as binary but keeps SVG textual", () => {
    expect(isBinaryPath("a/b.png")).toBe(true);
    expect(isBinaryPath("fonts/Inter.woff2")).toBe(true);
    expect(isBinaryPath("dist/bundle.zip")).toBe(true);
    expect(isBinaryPath("icons/arrow.svg")).toBe(false);
    expect(isBinaryPath("src/index.tsx")).toBe(false);
  });
});

describe("GitHub file URLs", () => {
  test("encodes path segments but keeps slashes in refs and paths", () => {
    expect(rawFileUrl("acme", "app", "feature/x", "dir/my file.png")).toBe(
      "https://raw.githubusercontent.com/acme/app/feature/x/dir/my%20file.png",
    );
    expect(githubBlobUrl("acme", "app", "main", "docs/a#b.gif")).toBe(
      "https://github.com/acme/app/blob/main/docs/a%23b.gif",
    );
  });
});

describe("proxyGitHubImage", () => {
  afterEach(() => useAuthStore.setState({ token: null }));

  test("passes URLs through when there is no session token", () => {
    const url = "https://raw.githubusercontent.com/acme/app/main/logo.png";
    expect(proxyGitHubImage(url)).toBe(url);
  });

  test("routes GitHub hosts through the worker proxy with the token", () => {
    useAuthStore.setState({ token: "tok" });
    const url = "https://raw.githubusercontent.com/acme/app/main/logo.png";
    expect(proxyGitHubImage(url)).toBe(
      `/api/github-image?url=${encodeURIComponent(url)}&token=tok`,
    );
    expect(proxyGitHubImage("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});
