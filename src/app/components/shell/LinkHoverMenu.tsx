import { AppWindow } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Kbd } from "@/app/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { internalLinkHref, openInNewTab } from "@/app/lib/tabActions";
import { useSettingsStore } from "@/app/stores/settings";

// ─── LinkHoverMenu ─────────────────────────────────────────────────────────
//
// Rest the pointer on any in-app link for a moment and a small action menu
// appears under the cursor. Moving across links doesn't trigger it — the
// pointer has to settle — so it stays out of the way while scanning lists.
//
// Opt out on a subtree with `data-link-menu="off"`. Links that are already
// Radix triggers (hover cards, tooltips) are skipped so overlays don't stack.

const REST_MS = 900;
const MOVE_TOLERANCE = 6;
const LEAVE_GRACE_MS = 180;

type Target = { href: string; x: number; y: number };

export function LinkHoverMenu() {
  const enabled = useSettingsStore((s) => s.tabsEnabled);
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef({ getBoundingClientRect: () => new DOMRect() });
  const overMenu = useRef(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;

    let link: HTMLAnchorElement | null = null;
    let restTimer: ReturnType<typeof setTimeout> | undefined;
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    let origin = { x: 0, y: 0 };
    let isOpen = false;

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
        if (!href) return;
        anchorRef.current = { getBoundingClientRect: () => new DOMRect(origin.x, origin.y, 0, 0) };
        isOpen = true;
        setTarget({ href, ...origin });
        setOpen(true);
      }, REST_MS);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return;
      const next = eligibleLink(e.target);
      if (next === link) return;
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

    const onDown = (e: PointerEvent) => {
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
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("blur", close);
    };
  }, [enabled]);

  if (!enabled || !target) return null;

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
        <button
          type="button"
          onClick={() => {
            closeRef.current();
            openInNewTab(target.href);
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
        >
          <AppWindow aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Open in new tab</span>
          <Kbd>⇧ Click</Kbd>
        </button>
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
  const here = `${window.location.pathname}${window.location.search}`;
  const url = new URL(a.href);
  if (`${url.pathname}${url.search}` === here) return null;
  return a;
}
