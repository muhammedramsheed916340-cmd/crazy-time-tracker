import "server-only";
import { db } from "@/lib/db";
import type { NextSpinSignal, NormalizedSpin } from "@/lib/crazytime/types";
import { label } from "@/lib/crazytime/adapter";

// Save a prediction to the database so we can later compare it to the actual
// result. This powers the REAL accuracy tracker shown in the UI.
export async function recordPrediction(
  signal: NextSpinSignal,
  topSectors: string[]
): Promise<void> {
  try {
    await db.predictionRecord.create({
      data: {
        strategy: signal.strategy,
        predictedSector: signal.sector,
        predictedLabel: signal.sectorLabel,
        topSectors: JSON.stringify(topSectors),
        confidence: signal.confidence,
        observedHitRate: signal.observedPercentage,
      },
    });
  } catch (err) {
    // Don't let tracking failure break the prediction API
    console.error("[prediction-tracker] recordPrediction error:", err);
  }
}

// Resolve any unresolved predictions whose target spin has now happened.
// We compare each unresolved prediction's `predictedAt` against the latest
// real spins, and mark the prediction as hit/miss based on whether the actual
// next spin after the prediction matched the predicted sector.
export async function resolvePendingPredictions(
  recentSpins: NormalizedSpin[]
): Promise<{ resolved: number; hits: number; top3Hits: number }> {
  if (!recentSpins.length) return { resolved: 0, hits: 0, top3Hits: 0 };

  try {
    const pending = await db.predictionRecord.findMany({
      where: { resolvedAt: null },
      orderBy: { predictedAt: "asc" },
      take: 50,
    });
    if (!pending.length) return { resolved: 0, hits: 0, top3Hits: 0 };

    // Spins are sorted newest first. We need to find, for each prediction,
    // the FIRST spin that settled AFTER the prediction was made.
    // recentSpins[0] is the most recent. We iterate from oldest to newest.
    const sortedByTime = [...recentSpins].sort(
      (a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? "")
    );

    let resolved = 0;
    let hits = 0;
    let top3Hits = 0;

    for (const pred of pending) {
      const predTime = pred.predictedAt.getTime();
      // Find the first actual spin that settled after the prediction
      const nextSpin = sortedByTime.find(
        (s) => s.settledAt && new Date(s.settledAt).getTime() > predTime
      );
      if (!nextSpin || !nextSpin.wheelResultSector) continue;

      const isHit = nextSpin.wheelResultSector === pred.predictedSector;
      let topSectors: string[] = [];
      try {
        topSectors = JSON.parse(pred.topSectors) as string[];
      } catch {
        topSectors = [];
      }
      const isTop3Hit = topSectors.includes(nextSpin.wheelResultSector);

      await db.predictionRecord.update({
        where: { id: pred.id },
        data: {
          actualSector: nextSpin.wheelResultSector,
          actualEventId: nextSpin.id,
          resolvedAt: new Date(),
          isHit,
          isTop3Hit,
        },
      });
      resolved++;
      if (isHit) hits++;
      if (isTop3Hit) top3Hits++;
    }
    return { resolved, hits, top3Hits };
  } catch (err) {
    console.error("[prediction-tracker] resolvePendingPredictions error:", err);
    return { resolved: 0, hits: 0, top3Hits: 0 };
  }
}

export interface AccuracyStats {
  total: number;
  resolved: number;
  hits: number;
  top3Hits: number;
  hitRate: number; // 0-100, real % of predictions where predictedSector === actualSector
  top3HitRate: number; // 0-100, real % where actual was in top-3
  perStrategy: {
    strategy: string;
    total: number;
    resolved: number;
    hits: number;
    top3Hits: number;
    hitRate: number;
    top3HitRate: number;
  }[];
  recent: {
    id: string;
    strategy: string;
    predictedSector: string;
    predictedLabel: string;
    confidence: number;
    actualSector: string | null;
    isHit: boolean | null;
    isTop3Hit: boolean | null;
    predictedAt: string;
    resolvedAt: string | null;
  }[];
}

// Compute the REAL historical accuracy of all predictions made so far.
export async function getAccuracyStats(): Promise<AccuracyStats> {
  try {
    const all = await db.predictionRecord.findMany({
      orderBy: { predictedAt: "desc" },
      take: 200,
    });
    const resolved = all.filter((p) => p.resolvedAt !== null && p.isHit !== null);
    const hits = resolved.filter((p) => p.isHit === true).length;
    const top3Hits = resolved.filter((p) => p.isTop3Hit === true).length;
    const hitRate = resolved.length ? (hits / resolved.length) * 100 : 0;
    const top3HitRate = resolved.length ? (top3Hits / resolved.length) * 100 : 0;

    const strategies = ["momentum", "hot_trend", "overdue_bonus"];
    const perStrategy = strategies.map((strategy) => {
      const stratAll = all.filter((p) => p.strategy === strategy);
      const stratResolved = stratAll.filter(
        (p) => p.resolvedAt !== null && p.isHit !== null
      );
      const stratHits = stratResolved.filter((p) => p.isHit === true).length;
      const stratTop3 = stratResolved.filter((p) => p.isTop3Hit === true).length;
      return {
        strategy,
        total: stratAll.length,
        resolved: stratResolved.length,
        hits: stratHits,
        top3Hits: stratTop3,
        hitRate: stratResolved.length ? (stratHits / stratResolved.length) * 100 : 0,
        top3HitRate: stratResolved.length ? (stratTop3 / stratResolved.length) * 100 : 0,
      };
    });

    const recent = all.slice(0, 10).map((p) => ({
      id: p.id,
      strategy: p.strategy,
      predictedSector: p.predictedSector,
      predictedLabel: p.predictedLabel || label(p.predictedSector),
      confidence: p.confidence,
      actualSector: p.actualSector,
      isHit: p.isHit,
      isTop3Hit: p.isTop3Hit,
      predictedAt: p.predictedAt.toISOString(),
      resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
    }));

    return {
      total: all.length,
      resolved: resolved.length,
      hits,
      top3Hits,
      hitRate,
      top3HitRate,
      perStrategy,
      recent,
    };
  } catch (err) {
    console.error("[prediction-tracker] getAccuracyStats error:", err);
    return {
      total: 0,
      resolved: 0,
      hits: 0,
      top3Hits: 0,
      hitRate: 0,
      top3HitRate: 0,
      perStrategy: [],
      recent: [],
    };
  }
}
