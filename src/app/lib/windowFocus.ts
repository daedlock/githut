/** Coalesce native app switches and browser visibility changes into one focus notification. */
export function listenForWindowFocus(
  notify: () => void,
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
  visible: () => boolean = () => document.visibilityState !== "hidden",
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    clearTimeout(timer);
    if (!visible()) {
      notify();
      return;
    }
    timer = setTimeout(() => {
      if (visible()) notify();
    }, 100);
  };
  target.addEventListener("focus", changed);
  target.addEventListener("visibilitychange", changed);
  return () => {
    clearTimeout(timer);
    target.removeEventListener("focus", changed);
    target.removeEventListener("visibilitychange", changed);
  };
}
