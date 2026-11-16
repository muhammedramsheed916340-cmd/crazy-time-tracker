import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function generateKey(type: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments: string[] = [];
  const segCount = type === "game" ? 3 : 4;
  const segLen = type === "game" ? 5 : 4;
  for (let s = 0; s < segCount; s++) {
    let seg = "";
    for (let i = 0; i < segLen; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type === "game" ? "game" : "license";
    const label = body.label || "";
    const count = Math.min(50, Math.max(1, body.count || 1));

    const keys: { key: string; type: string; label: string; status: string }[] = [];

    for (let i = 0; i < count; i++) {
      const key = generateKey(type);
      try {
        await db.licenseKey.create({
          data: {
            key,
            type,
            label: label || (type === "game" ? "Game Key" : "License Key"),
            status: "active",
          },
        });
        keys.push({ key, type, label: label || (type === "game" ? "Game Key" : "License Key"), status: "active" });
      } catch {
        // duplicate key — retry
        i--;
      }
    }

    return NextResponse.json({ success: true, keys, count: keys.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const keys = await db.licenseKey.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ keys });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    if (id) {
      await db.licenseKey.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }
    // Delete all
    await db.licenseKey.deleteMany({});
    return NextResponse.json({ success: true, deleted: "all" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
