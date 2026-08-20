import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeSpinById } from "@/lib/crazytime/upstream";
import { normalizeSpin } from "@/lib/crazytime/adapter";
import { CRAZY_TIME_TABLE_ID } from "@/lib/crazytime/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const tableId = sp.get("tableId") ?? CRAZY_TIME_TABLE_ID;
  try {
    const raw = await fetchCrazyTimeSpinById(id, tableId);
    const spin = normalizeSpin(raw);
    return NextResponse.json(
      { spin, fetchedAt: new Date().toISOString() },
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
      { error: msg, spin: null, fetchedAt: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
