import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents } from "@/lib/crazytime/upstream";
import { normalizeSpins } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SIZE,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
} from "@/lib/crazytime/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") ?? 0);
  const size = Number(sp.get("size") ?? DEFAULT_SIZE);
  const sort = sp.get("sort") ?? DEFAULT_SORT;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  const wheelResults = sp.get("wheelResults") ?? DEFAULT_WHEEL_RESULTS_FILTER;
  const isTopSlotMatched =
    sp.get("isTopSlotMatched") ?? DEFAULT_TOPSLOT_MATCHED_FILTER;
  const tableId = sp.get("tableId") ?? CRAZY_TIME_TABLE_ID;

  try {
    const { items, totalCount } = await fetchCrazyTimeEvents({
      page: Number.isFinite(page) ? page : 0,
      size: Number.isFinite(size) ? size : DEFAULT_SIZE,
      sort,
      durationHours: Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
      wheelResults,
      isTopSlotMatched,
      tableId,
    });
    const spins = normalizeSpins(items);
    return NextResponse.json(
      { spins, totalCount, count: spins.length, fetchedAt: new Date().toISOString() },
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
      { error: msg, spins: [], totalCount: 0, count: 0, fetchedAt: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
