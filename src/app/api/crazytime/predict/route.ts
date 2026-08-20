import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents, fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeSpins, normalizeStats, buildMultiPrediction, buildPrediction } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SIZE,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
} from "@/lib/crazytime/constants";
import type { NextSpinSignal, NormalizedPrediction } from "@/lib/crazytime/types";
import {
  recordPrediction,
  resolvePendingPredictions,
  getAccuracyStats,
} from "@/lib/crazytime/tracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory session counter (per server instance).
let sessionPredictionCount = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  // Fetch 200 spins (not the default 20) so the Markov transition matrix has
  // enough data to find real patterns. The upstream API supports up to 500.
  const size = Number(sp.get("size") ?? 200);

  try {
    // Fetch real stats and a large window of real recent spins in parallel.
    const [statsRaw, eventsRes] = await Promise.all([
      fetchCrazyTimeStats(
        Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        "count",
        CRAZY_TIME_TABLE_ID
      ),
      fetchCrazyTimeEvents({
        page: 0,
        size: Number.isFinite(size) ? Math.min(500, Math.max(50, size)) : 200,
        sort: DEFAULT_SORT,
        durationHours: Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        wheelResults: DEFAULT_WHEEL_RESULTS_FILTER,
        isTopSlotMatched: DEFAULT_TOPSLOT_MATCHED_FILTER,
        tableId: CRAZY_TIME_TABLE_ID,
      }),
    ]);

    const stats = normalizeStats(statsRaw);
    const spins = normalizeSpins(eventsRes.items);
    sessionPredictionCount += 1;

    const multi = buildMultiPrediction(stats, spins, sessionPredictionCount);
    const predictionSummary: NormalizedPrediction = buildPrediction(stats);

    // Resolve any pending predictions against the latest real spins, then
    // record the new predictions (in the background - don't block the response).
    const topSectors = multi.ranked.slice(0, 3).map((r) => r.sector);
    try {
      await resolvePendingPredictions(spins);
      // Record each of the 3 predictions so we can later verify accuracy
      await Promise.all([
        recordPrediction(multi.momentum, topSectors),
        recordPrediction(multi.hotTrend, topSectors),
        recordPrediction(multi.overdueBonus, topSectors),
      ]);
    } catch (err) {
      console.error("[predict] tracker error:", err);
    }

    // Fetch the real historical accuracy stats to send to the client
    const accuracy = await getAccuracyStats();

    // The actual most recent real spin, so the UI can show it next to predictions
    const lastActualSpin = spins[0] ?? null;

    return NextResponse.json(
      {
        signals: {
          momentum: multi.momentum,
          hotTrend: multi.hotTrend,
          overdueBonus: multi.overdueBonus,
        } as Record<string, NextSpinSignal>,
        ranked: multi.ranked,
        predictionSummary,
        accuracy,
        lastActualSpin: lastActualSpin
          ? {
              sector: lastActualSpin.wheelResultSector,
              sectorLabel: lastActualSpin.sectorLabel ?? lastActualSpin.wheelResultSector,
              settledAt: lastActualSpin.settledAt,
              topSlotSector: lastActualSpin.topSlotSector,
              maxMultiplier: lastActualSpin.maxMultiplier,
              isBonus: lastActualSpin.bonusType != null,
            }
          : null,
        recentSpinsCount: spins.length,
        totalSpins: eventsRes.totalCount,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: msg,
        signals: null,
        ranked: [],
        accuracy: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
