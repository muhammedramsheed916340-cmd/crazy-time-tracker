import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents, fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeSpins, normalizeStats, buildNextSpinSignal, buildPrediction } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SIZE,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
} from "@/lib/crazytime/constants";
import type { NextSpinSignal } from "@/lib/crazytime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory session counter (per server instance). This is real - it counts
// how many prediction requests have been served since the process started.
// It is NOT a fake "total users" counter; it's the actual count of API calls
// to this prediction endpoint.
let sessionPredictionCount = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  const size = Number(sp.get("size") ?? DEFAULT_SIZE);

  try {
    // Fetch real stats and real recent spins in parallel
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

    const { signal, ranked } = buildNextSpinSignal(stats, spins, sessionPredictionCount);
    const predictionSummary = buildPrediction(stats);

    return NextResponse.json(
      {
        signal,
        ranked: ranked.slice(0, 8),
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
      { error: msg, signal: null, ranked: [], fetchedAt: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export type PredictionResponse = {
  signal: NextSpinSignal;
  ranked: {
    sector: string;
    sectorLabel: string;
    score: number;
    percentage: number;
    hotFrequencyPercentage: number | null;
    lastSeenBefore: number | null;
    isBonus: boolean;
  }[];
  recentSpinsCount: number;
  totalSpins: number;
  fetchedAt: string;
  error?: string;
};
