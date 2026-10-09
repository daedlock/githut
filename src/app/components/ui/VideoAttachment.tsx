import { type ReactNode, useState } from "react";

export function isVideoAttachment(href: string): boolean {
  try {
    const url = new URL(href, "https://markdown.invalid");
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(url.pathname)) return true;
    // GitHub uploads have no extension. Non-video attachments fall back to a link.
    return (
      url.hostname === "github.com" &&
      /^\/(?:user-attachments\/assets|[^/]+\/[^/]+\/assets\/\d+)\/[\da-f-]{36}\/?$/i.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function VideoAttachment({
  src,
  href,
  children,
  poster,
}: {
  src: string;
  href: string;
  children?: ReactNode;
  poster?: string;
}) {
  const [failed, setFailed] = useState(false);
  const link = (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children || "Open video"}
    </a>
  );

  if (failed) return link;

  // A span keeps the Markdown paragraph's HTML valid, including inline links.
  return (
    <span className="my-3 block max-w-full">
      {/* biome-ignore lint/a11y/useMediaCaption: User attachments do not provide caption tracks. */}
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label="Video attachment"
        onError={() => setFailed(true)}
        className="block max-h-[480px] w-full rounded-lg bg-black object-contain [&:fullscreen]:h-full [&:fullscreen]:max-h-none"
      >
        {link}
      </video>
      <span className="mt-1 block break-all text-caption text-muted-foreground">{link}</span>
    </span>
  );
}
