import { useEffect, useState } from "react";

export const DEBOUNCE_MS = 300;

/** Value that follows `value` once it has stopped changing for `delay` ms. */
export function useDebounce<T>(value: T, delay: number = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // a new value cancels the pending one
  }, [value, delay]);

  return debounced;
}
