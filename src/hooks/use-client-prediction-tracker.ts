"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { NormalizedSpin, NextSpinSignal } from "@/lib/crazytime/types";
import {
  recordPrediction,
  verifyPending,
  getAccuracy,
  type ClientAccuracyStats,
} from "@/lib/crazytime/client-tracker";
import { useCrazyTimeEvents } from "@/hooks/use-crazy-time";

interface UseClientPredictionTrackerResult {
  accuracy: ClientAccuracyStats;
  recordSignals: (
    signals: {
      momentum: NextSpinSignal | null;
      hotTrend: NextSpinSignal | null;
      overdueBonus: NextSpinSignal | null;
    } | null,
    sourceSpinId: string,
    sourceSpinTimestamp: string
  ) => void;
  lastVerification: { verified: number; wins: number; losses: number; top3Hits: number } | null;
}

// This hook manages the full client-side prediction lifecycle:
// 1. Records predictions to localStorage when GET SIGNAL is clicked
// 2. Polls for new spins every 5s
// 3. When a new spin arrives, verifies pending predictions
// 4. Returns updated accuracy stats
export function useClientPredictionTracker(): UseClientPredictionTrackerResult {
  const [accuracy, setAccuracy] = useState<ClientAccuracyStats>(() => getAccuracy());
  const [lastVerification, setLastVerification] = useState<{
    verified: number;
    wins: number;
    losses: number;
    top3Hits: number;
  } | null>(null);
  const lastSeenSpinId = useRef<string | null>(null);
  const verificationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Record predictions when GET SIGNAL is clicked
  const recordSignals = useCallback(
    (
      signals: {
        momentum: NextSpinSignal | null;
        hotTrend: NextSpinSignal | null;
        overdueBonus: NextSpinSignal | null;
      } | null,
      sourceSpinId: string,
      sourceSpinTimestamp: string
    ) => {
      if (!signals || !sourceSpinId) return;
      const topSectors = [
        signals.momentum?.sector,
        signals.hotTrend?.sector,
        signals.overdueBonus?.sector,
      ].filter(Boolean) as string[];

      const signalMap = [
        { signal: signals.momentum, strategy: "momentum" },
        { signal: signals.hotTrend, strategy: "hot_trend" },
        { signal: signals.overdueBonus, strategy: "overdue_bonus" },
      ];

      for (const { signal, strategy } of signalMap) {
        if (!signal || !signal.sector) continue;
        const predictionId = `pred_${sourceSpinId}_${strategy}`;
        recordPrediction(
          predictionId,
          strategy,
          signal.sector,
          signal.sectorLabel,
          topSectors,
          signal.confidence,
          (signal as any).modelScore ?? 0,
          sourceSpinId,
          sourceSpinTimestamp
        );
      }

      // Refresh accuracy after recording
      setAccuracy(getAccuracy());
    },
    []
  );

  // Poll for new spins and verify pending predictions
  const checkForNewSpins = useCallback(async () => {
    try {
      const res = await fetch(`/api/crazytime/events?size=30&_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const json = await res.json();
      const spins: NormalizedSpin[] = json?.spins ?? [];
      if (spins.length === 0) return;

      const latestId = spins[0]?.id;
      if (!latestId) return;

      // If this is a new spin, verify pending predictions
      if (lastSeenSpinId.current !== null && latestId !== lastSeenSpinId.current) {
        console.log(`[client-tracker] New spin detected: ${latestId} (was ${lastSeenSpinId.current})`);
        const result = verifyPending(spins);
        if (result.verified > 0) {
          console.log(`[client-tracker] Verified ${result.verified} predictions: ${result.wins}W ${result.losses}L`);
          setLastVerification(result);
        }
        setAccuracy(getAccuracy());
      }

      // Always try to verify (catches up on refresh)
      const result = verifyPending(spins);
      if (result.verified > 0) {
        setLastVerification(result);
        setAccuracy(getAccuracy());
      }

      lastSeenSpinId.current = latestId;
    } catch {
      // ignore polling errors
    }
  }, []);

  // Start polling for new spins every 5 seconds
  useEffect(() => {
    // Check immediately on mount (use setTimeout to avoid synchronous setState)
    const initialTimer = setTimeout(() => {
      void checkForNewSpins();
    }, 100);

    verificationTimerRef.current = setInterval(checkForNewSpins, 5000);

    return () => {
      clearTimeout(initialTimer);
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
        verificationTimerRef.current = null;
      }
    };
  }, [checkForNewSpins]);

  // Refresh accuracy on window focus (catches up after tab switch)
  useEffect(() => {
    const onFocus = () => {
      void checkForNewSpins();
      setAccuracy(getAccuracy());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkForNewSpins]);

  return {
    accuracy,
    recordSignals,
    lastVerification,
  };
}
