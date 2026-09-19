import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import app from "./index";

const assetUrl = "https://github.com/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef";
const endpoint = `/api/github-image?url=${encodeURIComponent(assetUrl)}&token=test-token`;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("GitHub video delivery", () => {
  test("preserves range requests and partial responses through signed redirects", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://signed.example.com/video.mp4" },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response("clip", {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": "bytes 10-13/100",
          "Content-Length": "4",
          "Accept-Ranges": "bytes",
        },
      }),
    );
    const response = await app.request(endpoint, { headers: { Range: "bytes=10-13" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 10-13/100");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(await response.text()).toBe("clip");
    const firstHeaders = new Headers(fetchSpy.mock.calls[0]?.[1]?.headers);
    const redirectedHeaders = new Headers(fetchSpy.mock.calls[1]?.[1]?.headers);
    expect(firstHeaders.get("Authorization")).toBe("token test-token");
    expect(firstHeaders.get("Range")).toBe("bytes=10-13");
    expect(redirectedHeaders.get("Authorization")).toBeNull();
    expect(redirectedHeaders.get("Range")).toBe("bytes=10-13");
  });

  test("preserves inline partial responses and unsatisfiable ranges", async () => {
    for (const status of [206, 416]) {
      const contentRange = status === 206 ? "bytes 0-3/100" : "bytes */100";
      fetchSpy.mockResolvedValueOnce(
        new Response(status === 206 ? "clip" : null, {
          status,
          headers: { "Content-Range": contentRange, "Content-Type": "video/mp4" },
        }),
      );
      const response = await app.request(endpoint, { headers: { Range: "bytes=0-3" } });
      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Range")).toBe(contentRange);
    }
  });

  test("keeps ordinary image delivery working", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("image", { headers: { "Content-Type": "image/png" } }),
    );
    const response = await app.request(endpoint);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.text()).toBe("image");
  });
});
