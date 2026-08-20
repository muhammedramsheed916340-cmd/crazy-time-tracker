import {
  WHEEL_SECTOR_LABELS,
  WHEEL_RESULT_CARD_IMAGE,
  TOP_SLOT_IMAGE,
} from "./constants";
import type {
  RawGameEvent,
  RawStatsResponse,
  NormalizedSpin,
  NormalizedStats,
  NormalizedPrediction,
} from "./types";

function num(v: unknown, def = 0): number {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v: unknown, def: string | null = null): string | null {
  if (v === null || v === undefined) return def;
  if (typeof v === "string") return v.length ? v : def;
  return String(v);
}

function bool(v: unknown, def = false): boolean {
  if (v === null || v === undefined) return def;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return def;
}

export function normalizeSpin(raw: RawGameEvent | null | undefined): NormalizedSpin | null {
  if (!raw) return null;
  try {
    const data = raw.data ?? ({} as RawGameEvent["data"]);
    const outcome = data?.result?.outcome ?? null;
    const topSlot = outcome?.topSlot ?? null;
    const wheelResult = outcome?.wheelResult ?? null;
    const bonus = wheelResult?.bonus ?? null;
    const bonusResult = bonus?.result ?? null;
    const bonusMultiplierVal =
      bonus?.bonusMultiplier && typeof bonus.bonusMultiplier === "object"
        ? bonus.bonusMultiplier.value ?? null
        : typeof bonus?.bonusMultiplier === "number"
          ? bonus.bonusMultiplier
          : null;

    const winners = Array.isArray(raw.winners)
      ? raw.winners
          .map((w) => ({
            screenName: str(w?.screenName, "") ?? "",
            winnings: num(w?.winnings, 0),
          }))
          .filter((w) => w.screenName || w.winnings > 0)
          .slice(0, 5)
      : [];

    return {
      id: str(raw.id, "") ?? "",
      eventId: str(data?.id, "") ?? "",
      settledAt: str(data?.settledAt),
      startedAt: str(data?.startedAt),
      status: str(data?.status),
      gameType: str(data?.gameType),
      dealerName: str(data?.dealer?.name),
      tableName: str(data?.table?.name),
      tableId: str(data?.table?.id),
      wager: num(data?.wager, 0),
      payout: num(data?.payout, 0),
      numOfParticipants: num(data?.numOfParticipants, 0),
      totalWinners: num(raw.totalWinners, 0),
      totalAmount: num(raw.totalAmount, 0),
      topSlotSector: str(topSlot?.wheelSector),
      topSlotMultiplier: topSlot?.multiplier == null ? null : num(topSlot.multiplier),
      wheelResultType: str(wheelResult?.type),
      wheelResultSector: str(wheelResult?.wheelSector),
      isTopSlotMatched: bool(outcome?.isTopSlotMatchedToWheelResult, false),
      maxMultiplier: outcome?.maxMultiplier == null ? null : num(outcome.maxMultiplier),
      bonusType: str(bonus?.type),
      bonusResultColor: str(bonusResult?.color),
      bonusResultType: str(bonusResult?.type),
      bonusResultMultiplier:
        bonusResult?.multiplier == null ? null : num(bonusResult.multiplier),
      bonusTotalMultiplier: bonus?.totalMultiplier == null ? null : num(bonus.totalMultiplier),
      bonusMultiplierValue: bonusMultiplierVal,
      topWinners: winners,
      raw,
    };
  } catch {
    return null;
  }
}

export function normalizeSpins(items: RawGameEvent[]): NormalizedSpin[] {
  if (!Array.isArray(items)) return [];
  const out: NormalizedSpin[] = [];
  for (const item of items) {
    const n = normalizeSpin(item);
    if (n) out.push(n);
  }
  return out;
}

