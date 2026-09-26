import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * The task thread stays concealed until its runs and activity have loaded, but
 * those queries are keyed by the issue's canonical id, which is only known once
 * the issue itself has loaded. Opening a task therefore ran two slow requests
 * back to back. The page starts them under the route's issue ref (the API
 * accepts identifiers) while the issue loads; the canonical-id query's first
 * fetch then reuses that request instead of starting its own.
 */
export const ROUTE_REF_SEED_MS = 10_000;

export function prefetchByRouteRef<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
): void {
  void queryClient.prefetchQuery({ queryKey, queryFn, staleTime: ROUTE_REF_SEED_MS });
}

/**
 * Fetch for a canonical-id query. Only its very first fetch — no data yet —
 * reuses a route-ref request that is in flight or finished within the seed
 * window; every later fetch (polls, live-event refreshes) goes to the server.
 */
export function fetchSeededByRouteRef<T>(
  queryClient: QueryClient,
  canonicalKey: QueryKey,
  routeKey: QueryKey | null,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (routeKey && !queryClient.getQueryState(canonicalKey)?.dataUpdatedAt) {
    const seed = queryClient.getQueryState<T>(routeKey);
    if (
      seed &&
      seed.status !== "error" &&
      (seed.fetchStatus === "fetching" || Date.now() - seed.dataUpdatedAt < ROUTE_REF_SEED_MS)
    ) {
      return queryClient.fetchQuery({ queryKey: routeKey, queryFn: fetcher, staleTime: ROUTE_REF_SEED_MS });
    }
  }
  return fetcher();
}
