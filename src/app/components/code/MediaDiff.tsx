import { type CSSProperties, type ReactNode, useState } from "react";
import { LightboxImage } from "@/app/components/ui/ImageLightbox";
import { cn } from "@/app/lib/cn";
import { extensionOf, type MediaKind } from "@/app/lib/github/media";
import type { FileStatus } from "./FileDiff";

export type MediaSource = {
  /** URL the browser can load — proxied through the worker when the session has a token. */
  src: string;
  /** Link to the file on GitHub, offered when the preview cannot be loaded. */
  href: string;
  /** Ref the bytes are read from; shown as a short label. */
  ref: string;
  path: string;
};

export type MediaDiffProps = {
  kind: MediaKind;
  status: FileStatus;
  before?: MediaSource;
  after?: MediaSource;
  className?: string;
};

type Tone = "add" | "del";

/**
 * Before/after preview for media in a diff. Panes sit side by side (stacked
 * on narrow screens); added and removed files render a single pane.
 */
export function MediaDiff({ kind, status, before, after, className }: MediaDiffProps) {
  const panes: Array<{ key: string; source: MediaSource; label: string; tone: Tone }> = [];
  if (before) {
    panes.push({
      key: "before",
      source: before,
      label: status === "removed" ? "Removed" : "Before",
      tone: "del",
    });
  }
  if (after) {
    panes.push({
      key: "after",
      source: after,
      label: status === "added" ? "Added" : "After",
      tone: "add",
    });
  }
  if (panes.length === 0) return null;

  return (
    <div className={cn("flex flex-col md:flex-row", className)} data-media-kind={kind}>
      {panes.map((pane, index) => (
        <MediaPane
          key={pane.key}
          kind={kind}
          source={pane.source}
          label={pane.label}
          tone={pane.tone}
          className={cn(index > 0 && "border-t border-border md:border-t-0 md:border-l")}
        />
      ))}
    </div>
  );
}

function MediaPane({
  kind,
  source,
  label,
  tone,
  className,
}: {
  kind: MediaKind;
  source: MediaSource;
  label: string;
  tone: Tone;
  className?: string;
}) {
  const [meta, setMeta] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const alt = `${label}: ${source.path}`;

  let body: ReactNode;
  if (failed) {
    body = <PreviewFallback href={source.href} />;
  } else if (kind === "image") {
    // Most SVG icons carry only a viewBox, so they have no intrinsic size and
    // would collapse to nothing. Give them a fixed height and let the viewBox
    // ratio pick the width; rasters keep their natural size, capped.
    const isSvg = extensionOf(source.path) === "svg";
    body = (
      <span className="inline-block max-w-full overflow-hidden rounded-md" style={CHECKERBOARD}>
        <LightboxImage
          src={source.src}
          alt={alt}
          className={cn("block max-w-full object-contain", isSvg ? "h-60 w-auto" : "max-h-[420px]")}
          onLoad={(event) => {
            // Browsers report a made-up 150×150 for viewBox-only SVGs, so
            // dimensions are only meaningful for rasters.
            if (isSvg) return;
            const img = event.currentTarget;
            setMeta(`${img.naturalWidth} × ${img.naturalHeight}`);
          }}
          onError={() => setFailed(true)}
        />
      </span>
    );
  } else if (kind === "video") {
    body = (
      // biome-ignore lint/a11y/useMediaCaption: repository media has no caption tracks.
      <video
        src={source.src}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className="max-h-[420px] w-full rounded-md bg-[var(--color-bg-sunken)] object-contain"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setMeta(`${video.videoWidth} × ${video.videoHeight}`);
        }}
        onError={() => setFailed(true)}
      />
    );
  } else {
    body = (
      // biome-ignore lint/a11y/useMediaCaption: repository media has no caption tracks.
      <audio
        src={source.src}
        controls
        preload="metadata"
        aria-label={alt}
        className="w-full max-w-md"
        onLoadedMetadata={(event) => setMeta(formatDuration(event.currentTarget.duration))}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <figure className={cn("flex min-w-0 flex-1 flex-col", className)}>
      <figcaption className="flex h-8 shrink-0 items-center gap-2 bg-muted px-3 font-mono text-caption text-muted-foreground">
        <span
          className={cn(
            "font-medium",
            tone === "add" ? "text-[var(--diff-add-marker)]" : "text-[var(--diff-del-marker)]",
          )}
        >
          {label}
        </span>
        <span className="truncate text-[var(--color-fg-faint)]" title={source.ref}>
          {shortRef(source.ref)}
        </span>
        {meta && <span className="ml-auto shrink-0 tabular-nums">{meta}</span>}
      </figcaption>
      <div className="flex min-h-32 flex-1 items-center justify-center p-4">{body}</div>
    </figure>
  );
}

function PreviewFallback({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center text-ui text-muted-foreground">
      <span>Preview unavailable</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-caption text-primary hover:underline"
      >
        Open on GitHub
      </a>
    </div>
  );
}

// Subtle checkerboard so transparent regions read as transparent rather than
// blending into the surface. Both tints come from the palette, so it follows
// the theme.
const CHECKERBOARD: CSSProperties = {
  backgroundColor: "var(--color-code-bg)",
  backgroundImage: "repeating-conic-gradient(var(--color-bg-sunken) 0% 25%, transparent 0% 50%)",
  backgroundSize: "16px 16px",
};

function shortRef(ref: string): string {
  return /^[a-f0-9]{40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
