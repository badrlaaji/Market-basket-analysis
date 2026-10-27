import { useEffect, useRef, useState } from "react";
import type { CustomerCard } from "@/lib/types";

type Loaded = { id: number; card: CustomerCard | null; error: string };

/** GET /api/customers/{id}; throws on an error status. */
async function fetchCard(id: number, signal?: AbortSignal): Promise<CustomerCard> {
  const response = await fetch(`/api/customers/${id}`, { signal });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json() as Promise<CustomerCard>;
}

/**
 * The card of the open customer, kept in memory once loaded; the next customer
 * of the list is fetched in advance, so "Next" shows at once.
 */
export function useCustomerCard(id: number | null, nextId: number | null) {
  const cache = useRef(new Map<number, CustomerCard>());
  const [loaded, setLoaded] = useState<Loaded>({ id: -1, card: null, error: "" });

  useEffect(() => {
    if (id === null) return;
    const cached = cache.current.get(id);
    if (cached) {
      setLoaded({ id, card: cached, error: "" });
      return;
    }
    const controller = new AbortController();
    fetchCard(id, controller.signal)
      .then((card) => {
        cache.current.set(id, card);
        setLoaded({ id, card, error: "" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const detail = err instanceof Error ? err.message : String(err);
        setLoaded({ id, card: null, error: `Could not load this customer (${detail}).` });
      });
    return () => controller.abort();
  }, [id]);

  // Prefetch the next card once the open one is shown; a failure is ignored here
  useEffect(() => {
    if (nextId === null || loaded.id !== id || cache.current.has(nextId)) return;
    fetchCard(nextId)
      .then((card) => cache.current.set(nextId, card))
      .catch(() => {});
  }, [id, nextId, loaded.id]);

  // Until the new card arrives, keep the previous one (dimmed) instead of a blank panel
  return { card: loaded.card, error: loaded.id === id ? loaded.error : "" };
}
