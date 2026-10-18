import { useEffect, useMemo } from "react";

import { useKeybindings } from "@/app/hooks/useKeybindings";
import {
  closeFocusedTab,
  cycleTab,
  focusNeighbourIsland,
  internalLinkHref,
  linkIslandId,
  openInNewTab,
  openToSide,
  reopenClosedTab,
  selectTabAt,
  splitIsland,
} from "@/app/lib/tabActions";
import { isSettingsHref, openSettings } from "@/app/stores/settingsModal";

/** Global tab and island entry points: modified links and alt-based shortcuts. */
export function TabShortcuts() {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      // Shift+mousedown would otherwise extend the text selection.
      if (isShiftClick(e) && internalLinkHref(e.target)) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const href = internalLinkHref(e.target);
      if (href && isSettingsHref(href) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        openSettings();
        return;
      }
      if (!isShiftClick(e) && !isAltClick(e)) return;
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      const islandId = linkIslandId(e.target);
      if (e.altKey) openToSide(href, islandId);
      else openInNewTab(href, { islandId });
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {
      "alt+w": closeFocusedTab,
      "alt+shift+t": reopenClosedTab,
      "alt+]": () => cycleTab(1),
      "alt+[": () => cycleTab(-1),
      "alt+9": () => selectTabAt(-1),
      "alt+\\": () => splitIsland("right"),
      "alt+shift+arrowleft": () => focusNeighbourIsland("left"),
      "alt+shift+arrowright": () => focusNeighbourIsland("right"),
      "alt+shift+arrowup": () => focusNeighbourIsland("up"),
      "alt+shift+arrowdown": () => focusNeighbourIsland("down"),
    };
    for (let n = 1; n <= 8; n++) map[`alt+${n}`] = () => selectTabAt(n - 1);
    return map;
  }, []);
  useKeybindings(shortcuts);

  return null;
}

function isShiftClick(e: MouseEvent): boolean {
  return e.button === 0 && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
}

function isAltClick(e: MouseEvent): boolean {
  return e.button === 0 && e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
}
