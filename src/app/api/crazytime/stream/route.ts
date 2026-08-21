import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const UPSTREAM_PLAYLIST =
  "https://live101.egprom.com/app/43/amlst:dc3_ct_auto/playlist.m3u8";

// egprom serves the master playlist and segment playlists, which contain
// relative or absolute variant/segment URLs. We rewrite those URLs so the
// browser requests them through this same proxy (which adds the Referer that
// the egprom CDN requires and which browsers cannot set themselves).

function rewritePlaylist(text: string, base: string): string {
  try {
    const lines = text.split("\n");
    const out: string[] = [];
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // Rewrite #EXT-X-KEY / #EXT-X-MAP URI attributes if present
        if (trimmed.startsWith("#") && /URI="([^"]+)"/.test(trimmed)) {
          line = trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const absolute = resolveUrl(uri, base);
            return `URI="${toProxy(absolute)}"`;
          });
        }
        out.push(line);
        continue;
      }
      // A playlist URL line
      const absolute = resolveUrl(trimmed, base);
      out.push(toProxy(absolute));
    }
    return out.join("\n");
  } catch {
    return text;
  }
}

function resolveUrl(maybeUrl: string, base: string): string {
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return maybeUrl;
  }
}

function toProxy(absoluteUrl: string): string {
  // Use a relative path so it works on any host (localhost, Vercel, etc.)
  // We don't need an absolute URL — just the path + query.
  const u = new URL(absoluteUrl);
  return `/api/crazytime/stream?u=${encodeURIComponent(u.toString())}`;
}

async function fetchUpstream(target: string, range?: string | null) {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Origin: "https://in.casino.org",
    Referer: "https://in.casino.org/india/casinoscores/crazy-time/",
  };
  if (range) {
    headers["Range"] = range;
  }
  return fetch(target, {
    headers,
    cache: "no-store",
    redirect: "follow",
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawTarget = sp.get("u");
  const target = rawTarget ? decodeURIComponent(rawTarget) : UPSTREAM_PLAYLIST;

  // Only allow egprom hosts to prevent open proxying
  if (!/https?:\/\/[^/]*egprom\.com\//.test(target)) {
    return NextResponse.json(
      { error: "Only egprom stream hosts are allowed" },
      { status: 403 }
    );
  }

  try {
    const range = req.headers.get("range");
    const upstream = await fetchUpstream(target, range);

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream stream HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "application/vnd.apple.mpegurl";
    const isPlaylist = /mpegurl|mpegurl|m3u8/i.test(contentType) || target.endsWith(".m3u8");

    if (isPlaylist) {
      const text = await upstream.text();
      const rewritten = rewritePlaylist(text, target);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Binary segment - stream through
    const body = await upstream.arrayBuffer();
    const respHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    };
    const len = upstream.headers.get("content-length");
    if (len) respHeaders["Content-Length"] = len;
    const cr = upstream.headers.get("content-range");
    if (cr) respHeaders["Content-Range"] = cr;
    const status = upstream.status === 206 ? 206 : 200;
    return new NextResponse(body, { status, headers: respHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown stream error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
