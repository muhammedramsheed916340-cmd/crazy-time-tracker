"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedSpin, NormalizedStats, NormalizedPrediction } from "@/lib/crazytime/types";

export interface EventsResponse {
  spins: NormalizedSpin[];
  totalCount: number;
  count: number;
  error?: string;
  fetchedAt: string;
}

export interface StatsResponse {
  stats: NormalizedStats;
  prediction: NormalizedPrediction;
  error?: string;
  fetchedAt: string;
}

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

async function getJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// Generic live-refresh hook with retry and visibility awareness.
export function useLiveFetch<T>(
  url: string,
  options: {
    intervalMs?: number;
    enabled?: boolean;
    initialData?: T | null;
  } = {}
): FetchState<T> & {
  refresh: () => void;
  resetError: () => void;
} {
  const { intervalMs = 15000, enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const doFetch = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const json = await getJson(urlRef.current, ac.signal);
      setData(json as T);
      setError(null);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + URL change fetch
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [url, enabled, doFetch]);

  // Polling with visibility awareness
  useEffect(() => {
    if (!enabled) return;
    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          doFetch();
        }
      }, intervalMs);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") doFetch();
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, doFetch]);

  const refresh = useCallback(() => {
    setLoading(true);
    doFetch();
  }, [doFetch]);

  const resetError = useCallback(() => setError(null), []);

  return { data, loading, error, lastUpdated, refresh, resetError };
}

export function useCrazyTimeEvents(size = 20, durationHours = 24, intervalMs = 15000) {
  const url = `/api/crazytime/events?size=${size}&duration=${durationHours}&_=${Math.random().toString(36).slice(2, 8)}`;
  // Use a stable URL without random nonce - we use no-store headers
  const stableUrl = `/api/crazytime/events?size=${size}&duration=${durationHours}`;
  const state = useLiveFetch<EventsResponse>(stableUrl, { intervalMs });
  return {
    spins: state.data?.spins ?? [],
    totalCount: state.data?.totalCount ?? 0,
    loading: state.loading,
    error: state.data?.error || state.error,
    lastUpdated: state.lastUpdated,
    refresh: state.refresh,
  };
}

export function useCrazyTimeStats(durationHours = 24, intervalMs = 30000) {
  const url = `/api/crazytime/stats?duration=${durationHours}`;
  const state = useLiveFetch<StatsResponse>(url, { intervalMs });
  return {
    stats: state.data?.stats ?? null,
    prediction: state.data?.prediction ?? null,
    loading: state.loading,
    error: state.data?.error || state.error,
    lastUpdated: state.lastUpdated,
    refresh: state.refresh,
  };
}

export function useCrazyTimeSpin(id: string | null | undefined, intervalMs = 15000) {
  const url = id ? `/api/crazytime/spin/${encodeURIComponent(id)}` : "";
  const state = useLiveFetch<{ spin: NormalizedSpin | null; error?: string; fetchedAt: string }>(
    url || "/api/crazytime/events?size=1",
    { intervalMs, enabled: !!url }
  );
  return {
    spin: state.data?.spin ?? null,
    loading: state.loading,
    error: state.data?.error || state.error,
    lastUpdated: state.lastUpdated,
    refresh: state.refresh,
  };
}
