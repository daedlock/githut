import { AppWindow, Columns2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { internalLinkHref, linkIslandId, openInNewTab, openToSide } from "@/app/lib/tabActions";

// ─── LinkHoverMenu ─────────────────────────────────────────────────────────
//
// Rest the pointer on any in-app link for a moment and a small action menu
// appears under the cursor. Moving across links doesn't trigger it — the
// pointer has to settle — so it stays out of the way while scanning lists.
//
// Row-sized links (whole list rows) only count while the pointer is on their
// actual content (text or an image), not on the row's empty space, and a
// drag never ends with the menu opening under the drop point.
//
// Opt out on a subtree with `data-link-menu="off"`. Links that are already
// Radix triggers (hover cards, tooltips) are skipped so overlays don't stack.

const REST_MS = 750;
const MOVE_TOLERANCE = 6;
const LEAVE_GRACE_MS = 180;

type Target = { href: string; islandId?: string };

export function LinkHoverMenu() {
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef({ getBoundingClientRect: () => new DOMRect() });
  const overMenu = useRef(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    let link: HTMLAnchorElement | null = null;
    let restTimer: ReturnType<typeof setTimeout> | undefined;
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    let origin = { x: 0, y: 0 };
    let isOpen = false;
    let down: { x: number; y: number } | null = null;
    // The link under the pointer when a drag ended; ignored until it's left.
    let suppressed: HTMLAnchorElement | null = null;

    const close = () => {
      clearTimeout(restTimer);
      clearTimeout(leaveTimer);
      if (!isOpen) return;
      isOpen = false;
      setOpen(false);
    };

    const arm = (x: number, y: number) => {
      clearTimeout(restTimer);
      origin = { x, y };
      restTimer = setTimeout(() => {
        const href = link && internalLinkHref(link);
        if (!href || !link || !overLinkContent(link, origin.x, origin.y)) return;
        anchorRef.current = { getBoundingClientRect: () => new DOMRect(origin.x, origin.y, 0, 0) };
        isOpen = true;
        setTarget({ href, islandId: linkIslandId(link) });
        setOpen(true);
      }, REST_MS);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return;
      const next = eligibleLink(e.target);
      if (next === link) return;
      if (next !== suppressed) suppressed = null;
      if (next && next === suppressed) return;
      link = next;
      if (!link) return clearTimeout(restTimer);
      // Slid straight onto another link: retarget instead of keeping a stale menu.
      if (isOpen) close();
      arm(e.clientX, e.clientY);
    };

    const onMove = (e: PointerEvent) => {
      if (!link || isOpen || e.pointerType !== "mouse") return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE) {
        arm(e.clientX, e.clientY);
      }
    };

    const onOut = (e: PointerEvent) => {
      if (!link || link.contains(e.relatedTarget as Node | null)) return;
      link = null;
      clearTimeout(restTimer);
      if (isOpen) {
        leaveTimer = setTimeout(() => {
          if (!overMenu.current) close();
        }, LEAVE_GRACE_MS);
      }
    };

    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) {
        suppressed = eligibleLink(document.elementFromPoint(e.clientX, e.clientY));
        link = null;
        close();
      }
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      // Clicking the link (or anything) means the user made their choice.
      if (!(e.target instanceof Element && e.target.closest("[data-link-menu-content]"))) {
        link = null;
        close();
      }
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("blur", close);
    // The menu's own leave/dismiss handlers close through this.
    closeRef.current = close;
    return () => {
      close();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("blur", close);
    };
  }, []);

  if (!target) return null;

  return (
    <Popover open={open} onOpenChange={(next) => !next && closeRef.current()}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        data-link-menu-content
        side="bottom"
        align="start"
        sideOffset={14}
        collisionPadding={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={() => {
          overMenu.current = true;
        }}
        onPointerLeave={() => {
          overMenu.current = false;
          closeRef.current();
        }}
        className="w-auto min-w-48 gap-0 p-1 text-ui"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            closeRef.current();
            openInNewTab(target.href, { islandId: target.islandId });
          }}
          className="justify-start gap-2 text-left"
        >
          <AppWindow aria-hidden data-icon="inline-start" />
          <span className="flex-1">Open in new tab</span>
          <Kbd>⇧ Click</Kbd>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            closeRef.current();
            openToSide(target.href, target.islandId);
          }}
          className="justify-start gap-2 text-left"
        >
          <Columns2 aria-hidden data-icon="inline-start" />
          <span className="flex-1">Open to the side</span>
          <Kbd>Alt Click</Kbd>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function eligibleLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const a = target.closest<HTMLAnchorElement>("a[href]");
  if (!a || !internalLinkHref(a)) return null;
  if (a.hasAttribute("data-state")) return null;
  if (a.closest('[data-link-menu="off"], [data-radix-popper-content-wrapper], [role="menu"]')) {
    return null;
  }
  return a;
}

/**
 * Inline links always qualify. A row-sized link qualifies only while the
 * point is over its text or an image, not the row's padding or empty space.
 */
function overLinkContent(link: HTMLAnchorElement, x: number, y: number): boolean {
  const box = link.getBoundingClientRect();
  if (box.height <= 32 && box.width <= 480) return true;
  const hit = document.elementFromPoint(x, y);
  if (!hit || !link.contains(hit)) return false;
  if (hit.closest("img, svg, picture")) return true;
  const walker = document.createTreeWalker(hit, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
  }
  return false;
}
