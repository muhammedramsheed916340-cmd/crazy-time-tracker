import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents, fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeSpins, normalizeStats } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
} from "@/lib/crazytime/constants";
import type { NormalizedSpin } from "@/lib/crazytime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Official Crazy Time bonus types (mapped to display labels)
const BONUS_TYPES = [
  { key: "CashHunt", label: "Cash Hunt", color: "#2ed573", emoji: "🎯" },
  { key: "Pachinko", label: "Pachinko", color: "#ff6b35", emoji: "🟠" },
  { key: "CoinFlip", label: "Coin Flip", color: "#FFD700", emoji: "🪙" },
  { key: "CrazyBonus", label: "Crazy Time", color: "#ff4757", emoji: "🎡" },
] as const;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  // Fetch 200 spins to get a good bonus history window
  const size = Number(sp.get("size") ?? 200);

  try {
    const [statsRaw, eventsRes] = await Promise.all([
      fetchCrazyTimeStats(
        Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        "count",
        CRAZY_TIME_TABLE_ID
      ),
      fetchCrazyTimeEvents({
        page: 0,
        size: Number.isFinite(size) ? Math.min(500, Math.max(50, size)) : 200,
        sort: DEFAULT_SORT,
        durationHours: Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        wheelResults: DEFAULT_WHEEL_RESULTS_FILTER,
        isTopSlotMatched: DEFAULT_TOPSLOT_MATCHED_FILTER,
        tableId: CRAZY_TIME_TABLE_ID,
      }),
    ]);

    const stats = normalizeStats(statsRaw);
    const allSpins = normalizeSpins(eventsRes.items);

    // Filter only bonus rounds (wheelResultSector is one of the 4 bonus types)
    const bonusSpins: NormalizedSpin[] = allSpins.filter(
      (s) =>
        s.wheelResultSector &&
        BONUS_TYPES.some((b) => b.key === s.wheelResultSector)
    );

    // ===== Per-bonus statistics =====
    const bonusStats = BONUS_TYPES.map((bt) => {
      // From the 24h aggregate stats
      const agg = stats.aggStats.find((s) => s.wheelResult === bt.key);
      // From our spin window
      const windowHits = bonusSpins.filter((s) => s.wheelResultSector === bt.key);
      const lastHit = windowHits[0] ?? null;
      // Rounds since last appeared (count spins from the top until we hit this bonus)
      let roundsSinceLast = 0;
      for (const s of allSpins) {
        if (s.wheelResultSector === bt.key) break;
        roundsSinceLast++;
      }
      // Recent trend: count in last 30 spins vs last 60
      const last30 = allSpins.slice(0, 30).filter((s) => s.wheelResultSector === bt.key).length;
      const last60 = allSpins.slice(0, 60).filter((s) => s.wheelResultSector === bt.key).length;
      const trendDelta = (last30 / 30) * 100 - (last60 / 60) * 100;

      // Average multiplier from bonus rounds (if available)
      const multipliers = windowHits
        .map((s) => s.bonusTotalMultiplier ?? s.maxMultiplier)
        .filter((m): m is number => m != null && m > 0);
      const avgMultiplier =
        multipliers.length > 0
          ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length
          : null;
      const maxMultiplier =
        multipliers.length > 0 ? Math.max(...multipliers) : null;

      return {
        key: bt.key,
        label: bt.label,
        color: bt.color,
        emoji: bt.emoji,
        totalCount24h: agg?.count ?? 0,
        percentage24h: agg?.percentage ?? 0,
        hotFrequencyPercentage: agg?.hotFrequencyPercentage ?? null,
        lastSeenBefore: agg?.lastSeenBefore ?? null,
        roundsSinceLast,
        lastHitAt: lastHit?.settledAt ?? null,
        lastHitMultiplier: lastHit?.bonusTotalMultiplier ?? lastHit?.maxMultiplier ?? null,
        windowHits: windowHits.length,
        recentHits30: last30,
        recentHits60: last60,
        trendDelta: Math.round(trendDelta * 100) / 100,
        avgMultiplier: avgMultiplier != null ? Math.round(avgMultiplier * 100) / 100 : null,
        maxMultiplier: maxMultiplier != null ? Math.round(maxMultiplier * 100) / 100 : null,
      };
    });

    // ===== Latest bonus result =====
    const latestBonus = bonusSpins[0] ?? null;

    // ===== Bonus history (last 20 bonus rounds) =====
    const bonusHistory = bonusSpins.slice(0, 20).map((s) => {
      const bt = BONUS_TYPES.find((b) => b.key === s.wheelResultSector);
      return {
        id: s.id,
        bonusKey: s.wheelResultSector,
        bonusLabel: bt?.label ?? s.wheelResultSector,
        color: bt?.color ?? "#6b7280",
        emoji: bt?.emoji ?? "🎯",
        settledAt: s.settledAt,
        multiplier: s.bonusTotalMultiplier ?? s.maxMultiplier ?? null,
        bonusResultColor: s.bonusResultColor,
        bonusResultType: s.bonusResultType,
        dealerName: s.dealerName,
      };
    });

    // ===== Distribution statistics =====
    const totalBonuses = bonusSpins.length;
    const distribution = bonusStats.map((b) => ({
      key: b.key,
      label: b.label,
      count: b.windowHits,
      percentage: totalBonuses > 0 ? (b.windowHits / totalBonuses) * 100 : 0,
    }));

    // Most frequent bonus in the window
    const mostFrequent = [...bonusStats].sort((a, b) => b.windowHits - a.windowHits)[0] ?? null;

    // Longest gap (bonus with highest roundsSinceLast)
    const longestGap = [...bonusStats].sort((a, b) => b.roundsSinceLast - a.roundsSinceLast)[0] ?? null;

    return NextResponse.json(
      {
        bonusStats,
        latestBonus: latestBonus
          ? {
              id: latestBonus.id,
              bonusKey: latestBonus.wheelResultSector,
              bonusLabel:
                BONUS_TYPES.find((b) => b.key === latestBonus.wheelResultSector)?.label ??
                latestBonus.wheelResultSector,
              color:
                BONUS_TYPES.find((b) => b.key === latestBonus.wheelResultSector)?.color ?? "#6b7280",
              settledAt: latestBonus.settledAt,
              multiplier: latestBonus.bonusTotalMultiplier ?? latestBonus.maxMultiplier ?? null,
              bonusResultColor: latestBonus.bonusResultColor,
              bonusResultType: latestBonus.bonusResultType,
              dealerName: latestBonus.dealerName,
            }
          : null,
        bonusHistory,
        distribution,
        mostFrequent: mostFrequent
          ? { key: mostFrequent.key, label: mostFrequent.label, count: mostFrequent.windowHits }
          : null,
        longestGap: longestGap
          ? {
              key: longestGap.key,
              label: longestGap.label,
              roundsSinceLast: longestGap.roundsSinceLast,
            }
          : null,
        totalBonuses,
        totalSpinsAnalyzed: allSpins.length,
        bonusRate: allSpins.length > 0 ? (totalBonuses / allSpins.length) * 100 : 0,
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
      { error: msg, bonusStats: [], latestBonus: null, bonusHistory: [], fetchedAt: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
