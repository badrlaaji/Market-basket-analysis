import { useSyncExternalStore } from "react";

// Same breakpoint as globals.css: below it, the list becomes cards and the menu goes down
const NARROW = "(max-width: 52rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on a phone-sized screen; false on the server (the wide layout is the default). */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
