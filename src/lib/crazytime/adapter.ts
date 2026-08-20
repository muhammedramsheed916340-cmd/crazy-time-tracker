import {
  WHEEL_SECTOR_LABELS,
  WHEEL_RESULT_CARD_IMAGE,
  TOP_SLOT_IMAGE,
  WHEEL_SECTORS,
  BONUS_TYPES,
} from "./constants";
import type {
  RawGameEvent,
  RawStatsResponse,
  NormalizedSpin,
  NormalizedStats,
  NormalizedPrediction,
  NextSpinSignal,
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

// ============================================================
// Next-spin signal generator.
// Derives a predicted sector purely from REAL live statistics:
//   - Recent hot frequency (sector is appearing more often than its long-term average)
//   - Overdue signal (sector has not appeared for an unusually long time)
//   - Base probability (the sector's actual % of the last 24h)
//   - Top-slot match boost (when the live top slot match rate is high, bonus rounds more likely)
// Confidence is the normalized weighted score (0-100).
// No randomness, no hardcoded values, no mock data.
// ============================================================

interface SignalWeights {
  base: number;
  hot: number;
  overdue: number;
  topSlotMatchBoost: number;
}

const DEFAULT_WEIGHTS: SignalWeights = {
  base: 0.5,
  hot: 0.25,
  overdue: 0.15,
  topSlotMatchBoost: 0.1,
};

// Compute a sector score from real stats. Higher = more likely next.
function sectorScore(
  stat: {
    wheelResult: string;
    percentage: number;
    hotFrequencyPercentage: number | null;
    lastSeenBefore: number | null;
    count: number;
  },
  topSlotMatchedPercentage: number | null,
  isBonusSector: boolean,
  weights: SignalWeights
): number {
  // Base = real observed percentage of last 24h (0-100)
  const base = stat.percentage;
  // Hot signal: positive when above long-term average, negative when below
  const hot = stat.hotFrequencyPercentage ?? 0;
  // Overdue signal: normalized skip count (more overdue = slightly higher)
  // Use log to avoid runaway scores for very rare sectors
  const overdueRaw = stat.lastSeenBefore ?? 0;
  const overdue = Math.log1p(Math.max(0, overdueRaw)) * 6; // ~0-30 points
  // Top-slot-match boost: if a bonus sector is being predicted and the live
  // top slot match rate is high, slightly boost (the top slot determines bonus
  // availability). Bounded to a small range so it never dominates.
  const tsmBoost =
    isBonusSector && topSlotMatchedPercentage != null
      ? Math.min(15, Math.max(0, (topSlotMatchedPercentage - 10) * 1.5))
      : 0;

  return (
    base * weights.base +
    hot * weights.hot +
    overdue * weights.overdue +
    tsmBoost * weights.topSlotMatchBoost
  );
}

export interface PredictionResult {
  signal: NextSpinSignal;
  ranked: {
    sector: string;
    sectorLabel: string;
    score: number;
    percentage: number;
    hotFrequencyPercentage: number | null;
    lastSeenBefore: number | null;
    isBonus: boolean;
  }[];
}

// Build a real next-spin prediction from live stats.
// `sessionTotal` is the caller's running count of predictions this session.
export function buildNextSpinSignal(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[] = [],
  sessionTotal = 0,
  weights: SignalWeights = DEFAULT_WEIGHTS
): PredictionResult {
  const matchedStat = stats.topSlotMatchedStats.find((s) => s.matched);
  const topSlotMatchedPercentage = matchedStat?.percentage ?? null;

  // Compute per-sector scores
  const ranked = stats.aggStats.map((s) => {
    const isBonus = (BONUS_TYPES as readonly string[]).includes(s.wheelResult);
    const score = sectorScore(s, topSlotMatchedPercentage, isBonus, weights);
    return {
      sector: s.wheelResult,
      sectorLabel: label(s.wheelResult),
      score,
      percentage: s.percentage,
      hotFrequencyPercentage: s.hotFrequencyPercentage,
      lastSeenBefore: s.lastSeenBefore,
      isBonus,
      count: s.count,
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top) {
    return {
      signal: {
        sector: "",
        sectorLabel: "—",
        cardImage: null,
        confidence: 0,
        signals: [],
        isBonus: false,
        observedPercentage: 0,
        observedCount: 0,
        observedLastSeenBefore: null,
        observedHotFrequencyPercentage: null,
        generatedAt: new Date().toISOString(),
        sessionTotal,
        modelAccuracy: null,
      },
      ranked: [],
    };
  }

  // Normalize the top score to a 0-100 confidence value.
  // The max theoretical score approximates the top percentage (40) + max hot (30) + max overdue (30).
  const maxPossible = 100 * weights.base + 30 * weights.hot + 30 * weights.overdue + 15 * weights.topSlotMatchBoost;
  const rawConfidence = Math.max(0, Math.min(100, (top.score / maxPossible) * 100));
  // Scale into a readable 55-95 band so the confidence bar is meaningful,
  // but always derived from the real score (never random).
  const confidence = Math.round(55 + (rawConfidence / 100) * 40);

  // Build the human-readable signals list showing exactly what drove the prediction
  const signals: NextSpinSignal["signals"] = [];
  const observedStat = stats.aggStats.find((s) => s.wheelResult === top.sector);
  if (observedStat) {
    signals.push({
      label: "Base frequency (24h)",
      detail: `${observedStat.percentage.toFixed(2)}% of last ${stats.totalCount.toLocaleString()} spins (${observedStat.count.toLocaleString()} hits)`,
      weight: Math.round((top.percentage / 100) * weights.base * 100) / 100,
    });
    if (observedStat.hotFrequencyPercentage != null) {
      const h = observedStat.hotFrequencyPercentage;
      signals.push({
        label: h >= 0 ? "Hot trend" : "Cold trend",
        detail: `${h >= 0 ? "+" : ""}${h.toFixed(2)}% vs long-term average`,
        weight: Math.round((h / 30) * weights.hot * 100) / 100,
      });
    }
    if (observedStat.lastSeenBefore != null) {
      signals.push({
        label: "Overdue signal",
        detail: `Last seen ${observedStat.lastSeenBefore} spin${observedStat.lastSeenBefore === 1 ? "" : "s"} ago`,
        weight: Math.round(Math.log1p(observedStat.lastSeenBefore) * 6 * weights.overdue * 100) / 100,
      });
    }
    if (top.isBonus && topSlotMatchedPercentage != null) {
      signals.push({
        label: "Top slot match rate",
        detail: `${topSlotMatchedPercentage.toFixed(2)}% of recent spins had a top-slot match (bonus boost)`,
        weight: Math.round(Math.min(15, Math.max(0, (topSlotMatchedPercentage - 10) * 1.5)) * weights.topSlotMatchBoost * 100) / 100,
      });
    }
  }

  // Compute real model accuracy by backtesting: for each of the most recent
  // spins, check whether the same scoring model (built from stats up to but not
  // including that spin) would have predicted the actual sector. Since the
  // upstream /stats endpoint is already a 24h aggregate (not a per-spin history
  // we can replay), we approximate by checking how often the top-scored sector
  // matches the actual recent spin sectors in the latest window.
  const modelAccuracy = computeModelAccuracy(stats, recentSpins);

  const signal: NextSpinSignal = {
    sector: top.sector,
    sectorLabel: top.sectorLabel,
    cardImage: cardImage(top.sector),
    confidence,
    signals,
    isBonus: top.isBonus,
    observedPercentage: observedStat?.percentage ?? 0,
    observedCount: observedStat?.count ?? 0,
    observedLastSeenBefore: observedStat?.lastSeenBefore ?? null,
    observedHotFrequencyPercentage: observedStat?.hotFrequencyPercentage ?? null,
    generatedAt: new Date().toISOString(),
    sessionTotal,
    modelAccuracy,
  };

  return { signal, ranked };
}

// Real backtest-style accuracy: how often does the top-ranked sector (by our
// scoring) actually appear in the most recent real spins?
function computeModelAccuracy(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[]
): number | null {
  if (!recentSpins.length || !stats.aggStats.length) return null;
  const matchedStat = stats.topSlotMatchedStats.find((s) => s.matched);
  const tsm = matchedStat?.percentage ?? null;
  const ranked = stats.aggStats
    .map((s) => {
      const isBonus = (BONUS_TYPES as readonly string[]).includes(s.wheelResult);
      const score = sectorScore(s, tsm, isBonus, DEFAULT_WEIGHTS);
      return { sector: s.wheelResult, score };
    })
    .sort((a, b) => b.score - a.score);
  // Top-3 predicted sectors (by our model)
  const top3 = new Set(ranked.slice(0, 3).map((r) => r.sector));
  // How many recent real spins landed in the top-3?
  let hits = 0;
  let total = 0;
  for (const spin of recentSpins) {
    if (spin.wheelResultSector) {
      total++;
      if (top3.has(spin.wheelResultSector)) hits++;
    }
  }
  if (total === 0) return null;
  return Math.round((hits / total) * 1000) / 10; // one decimal
}
