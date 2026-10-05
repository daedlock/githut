import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/app/lib/cn";

const THRESHOLD = 400;
const DURATION = 280;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

type LightboxState =
  | { phase: "closed" }
  | { phase: "opening"; src: string; alt: string; rect: DOMRect }
  | { phase: "open"; src: string; alt: string; rect: DOMRect }
  | { phase: "closing"; src: string; alt: string; rect: DOMRect };

export function LightboxImage({
  src,
  alt,
  className,
  onLoad,
  onError,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<LightboxState>({ phase: "closed" });
  const [canLightbox, setCanLightbox] = useState(false);

  const isLightboxable = useCallback(() => {
    const el = imgRef.current;
    if (!el) return false;
    return (el.naturalWidth >= THRESHOLD || el.naturalHeight >= THRESHOLD) &&
           (el.offsetWidth >= THRESHOLD || el.offsetHeight >= THRESHOLD);
  }, []);

  const handleClick = useCallback(() => {
    const el = imgRef.current;
    if (!el || !isLightboxable()) return;
    const rect = el.getBoundingClientRect();
    setState({ phase: "opening", src: el.currentSrc || el.src, alt: alt ?? "", rect });
  }, [alt, isLightboxable]);

  const handleClose = useCallback(() => {
    if (state.phase !== "open") return;
    const el = imgRef.current;
    const rect = el?.getBoundingClientRect() ?? state.rect;
    setState({ phase: "closing", src: state.src, alt: state.alt, rect });
  }, [state]);

  const onOpened = useCallback(() => {
    if (state.phase === "opening") {
      setState((s) => (s.phase === "opening" ? { ...s, phase: "open" } : s));
    }
  }, [state.phase]);

  const onClosed = useCallback(() => {
    if (state.phase === "closing") {
      setState({ phase: "closed" });
    }
  }, [state.phase]);

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onClick={handleClick}
        onLoad={(event) => {
          setCanLightbox(isLightboxable());
          onLoad?.(event);
        }}
        onError={onError}
        data-lightbox
        className={cn(
          className,
          canLightbox && "cursor-zoom-in",
          "transition-opacity duration-150",
          (state.phase === "opening" || state.phase === "open") && "invisible",
        )}
        {...rest}
      />
      {state.phase !== "closed" &&
        createPortal(
          <Overlay
            state={state}
            onOpened={onOpened}
            onClosed={onClosed}
            onClose={handleClose}
          />,
          document.body,
        )}
    </>
  );
}