export function normalizeStats(raw: RawStatsResponse | null | undefined): NormalizedStats {
  const safe = raw ?? ({} as RawStatsResponse);
  return {
    totalCount: num(safe.totalCount, 0),
    aggStats: (safe.aggStats ?? []).map((s) => ({
      wheelResult: str(s.wheelResult, "") ?? "",
      count: num(s.count, 0),
      percentage: num(s.percentage, 0),
      lastOccurredAt: str(s.lastOccurredAt),
      lastSeenBefore: s.lastSeenBefore == null ? null : num(s.lastSeenBefore),
      hotFrequencyPercentage:
        s.hotFrequencyPercentage == null ? null : num(s.hotFrequencyPercentage),
    })),
    bestMultipliers: (safe.bestMultipliers ?? []).map((b) => ({
      id: str(b.id, "") ?? "",
      wheelResult: str(b.wheelResult, "") ?? "",
      lastOccurredAt: str(b.lastOccurredAt),
      maxMultiplier: num(b.maxMultiplier, 0),
      bigWinStreamUrl: str(b.bigWinStreamUrl),
    })),
    topSlotMatchedStats: (safe.topSlotToWheelResultStats ?? []).map((t) => ({
      matched: bool(t.matched, false),
      percentage: num(t.percentage, 0),
      totalCount: num(t.totalCount, 0),
      topSlotMatchedFrequencyPercentage:
        t.topSlotMatchedFrequencyPercentage == null
          ? null
          : num(t.topSlotMatchedFrequencyPercentage),
      topSlotMatchedLongTermAverage:
        t.topSlotMatchedLongTermAverage == null
          ? null
          : num(t.topSlotMatchedLongTermAverage),
    })),
    bestIndividualWins: (safe.bestIndividualWins ?? []).map((w) => ({
      id: str(w.id, "") ?? "",
      screenName: str(w.screenName, "") ?? "",
      winAmount: num(w.winAmount, 0),
      wheelResult: str(w.wheelResult, "") ?? "",
      maxMultiplier: num(w.maxMultiplier, 0),
      lastOccurredAt: str(w.lastOccurredAt),
    })),
    crazyBonusFlapperStats: (safe.crazyBonusFlapperStats ?? []).map((f) => ({
      symbol: str(f.symbol, "") ?? "",
      avgMultiplier: num(f.avgMultiplier, 0),
      flapperLongTermAverageMultiplier:
        f.flapperLongTermAverageMultiplier == null
          ? null
          : num(f.flapperLongTermAverageMultiplier),
      flapperMultiplierFrequencyPercentage:
        f.flapperMultiplierFrequencyPercentage == null
          ? null
          : num(f.flapperMultiplierFrequencyPercentage),
    })),
    coinFlipStats: (safe.coinFlipStats ?? []).map((c) => ({
      symbol: str(c.symbol, "") ?? "",
      avgMultiplier: num(c.avgMultiplier, 0),
      count: num(c.count, 0),
      percentage: num(c.percentage, 0),
      coinFlipFrequencyPercentage:
        c.coinFlipFrequencyPercentage == null ? null : num(c.coinFlipFrequencyPercentage),
      coinFlipMultiplierFrequencyPercentage:
        c.coinFlipMultiplierFrequencyPercentage == null
          ? null
          : num(c.coinFlipMultiplierFrequencyPercentage),
      coinFlipMultiplierLongTermAverage:
        c.coinFlipMultiplierLongTermAverage == null
          ? null
          : num(c.coinFlipMultiplierLongTermAverage),
      coinFlipPercentageLongTermAverage:
        c.coinFlipPercentageLongTermAverage == null
          ? null
          : num(c.coinFlipPercentageLongTermAverage),
    })),
    cashHuntSymbolStats: (safe.cashHuntSymbolStats ?? []).map((c) => ({
      symbol: str(c.symbol, "") ?? "",
      avgMultiplier: num(c.avgMultiplier, 0),
      count: num(c.count, 0),
      cashHuntMultiplierFrequencyPercentage:
        c.cashHuntMultiplierFrequencyPercentage == null
          ? null
          : num(c.cashHuntMultiplierFrequencyPercentage),
      cashHuntLongTermAverage:
        c.cashHuntLongTermAverage == null ? null : num(c.cashHuntLongTermAverage),
    })),
    raw: safe,
  };
}

