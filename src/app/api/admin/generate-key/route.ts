import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function generateKey(type: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // Both license and game keys use format: XXXX-XXXX-XXXX-XXXX (hyphen separator)
  // This matches Revo Fixer's securityCodes format (verified from Firebase)
  const segs: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) seg += chars[Math.floor(Math.random() * chars.length)];
    segs.push(seg);
  }
  return segs.join("-");
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
