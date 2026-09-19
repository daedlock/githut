import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GithubMarkdown } from "./GithubMarkdown";

function render(markdown: string) {
  return renderToStaticMarkup(<GithubMarkdown>{markdown}</GithubMarkdown>);
}

describe("comment videos", () => {
  test.each([
    "https://example.com/demo.mp4",
    "https://example.com/demo.WEBM?download=1#t=2",
    "https://user-images.githubusercontent.com/123/demo.mov",
    "https://github.com/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef",
    "https://github.com/daedlock/githut/assets/123/01234567-89ab-cdef-0123-456789abcdef",
  ])("embeds %s with native playback and fullscreen controls", (url) => {
    const html = render(url);
    expect(html).toContain("<video");
    expect(html).toContain(`src="${url.replaceAll("&", "&amp;")}"`);
    expect(html).toContain('controls=""');
    expect(html).toContain('playsInline=""');
    expect(html).toContain('preload="metadata"');
    expect(html).not.toContain("autoPlay");
    expect(html).not.toContain("nofullscreen");
  });

  test("embeds named video links and keeps their accessible fallback", () => {
    const html = render("[Screen recording](https://example.com/demo.mp4)");
    expect(html).toContain("<video");
    expect(html).toContain('href="https://example.com/demo.mp4"');
    expect(html).toContain("Screen recording");
  });

  test("leaves ordinary links, images, and inline code alone", () => {
    const html = render(
      [
        "[Docs](https://example.com/docs?file=demo.mp4)",
        "[File](https://github.com/user-attachments/files/123/report.pdf)",
        "![Image](https://example.com/image.png)",
        "`https://example.com/demo.mp4`",
      ].join("\n\n"),
    );
    expect(html).not.toContain("<video");
    expect(html).toContain("<img");
    expect(html).toContain("<code");
    expect(html).toContain(">Docs</a>");
    expect(html).toContain(">File</a>");
  });

  test("supports sanitized HTML videos without enabling scripts or autoplay", () => {
    const html = render(
      '<video src="https://example.com/demo.mp4" autoplay onerror="alert(1)"></video>',
    );
    expect(html).toContain("<video");
    expect(html).toContain('controls=""');
    expect(html).not.toMatch(/autoplay|onerror|alert\(/i);
    expect(render('<video src="javascript:alert(1)"></video>')).not.toContain("javascript:");
    expect(
      render('<video src="https://example.com/demo.mp4" poster="javascript:alert(1)"></video>'),
    ).not.toContain("javascript:");
  });

  test("keeps linked thumbnails intact", () => {
    const html = render(
      "[![Watch demo](https://example.com/poster.png)](https://example.com/demo.mp4)",
    );
    expect(html).not.toContain("<video");
    expect(html).toContain('<img src="https://example.com/poster.png"');
  });

  test("resolves repository-relative video assets", () => {
    const html = renderToStaticMarkup(
      <GithubMarkdown
        assetContext={{ owner: "daedlock", repo: "githut", ref: "main", basePath: "docs" }}
      >
        {"[Demo](./media/demo.mp4)"}
      </GithubMarkdown>,
    );
    expect(html).toContain(
      'src="https://raw.githubusercontent.com/daedlock/githut/main/docs/media/demo.mp4"',
    );
  });
});