export function buildPrediction(stats: NormalizedStats): NormalizedPrediction {
  const hot = stats.aggStats
    .filter((s) => s.hotFrequencyPercentage != null)
    .map((s) => ({
      sector: s.wheelResult,
      hotFrequencyPercentage: s.hotFrequencyPercentage as number,
    }))
    .sort((a, b) => b.hotFrequencyPercentage - a.hotFrequencyPercentage);

  const hotSectors = hot.filter((h) => h.hotFrequencyPercentage > 0).slice(0, 4);
  const coldSectors = hot
    .filter((h) => h.hotFrequencyPercentage < 0)
    .slice(-4)
    .reverse();

  const overdueSectors = stats.aggStats
    .filter((s) => s.lastSeenBefore != null)
    .map((s) => ({
      sector: s.wheelResult,
      lastSeenBefore: s.lastSeenBefore as number,
    }))
    .sort((a, b) => b.lastSeenBefore - a.lastSeenBefore)
    .slice(0, 4);

  const matchedStat = stats.topSlotMatchedStats.find((s) => s.matched);
  const coinBlue = stats.coinFlipStats.find((c) => c.symbol === "Blue");
  const coinRed = stats.coinFlipStats.find((c) => c.symbol === "Red");
  const bestFlap = stats.crazyBonusFlapperStats
    .slice()
    .sort((a, b) => b.avgMultiplier - a.avgMultiplier)[0];
  const bestCH = stats.cashHuntSymbolStats
    .slice()
    .sort((a, b) => b.avgMultiplier - a.avgMultiplier)[0];

  const parts: string[] = [];
  if (hotSectors.length) {
    parts.push(
      `Hot: ${hotSectors.map((h) => `${label(h.sector)} (+${h.hotFrequencyPercentage.toFixed(1)}%)`).join(", ")}`
    );
  }
  if (coldSectors.length) {
    parts.push(
      `Cold: ${coldSectors.map((h) => `${label(h.sector)} (${h.hotFrequencyPercentage.toFixed(1)}%)`).join(", ")}`
    );
  }
  if (overdueSectors.length) {
    parts.push(
      `Overdue: ${overdueSectors.map((h) => `${label(h.sector)} (${h.lastSeenBefore})`).join(", ")}`
    );
  }
  if (matchedStat) {
    parts.push(`Top slot matched ${matchedStat.percentage.toFixed(1)}%`);
  }

  return {
    hotSectors,
    coldSectors,
    overdueSectors,
    topSlotMatchedPercentage: matchedStat?.percentage ?? null,
    topSlotMatchedLongTermAverage: matchedStat?.topSlotMatchedLongTermAverage ?? null,
    coinFlipBluePercentage: coinBlue?.percentage ?? null,
    coinFlipRedPercentage: coinRed?.percentage ?? null,
    bestFlapper: bestFlap
      ? { symbol: bestFlap.symbol, avgMultiplier: bestFlap.avgMultiplier }
      : null,
    bestCashHuntSymbol: bestCH
      ? { symbol: bestCH.symbol, avgMultiplier: bestCH.avgMultiplier }
      : null,
    summary: parts.join(" | ") || "Awaiting live statistics data.",
  };
}

export function label(sector: string | null | undefined): string {
  if (!sector) return "—";
  return WHEEL_SECTOR_LABELS[sector] ?? sector;
}

export function cardImage(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return WHEEL_RESULT_CARD_IMAGE[sector] ?? null;
}

export function topSlotImage(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return TOP_SLOT_IMAGE[sector] ?? null;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
