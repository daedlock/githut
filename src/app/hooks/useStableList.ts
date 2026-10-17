import { useState } from "react";

/** Hold a list's current rows while a pointer is choosing one; apply the latest snapshot on leave. */
export function useStableList<T>(incoming: T[]) {
  const [held, setHeld] = useState<T[] | null>(null);
  return {
    items: held ?? incoming,
    listProps: {
      onPointerEnter: () => setHeld(incoming),
      onPointerLeave: () => setHeld(null),
      onPointerCancel: () => setHeld(null),
    },
  };
}