function Overlay({
  state,
  onOpened,
  onClosed,
  onClose,
}: {
  state: Exclude<LightboxState, { phase: "closed" }>;
  onOpened: () => void;
  onClosed: () => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Lock body scroll without layout shift
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
    };
  }, []);

  function applyTransform() {
    const img = imgRef.current;
    if (!img) return;
    img.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
    img.style.transformOrigin = "center center";
  }

  // Wheel zoom toward cursor
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const img = imgRef.current;
      if (!img || state.phase !== "open") return;

      const prevZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(Math.max(prevZoom * delta, 0.5), 5);
      zoomRef.current = nextZoom;

      // Zoom toward cursor: adjust pan so the point under the cursor stays fixed
      const rect = img.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const factor = 1 - nextZoom / prevZoom;
      panRef.current.x += dx * factor;
      panRef.current.y += dy * factor;

      // Clamp pan so image can't drift past viewport edges
      const scaledW = img.offsetWidth * nextZoom;
      const scaledH = img.offsetHeight * nextZoom;
      const maxX = scaledW > window.innerWidth ? (scaledW - window.innerWidth) / 2 : 0;
      const maxY = scaledH > window.innerHeight ? (scaledH - window.innerHeight) / 2 : 0;
      panRef.current.x = Math.min(maxX, Math.max(-maxX, panRef.current.x));
      panRef.current.y = Math.min(maxY, Math.max(-maxY, panRef.current.y));

      applyTransform();
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [state.phase]);

  // Click-drag pan
  useEffect(() => {
    if (state.phase !== "open") return;

    function onDown(e: PointerEvent) {
      if (e.button !== 0) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
      imgRef.current?.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      const img = imgRef.current;
      if (!img) return;

      const scaledW = img.offsetWidth * zoomRef.current;
      const scaledH = img.offsetHeight * zoomRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const canPanX = scaledW > vw;
      const canPanY = scaledH > vh;
      if (!canPanX && !canPanY) return;

      const rawX = dragRef.current.panX + (e.clientX - dragRef.current.startX);
      const rawY = dragRef.current.panY + (e.clientY - dragRef.current.startY);

      const maxX = canPanX ? (scaledW - vw) / 2 : 0;
      const maxY = canPanY ? (scaledH - vh) / 2 : 0;

      panRef.current.x = Math.min(maxX, Math.max(-maxX, rawX));
      panRef.current.y = Math.min(maxY, Math.max(-maxY, rawY));
      applyTransform();
    }
    function onUp() {
      dragRef.current = null;
    }

    const img = imgRef.current;
    if (!img) return;
    img.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      img.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [state.phase]);

  useEffect(() => {
    const img = imgRef.current;
    const backdrop = backdropRef.current;
    if (!img || !backdrop) return;

    if (state.phase === "opening") {
      const { rect, src } = state;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const padding = 48;
      const maxW = vw - padding * 2;
      const maxH = vh - padding * 2;

      const tempImg = new Image();
      tempImg.src = src;
      const natW = tempImg.naturalWidth || rect.width;
      const natH = tempImg.naturalHeight || rect.height;
      const scale = Math.min(maxW / natW, maxH / natH, 1);
      const finalW = natW * scale;
      const finalH = natH * scale;
      const finalX = (vw - finalW) / 2;
      const finalY = (vh - finalH) / 2;

      img.style.cssText = `
        position: fixed; z-index: 51;
        left: ${rect.left}px; top: ${rect.top}px;
        width: ${rect.width}px; height: ${rect.height}px;
        border-radius: var(--radius-sm);
        will-change: transform, width, height, left, top, border-radius;
      `;

      backdrop.style.opacity = "0";

      requestAnimationFrame(() => {
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURATION,
          easing: EASING,
          fill: "forwards",
        });

        const anim = img.animate(
          [
            {
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              borderRadius: "var(--radius-sm)",
            },
            {
              left: `${finalX}px`,
              top: `${finalY}px`,
              width: `${finalW}px`,
              height: `${finalH}px`,
              borderRadius: "8px",
            },
          ],
          { duration: DURATION, easing: EASING, fill: "forwards" },
        );
        anim.onfinish = onOpened;
      });
    }

    if (state.phase === "closing") {
      const { rect } = state;

      // Reset zoom + pan before morph-back
      img.style.transform = "";
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };

      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: DURATION * 0.8,
        easing: EASING,
        fill: "forwards",
      });

      const currentRect = img.getBoundingClientRect();
      const anim = img.animate(
        [
          {
            left: `${currentRect.left}px`,
            top: `${currentRect.top}px`,
            width: `${currentRect.width}px`,
            height: `${currentRect.height}px`,
            borderRadius: "8px",
          },
          {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            borderRadius: "var(--radius-sm)",
          },
        ],
        { duration: DURATION * 0.8, easing: EASING, fill: "forwards" },
      );
      anim.onfinish = onClosed;
    }
  }, [state, onOpened, onClosed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[var(--color-bg)]/90 backdrop-blur-sm"
        style={{ opacity: state.phase === "open" ? 1 : undefined }}
      />

      {/* Close button */}
      {state.phase === "open" && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "fixed top-4 right-4 z-[52] rounded-full p-2",
            "bg-[var(--color-bg-sunken)] text-[var(--color-fg-muted)]",
            "transition-all duration-150 hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]",
            "animate-in fade-in-0 duration-200",
          )}
        >
          <X className="size-5" />
        </button>
      )}

      {/* Morphing image */}
      <img
        ref={imgRef}
        src={state.src}
        alt={state.alt}
        draggable={false}
        className="pointer-events-auto cursor-grab active:cursor-grabbing object-contain select-none"
        style={{ position: "fixed", zIndex: 51 }}
      />
    </>
  );
}
