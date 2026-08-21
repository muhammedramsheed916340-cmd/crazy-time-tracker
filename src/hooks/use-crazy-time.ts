"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedSpin, NormalizedStats, NormalizedPrediction, NextSpinSignal } from "@/lib/crazytime/types";

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

export interface AccuracyStats {
  totalPredictions: number;
  pending: number;
  verified: number;
  wins: number;
  losses: number;
  top3Hits: number;
  winRate: number;
  top3Rate: number;
  currentStreak: number;
  perStrategy: {
    strategy: string;
    total: number;
    verified: number;
    wins: number;
    losses: number;
    winRate: number;
    top3Rate: number;
  }[];
  recentVerifications: {
    predictionId: string;
    strategy: string;
    predictedLabel: string;
    actualSector: string | null;
    status: "PENDING" | "WIN" | "LOSS";
    isTop3Hit: boolean | null;
    predictedAt: string;
    verifiedAt: string | null;
    sourceSpinId: string;
  }[];
}

export interface PredictResponse {
  dataReady?: boolean;
  status?: string;
  databaseStatus?: "AVAILABLE" | "UNAVAILABLE";
  accuracyStatus?: "AVAILABLE" | "UNAVAILABLE" | "EMPTY";
  databaseError?: string | null;
  recordsCreated?: number;
  signals: {
    momentum: NextSpinSignal;
    hotTrend: NextSpinSignal;
    overdueBonus: NextSpinSignal;
  } | null;
  ranked: {
    sector: string;
    sectorLabel: string;
    score: number;
    percentage: number;
    hotFrequencyPercentage: number | null;
    lastSeenBefore: number | null;
    isBonus: boolean;
  }[];
  predictionSummary?: NormalizedPrediction;
  accuracy?: AccuracyStats | null;
  adaptiveWeights?: string;
  verificationResult?: { verified: number; wins: number; losses: number; top3Hits: number };
  lastActualSpin?: {
    sector: string | null;
    sectorLabel: string | null;
    settledAt: string | null;
    topSlotSector: string | null;
    maxMultiplier: number | null;
    isBonus: boolean;
  } | null;
  recentSpinsCount: number;
  totalSpins: number;
  fetchedAt: string;
  error?: string;
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

// On-demand prediction hook. Auto-fetches once on mount so the AccuracyTracker
// has data immediately, then fetches on demand when the user clicks "Get Signal".
export function useCrazyTimePredict() {
  const [data, setData] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Force a fresh fetch every time: cache-bust header + unique URL param
      // + explicit no-store. This ensures each GET SIGNAL click gets NEW data.
      const res = await fetch(`/api/crazytime/predict?size=200&_=${Date.now()}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PredictResponse;
      setData(json);
      setLastUpdated(new Date().toISOString());
      if (json.error) setError(json.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch once on mount so the AccuracyTracker + SignalCard tabs populate
  // immediately without requiring the user to click "Get Signal" first.
  useEffect(() => {
    void fetchNow();
  }, [fetchNow]);

  return {
    dataReady: data?.dataReady ?? false,
    status: data?.status ?? null,
    databaseStatus: data?.databaseStatus ?? null,
    accuracyStatus: data?.accuracyStatus ?? null,
    databaseError: data?.databaseError ?? null,
    recordsCreated: data?.recordsCreated ?? 0,
    signals: data?.signals ?? null,
    ranked: data?.ranked ?? [],
    accuracy: data?.accuracy ?? null,
    adaptiveWeights: data?.adaptiveWeights ?? null,
    verificationResult: data?.verificationResult ?? null,
    lastActualSpin: data?.lastActualSpin ?? null,
    recentSpinsCount: data?.recentSpinsCount ?? 0,
    totalSpins: data?.totalSpins ?? 0,
    predictionSummary: data?.predictionSummary ?? null,
    loading,
    error: error || data?.error || null,
    lastUpdated,
    fetchNow,
  };
}
