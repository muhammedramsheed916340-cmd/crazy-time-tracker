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

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory session counter (per server instance). This is real - it counts
// how many prediction requests have been served since the process started.
let sessionPredictionCount = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  const size = Number(sp.get("size") ?? DEFAULT_SIZE);

  try {
    // Fetch real stats and a larger window of real recent spins in parallel.
    // We fetch up to 30 recent spins so the momentum strategy has enough data.
    const [statsRaw, eventsRes] = await Promise.all([
      fetchCrazyTimeStats(
        Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        "count",
        CRAZY_TIME_TABLE_ID
      ),
      fetchCrazyTimeEvents({
        page: 0,
        size: Number.isFinite(size) ? size : DEFAULT_SIZE,
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

    return NextResponse.json(
      {
        signals: {
          momentum: multi.momentum,
          hotTrend: multi.hotTrend,
          overdueBonus: multi.overdueBonus,
        } as Record<string, NextSpinSignal>,
        ranked: multi.ranked,
        predictionSummary,
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
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
