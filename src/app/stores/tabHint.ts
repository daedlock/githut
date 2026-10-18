import { create } from "zustand";

const KEY = "githut.tab-hint.dismissed";

function wasRetired() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const useTabHintStore = create<{ retired: boolean }>()(() => ({ retired: wasRetired() }));

/** Shown once: later loads never show it again, while this one keeps it until dismissed. */
export function markTabHintSeen() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the tip may show again next load.
  }
}

/** Learning to split is as final as dismissing the tip, even when that split is undone. */
export function retireTabHint() {
  useTabHintStore.setState({ retired: true });
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Keep the dismissal for this session when browser storage is unavailable.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY && event.newValue === "1") useTabHintStore.setState({ retired: true });
  });
}
