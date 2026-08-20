import "server-only";
import { UPSTREAM_API_BASE, CRAZY_TIME_TABLE_ID } from "./constants";
import type { RawGameEvent, RawStatsResponse } from "./types";

const UPSTREAM_ORIGIN = "https://in.casino.org";
const UPSTREAM_REFERER =
  "https://in.casino.org/india/casinoscores/crazy-time/";

function buildHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: UPSTREAM_ORIGIN,
    Referer: UPSTREAM_REFERER,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return null as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Upstream returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export interface FetchEventsParams {
  page?: number;
  size?: number;
  sort?: string;
  durationHours?: number;
  wheelResults?: string;
  isTopSlotMatched?: string;
  tableId?: string;
}

export async function fetchCrazyTimeEvents(
  params: FetchEventsParams = {}
): Promise<{ items: RawGameEvent[]; totalCount: number }> {
  const {
    page = 0,
    size = 20,
    sort = "data.settledAt,desc",
    durationHours = 24,
    // The real value used by the upstream app for WHEEL_RESULTS_FILTER_FULL
    wheelResults = "Pachinko,CashHunt,CrazyBonus,CoinFlip,1,2,5,10",
    // TRUE_FALSE_LIST used by the upstream app
    isTopSlotMatched = "true,false",
    tableId = CRAZY_TIME_TABLE_ID,
  } = params;

  // Build the URL with raw commas - URLSearchParams would encode commas to %2C
  // which the upstream API does not accept (it returns an empty array).
  const q = new URLSearchParams();
  q.set("page", String(page === 0 ? 0 : page - 1));
  q.set("size", String(size));
  q.set("sort", sort);
  q.set("duration", String(durationHours));
  q.set("tableId", tableId);
  // Append the comma-bearing values raw (after URLSearchParams encodes, replace back)
  q.set("wheelResults", wheelResults);
  q.set("isTopSlotMatched", isTopSlotMatched);
  let url = q.toString();
  // Restore raw commas that the upstream API expects
  url = url
    .replace(/wheelResults=([^&]+)/, (_, v) => "wheelResults=" + decodeURIComponent(v))
    .replace(/isTopSlotMatched=([^&]+)/, (_, v) => "isTopSlotMatched=" + decodeURIComponent(v));
  const finalUrl = `${UPSTREAM_API_BASE}?${url}`;

  const res = await fetch(finalUrl, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstream events HTTP ${res.status}`);

  const items = await parseJson<RawGameEvent[]>(res);
  const totalCount = Number(res.headers.get("x-total-count") || 0);
  return { items: Array.isArray(items) ? items : [], totalCount };
}

export async function fetchCrazyTimeSpinById(
  id: string,
  tableId: string = CRAZY_TIME_TABLE_ID
): Promise<RawGameEvent | null> {
  const url = new URL(`${UPSTREAM_API_BASE}/${encodeURIComponent(id)}`);
  url.searchParams.set("tableId", tableId);
  const res = await fetch(url.toString(), {
    headers: buildHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return parseJson<RawGameEvent>(res);
}

export async function fetchCrazyTimeStats(
  durationHours = 24,
  sortField = "count",
  tableId: string = CRAZY_TIME_TABLE_ID
): Promise<RawStatsResponse> {
  const url = new URL(`${UPSTREAM_API_BASE}/stats`);
  url.searchParams.set("duration", String(durationHours));
  url.searchParams.set("sortField", sortField);
  url.searchParams.set("tableId", tableId);
  const res = await fetch(url.toString(), {
    headers: buildHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstream stats HTTP ${res.status}`);
  return parseJson<RawStatsResponse>(res);
}
