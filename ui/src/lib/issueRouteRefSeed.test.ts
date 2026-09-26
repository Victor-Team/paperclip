import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSeededByRouteRef, prefetchByRouteRef, ROUTE_REF_SEED_MS } from "./issueRouteRefSeed";

const routeKey = ["issues", "runs", "TOK-1"] as const;
const canonicalKey = ["issues", "runs", "uuid-1"] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("issue route-ref seeding", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("reuses the route-ref request still in flight for the first canonical fetch", async () => {
    const client = new QueryClient();
    const route = deferred<string[]>();
    const routeFetch = vi.fn(() => route.promise);
    const canonicalFetch = vi.fn(async () => ["from-canonical"]);
    prefetchByRouteRef(client, routeKey, routeFetch);
    const pending = fetchSeededByRouteRef(client, canonicalKey, routeKey, canonicalFetch);
    route.resolve(["from-route"]);
    expect(await pending).toEqual(["from-route"]);
    expect(routeFetch).toHaveBeenCalledTimes(1);
    expect(canonicalFetch).not.toHaveBeenCalled();
  });

  it("reuses a route-ref result that finished moments ago", async () => {
    const client = new QueryClient();
    client.setQueryData(routeKey, ["from-route"]);
    const canonicalFetch = vi.fn(async () => ["from-canonical"]);
    expect(await fetchSeededByRouteRef(client, canonicalKey, routeKey, canonicalFetch)).toEqual(["from-route"]);
    expect(canonicalFetch).not.toHaveBeenCalled();
  });

  it("goes to the server once the canonical query has data (polls and live refreshes)", async () => {
    const client = new QueryClient();
    client.setQueryData(routeKey, ["from-route"]);
    client.setQueryData(canonicalKey, ["earlier"]);
    const canonicalFetch = vi.fn(async () => ["from-canonical"]);
    expect(await fetchSeededByRouteRef(client, canonicalKey, routeKey, canonicalFetch)).toEqual(["from-canonical"]);
    expect(canonicalFetch).toHaveBeenCalledTimes(1);
  });

  it("goes to the server when there is no seed, the seed failed, or it is too old", async () => {
    const canonicalFetch = vi.fn(async () => ["from-canonical"]);
    const empty = new QueryClient();
    expect(await fetchSeededByRouteRef(empty, canonicalKey, routeKey, canonicalFetch)).toEqual(["from-canonical"]);
    expect(await fetchSeededByRouteRef(empty, canonicalKey, null, canonicalFetch)).toEqual(["from-canonical"]);

    const failed = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    prefetchByRouteRef(failed, routeKey, async () => { throw new Error("boom"); });
    await vi.waitFor(() => expect(failed.getQueryState(routeKey)?.status).toBe("error"));
    expect(await fetchSeededByRouteRef(failed, canonicalKey, routeKey, canonicalFetch)).toEqual(["from-canonical"]);

    vi.useFakeTimers();
    const stale = new QueryClient();
    stale.setQueryData(routeKey, ["from-route"]);
    vi.advanceTimersByTime(ROUTE_REF_SEED_MS + 1);
    expect(await fetchSeededByRouteRef(stale, canonicalKey, routeKey, canonicalFetch)).toEqual(["from-canonical"]);
    expect(canonicalFetch).toHaveBeenCalledTimes(4);
  });
});
