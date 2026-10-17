import { useEffect, useMemo } from "react";

import { useKeybindings } from "@/app/hooks/useKeybindings";
import {
  closeFocusedTab,
  cycleTab,
  focusNeighbourIsland,
  internalLinkHref,
  openInNewTab,
  reopenClosedTab,
  selectTabAt,
  splitIsland,
} from "@/app/lib/tabActions";
import { useSettingsStore } from "@/app/stores/settings";

/** Global tab and island entry points: shift+click on internal links and alt-based shortcuts. */
export function TabShortcuts() {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);

  useEffect(() => {
    if (!tabsEnabled) return;
    const onMouseDown = (e: MouseEvent) => {
      // Shift+mousedown would otherwise extend the text selection.
      if (isShiftClick(e) && internalLinkHref(e.target)) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!isShiftClick(e)) return;
      const href = internalLinkHref(e.target);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      openInNewTab(href);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [tabsEnabled]);

  const shortcuts = useMemo(() => {
    if (!tabsEnabled) return {};
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
  }, [tabsEnabled]);
  useKeybindings(shortcuts);

  return null;
}

function isShiftClick(e: MouseEvent): boolean {
  return e.button === 0 && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
}
