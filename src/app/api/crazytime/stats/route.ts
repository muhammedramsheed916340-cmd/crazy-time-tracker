import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeStats, buildPrediction } from "@/lib/crazytime/adapter";
import { DEFAULT_DURATION_HOURS, CRAZY_TIME_TABLE_ID } from "@/lib/crazytime/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  const sortField = sp.get("sortField") ?? "count";
  const tableId = sp.get("tableId") ?? CRAZY_TIME_TABLE_ID;

  try {
    const raw = await fetchCrazyTimeStats(
      Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
      sortField,
      tableId
    );
    const stats = normalizeStats(raw);
    const prediction = buildPrediction(stats);
    return NextResponse.json(
      { stats, prediction, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const empty = normalizeStats(null);
    return NextResponse.json(
      {
        error: msg,
        stats: empty,
        prediction: buildPrediction(empty),
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
