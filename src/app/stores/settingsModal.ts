import { create } from "zustand";
import { hrefPathname } from "@/app/workspace/model";
import { getFocusedTab } from "@/app/workspace/store";

const OPEN_KEY = "githut.settings.open";
export const useSettingsModal = create(() => ({ open: false }));

export function isSettingsHref(href: string): boolean {
  return hrefPathname(href) === "/settings";
}

function setOpen(open: boolean) {
  useSettingsModal.setState({ open });
  try {
    if (open) sessionStorage.setItem(OPEN_KEY, "true");
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // The modal still works when browser storage is unavailable.
  }
}

/** Used only after OAuth redirects; ordinary URLs decide what opens on startup. */
export function restoreSettingsAfterSignIn(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function openSettings({ replace = false } = {}) {
  setOpen(true);
  if (isSettingsHref(window.location.href)) return;
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, ghSettings: true, ghSettingsPushed: !replace },
    "",
    "/settings",
  );
}

export function closeSettings() {
  setOpen(false);
  // Opened with a new history entry: step back over it so closing leaves no
  // dead Back step behind.
  if (window.history.state?.ghSettingsPushed && isSettingsHref(window.location.href)) {
    window.history.back();
    return;
  }
  window.history.replaceState(
    { ...window.history.state, ghSettings: false, ghSettingsPushed: false },
    "",
    getFocusedTab().href,
  );
}

/** Settings entries never consume a step in a tab's own browser history. */
export function syncSettingsFromHistory(): boolean {
  const open = isSettingsHref(window.location.href);
  const wasOpen = useSettingsModal.getState().open;
  if (open || wasOpen) {
    setOpen(open);
    return true;
  }
  return false;
}
