import { useEffect, useState } from "react";

/** Debounce a rapidly-changing value to a new value that only updates after `delay`ms of quiet. */
export function useDebouncedValue<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
