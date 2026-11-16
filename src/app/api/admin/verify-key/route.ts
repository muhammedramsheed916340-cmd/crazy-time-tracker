import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Verify a license/game key — checks if it exists in the database and is active
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = (body.key || "").trim().toUpperCase();

    if (!key) {
      return NextResponse.json({
        valid: false,
        error: "No key provided",
      });
    }

    // Look up the key in the database
    const record = await db.licenseKey.findFirst({
      where: { key },
    });

    if (!record) {
      return NextResponse.json({
        valid: false,
        error: "Key not found in database",
        key,
      });
    }

    if (record.status === "expired") {
      return NextResponse.json({
        valid: false,
        error: "Key has expired",
        key,
        status: record.status,
      });
    }

    if (record.status === "used") {
      return NextResponse.json({
        valid: false,
        error: "Key has already been used",
        key,
        status: record.status,
      });
    }

    // Key is valid and active
    return NextResponse.json({
      valid: true,
      key: record.key,
      type: record.type,
      status: record.status,
      label: record.label,
      createdAt: record.createdAt.toISOString(),
      message: `Key is valid (${record.type === "game" ? "Game Key" : "License Key"})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({
      valid: false,
      error: msg,
    }, { status: 500 });
  }
}
