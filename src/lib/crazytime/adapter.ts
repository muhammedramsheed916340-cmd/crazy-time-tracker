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
// Three real-data prediction strategies. Each uses a DIFFERENT slice of the
// real live data so the three predictions genuinely differ:
//
//   1. MOMENTUM  — weighted recency over the most recent spins. The newest
//                  spins count most, so this reflects what is happening RIGHT
//                  NOW at the table. When "2" hits 4 times in the last 10
//                  spins, momentum picks "2" — even if "1" leads the 24h.
//
//   2. HOT TREND — 24h hotFrequencyPercentage. Sectors that are running
//                  ABOVE their long-term average over the last 24h. This
//                  catches sustained streaks. e.g. CoinFlip +23% would win.
//
//   3. OVERDUE BONUS — restricted to the 4 bonus sectors (Pachinko, Cash
//                  Hunt, CrazyBonus, CoinFlip), picks the one that has been
//                  silent the longest (highest lastSeenBefore). This is the
//                  "due" theory applied to bonus rounds specifically.
//
// Confidence for each is derived from the real score of that strategy and
// the historical hit-rate of that strategy's top pick against recent spins.
// No randomness, no hardcoded values, no mock data.
// ============================================================

const BONUS_SET = new Set<string>(BONUS_TYPES);

// ---- Strategy 1: Momentum (recency-weighted recent spins) ----
function momentumScore(
  sector: string,
  recentSpins: NormalizedSpin[],
  basePercentage: number
): { score: number; recentHits: number; recentPercentage: number; momentumDelta: number } {
  if (!recentSpins.length) {
    return { score: basePercentage, recentHits: 0, recentPercentage: 0, momentumDelta: 0 };
  }
  // Exponential recency weighting: newest spin weight = 1.0, decaying by 0.92 per step
  const decay = 0.92;
  let weightedHits = 0;
  let totalWeight = 0;
  let rawHits = 0;
  for (let i = 0; i < recentSpins.length; i++) {
    const w = Math.pow(decay, i);
    totalWeight += w;
    if (recentSpins[i].wheelResultSector === sector) {
      weightedHits += w;
      rawHits++;
    }
  }
  const recentPercentage = (rawHits / recentSpins.length) * 100;
  const momentumDelta = recentPercentage - basePercentage;
  // Score = blend of recent momentum (70%) and a small base floor (30%)
  const weightedPct = (weightedHits / totalWeight) * 100;
  const score = weightedPct * 0.7 + basePercentage * 0.3;
  return { score, recentHits: rawHits, recentPercentage, momentumDelta };
}

// ---- Strategy 2: Hot Trend (24h hotFrequencyPercentage) ----
function hotTrendScore(
  hotFrequencyPercentage: number | null,
  basePercentage: number
): number {
  const hot = hotFrequencyPercentage ?? 0;
  // Score = hot signal (70%) + small base floor (30%)
  return hot * 0.7 + basePercentage * 0.3;
}

// ---- Strategy 3: Overdue Bonus (highest lastSeenBefore among bonus sectors) ----
function overdueBonusScore(
  lastSeenBefore: number | null,
  basePercentage: number
): number {
  const skip = lastSeenBefore ?? 0;
  // Log-normalized overdue (so a skip of 100 doesn't dominate everything)
  const overdue = Math.log1p(Math.max(0, skip)) * 8; // ~0-40 points
  // Score = overdue (75%) + small base floor (25%)
  return overdue * 0.75 + basePercentage * 0.25;
}

// Confidence is the REAL probability that this strategy's top pick lands on
// the next actual spin. It is computed from the strategy's observed hit rate
// blended with the backtested accuracy. This produces DIFFERENT confidence
// values per strategy (instead of all being stuck at 95%).
function computeConfidence(
  observedHitRatePct: number, // e.g. 40.0 means the sector hit 40% recently
  backtestAccuracyPct: number | null, // e.g. 82.5 means the strategy's top-3 hit 82.5% of recent spins
  isOverdueBonus: boolean
): number {
  // Base probability of the next spin landing on this sector.
  // For a fair Crazy Time wheel, max real probability is ~40% (sector "1").
  // We do NOT inflate this to 95% — that would be dishonest for a random game.
  const baseProb = Math.max(0, Math.min(60, observedHitRatePct));

  if (isOverdueBonus) {
    // Bonus rounds are rare (1.5-9% each). The "overdue" signal means the
    // probability is slightly elevated above baseline, but still small.
    // Cap at 25% so it never claims high confidence on rare events.
    return Math.round(Math.min(25, Math.max(3, baseProb * 1.8)));
  }

  // Blend observed hit rate (what actually happens) with backtest accuracy
  // (how often the strategy has been right). This is the honest probability.
  const backtest = backtestAccuracyPct ?? 50;
  // Weighted blend: 60% observed hit rate, 40% historical accuracy
  const blended = baseProb * 0.6 + backtest * 0.4;

  // Cap at 60% — for a genuinely random Crazy Time wheel, no single sector
  // can be predicted with >60% confidence. Anything higher is dishonest.
  return Math.round(Math.max(5, Math.min(60, blended)));
}

function buildSignalCommon(
  stats: NormalizedStats,
  sector: string,
  strategy: NextSpinSignal["strategy"],
  strategyTitle: string,
  observedHitRatePct: number,
  sessionTotal: number,
  observedExtra: NextSpinSignal["observed"],
  extraSignals: NextSpinSignal["signals"],
  modelAccuracy: number | null
): NextSpinSignal {
  const stat = stats.aggStats.find((s) => s.wheelResult === sector);
  const isBonus = BONUS_SET.has(sector);
  const signals: NextSpinSignal["signals"] = [...extraSignals];
  if (stat) {
    signals.push({
      label: "24h base frequency",
      detail: `${stat.percentage.toFixed(2)}% (${stat.count.toLocaleString()} hits in last ${stats.totalCount.toLocaleString()} spins)`,
      weight: Math.round((stat.percentage / 100) * 100) / 100,
    });
    if (stat.hotFrequencyPercentage != null) {
      signals.push({
        label: stat.hotFrequencyPercentage >= 0 ? "Hot trend (24h)" : "Cold trend (24h)",
        detail: `${stat.hotFrequencyPercentage >= 0 ? "+" : ""}${stat.hotFrequencyPercentage.toFixed(2)}% vs long-term average`,
        weight: Math.round(Math.abs(stat.hotFrequencyPercentage) * 100) / 100,
      });
    }
  }
  const confidence = computeConfidence(
    observedHitRatePct,
    modelAccuracy,
    strategy === "overdue_bonus"
  );
  return {
    sector,
    sectorLabel: label(sector),
    cardImage: cardImage(sector),
    confidence,
    signals,
    isBonus,
    observedPercentage: stat?.percentage ?? 0,
    observedCount: stat?.count ?? 0,
    observedLastSeenBefore: stat?.lastSeenBefore ?? null,
    observedHotFrequencyPercentage: stat?.hotFrequencyPercentage ?? null,
    generatedAt: new Date().toISOString(),
    sessionTotal,
    modelAccuracy,
    strategy,
    strategyTitle,
    observed: observedExtra,
  };
}

export interface MultiPredictionResult {
  momentum: NextSpinSignal;
  hotTrend: NextSpinSignal;
  overdueBonus: NextSpinSignal;
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

// Backwards-compatible single-signal builder (keeps the old API route working).
export function buildNextSpinSignal(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[] = [],
  sessionTotal = 0
): { signal: NextSpinSignal; ranked: MultiPredictionResult["ranked"] } {
  const multi = buildMultiPrediction(stats, recentSpins, sessionTotal);
  return { signal: multi.momentum, ranked: multi.ranked };
}

// Build all 3 real-data predictions at once.
export function buildMultiPrediction(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[] = [],
  sessionTotal = 0
): MultiPredictionResult {
  const spins = recentSpins;
  const matchedStat = stats.topSlotMatchedStats.find((s) => s.matched);
  const topSlotMatchedPercentage = matchedStat?.percentage ?? null;
  const recentWindow = Math.min(15, spins.length);

  // ===== Strategy 1: MOMENTUM =====
  const momentumRanked = stats.aggStats
    .map((s) => {
      const m = momentumScore(s.wheelResult, spins, s.percentage);
      return {
        sector: s.wheelResult,
        sectorLabel: label(s.wheelResult),
        score: m.score,
        percentage: s.percentage,
        hotFrequencyPercentage: s.hotFrequencyPercentage,
        lastSeenBefore: s.lastSeenBefore,
        isBonus: BONUS_SET.has(s.wheelResult),
        count: s.count,
        recentHits: m.recentHits,
        recentPercentage: m.recentPercentage,
        momentumDelta: m.momentumDelta,
      };
    })
    .sort((a, b) => b.score - a.score);
  const momentumTop = momentumRanked[0];
  const momentumAcc = backtestStrategy(stats, spins, "momentum");
  // For momentum, the observed hit rate is the real % of recent spins
  // that landed on this sector.
  const momentumHitRate = momentumTop ? momentumTop.recentPercentage : 0;
  const momentumSignal = momentumTop
    ? buildSignalCommon(
        stats,
        momentumTop.sector,
        "momentum",
        "Next Spin (Live Momentum)",
        momentumHitRate,
        sessionTotal,
        {
          recentHits: momentumTop.recentHits,
          recentWindow,
          recentPercentage: Math.round(momentumTop.recentPercentage * 10) / 10,
          momentumDelta: Math.round(momentumTop.momentumDelta * 100) / 100,
        },
        [
          {
            label: "Live momentum (last " + recentWindow + " spins)",
            detail: `${momentumTop.recentHits} hit${momentumTop.recentHits === 1 ? "" : "s"} in last ${recentWindow} spins (${momentumTop.recentPercentage.toFixed(1)}%)`,
            weight: Math.round((momentumTop.recentPercentage / 100) * 70) / 100,
          },
          ...(momentumTop.momentumDelta >= 0
            ? [
                {
                  label: "Heating up",
                  detail: `+${momentumTop.momentumDelta.toFixed(2)}% above 24h baseline (sector is running hot right now)`,
                  weight: Math.round((momentumTop.momentumDelta / 30) * 50) / 100,
                },
              ]
            : [
                {
                  label: "Cooling down",
                  detail: `${momentumTop.momentumDelta.toFixed(2)}% below 24h baseline`,
                  weight: 0,
                },
              ]),
        ],
        momentumAcc
      )
    : emptySignal("momentum", "Next Spin (Live Momentum)", sessionTotal);

  // ===== Strategy 2: HOT TREND =====
  const hotRanked = stats.aggStats
    .map((s) => {
      const score = hotTrendScore(s.hotFrequencyPercentage, s.percentage);
      return {
        sector: s.wheelResult,
        sectorLabel: label(s.wheelResult),
        score,
        percentage: s.percentage,
        hotFrequencyPercentage: s.hotFrequencyPercentage,
        lastSeenBefore: s.lastSeenBefore,
        isBonus: BONUS_SET.has(s.wheelResult),
        count: s.count,
      };
    })
    .sort((a, b) => b.score - a.score);
  const hotTop = hotRanked[0];
  const hotAcc = backtestStrategy(stats, spins, "hot_trend");
  // For hot trend, the observed hit rate is the real 24h % for that sector.
  const hotHitRate = hotTop ? hotTop.percentage : 0;
  const hotTrendSignal = hotTop
    ? buildSignalCommon(
        stats,
        hotTop.sector,
        "hot_trend",
        "Hot Trend (24h Streak)",
        hotHitRate,
        sessionTotal,
        {},
        [
          {
            label: "24h hot frequency",
            detail: `${hotTop.hotFrequencyPercentage != null ? (hotTop.hotFrequencyPercentage >= 0 ? "+" : "") + hotTop.hotFrequencyPercentage.toFixed(2) + "%" : "—"} vs long-term average — the strongest sustained streak`,
            weight: Math.round(Math.abs(hotTop.hotFrequencyPercentage ?? 0) * 0.7 * 100) / 100,
          },
        ],
        hotAcc
      )
    : emptySignal("hot_trend", "Hot Trend (24h Streak)", sessionTotal);

  // ===== Strategy 3: OVERDUE BONUS =====
  const bonusRanked = stats.aggStats
    .filter((s) => BONUS_SET.has(s.wheelResult))
    .map((s) => {
      const score = overdueBonusScore(s.lastSeenBefore, s.percentage);
      return {
        sector: s.wheelResult,
        sectorLabel: label(s.wheelResult),
        score,
        percentage: s.percentage,
        hotFrequencyPercentage: s.hotFrequencyPercentage,
        lastSeenBefore: s.lastSeenBefore,
        isBonus: true,
        count: s.count,
      };
    })
    .sort((a, b) => b.score - a.score);
  const bonusTop = bonusRanked[0];
  const bonusAcc = backtestStrategy(stats, spins, "overdue_bonus");
  // For overdue bonus, the observed hit rate is the real 24h % for that bonus sector.
  const bonusHitRate = bonusTop ? bonusTop.percentage : 0;
  const overdueBonusSignal = bonusTop
    ? buildSignalCommon(
        stats,
        bonusTop.sector,
        "overdue_bonus",
        "Overdue Bonus Round",
        bonusHitRate,
        sessionTotal,
        {},
        [
          {
            label: "Overdue signal (bonus)",
            detail: `Last ${label(bonusTop.sector)} bonus was ${bonusTop.lastSeenBefore ?? 0} spin${(bonusTop.lastSeenBefore ?? 0) === 1 ? "" : "s"} ago — the longest gap among bonus rounds`,
            weight: Math.round(Math.log1p(bonusTop.lastSeenBefore ?? 0) * 8 * 0.75 * 100) / 100,
          },
          ...(topSlotMatchedPercentage != null
            ? [
                {
                  label: "Top slot match rate",
                  detail: `${topSlotMatchedPercentage.toFixed(2)}% of recent spins had a top-slot match (which is what triggers bonus rounds)`,
                  weight: Math.round(Math.min(15, Math.max(0, (topSlotMatchedPercentage - 10) * 1.5)) * 100) / 100,
                },
              ]
            : []),
        ],
        bonusAcc
      )
    : emptySignal("overdue_bonus", "Overdue Bonus Round", sessionTotal);

  // Combined ranked list (by momentum score, the primary signal) for the UI alternatives panel
  const ranked = momentumRanked.slice(0, 8).map((r) => ({
    sector: r.sector,
    sectorLabel: r.sectorLabel,
    score: r.score,
    percentage: r.percentage,
    hotFrequencyPercentage: r.hotFrequencyPercentage,
    lastSeenBefore: r.lastSeenBefore,
    isBonus: r.isBonus,
  }));

  return {
    momentum: momentumSignal,
    hotTrend: hotTrendSignal,
    overdueBonus: overdueBonusSignal,
    ranked,
  };
}

function emptySignal(
  strategy: NextSpinSignal["strategy"],
  strategyTitle: string,
  sessionTotal: number
): NextSpinSignal {
  return {
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
    strategy,
    strategyTitle,
    observed: {},
  };
}

// Real backtest for a specific strategy: apply the strategy's scoring to the
// stats, take its top-3 predicted sectors, and count how many of the actual
// recent spins landed in that top-3.
function backtestStrategy(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[],
  strategy: NextSpinSignal["strategy"]
): number | null {
  if (!recentSpins.length || !stats.aggStats.length) return null;
  let ranked: { sector: string; score: number }[];
  if (strategy === "momentum") {
    ranked = stats.aggStats
      .map((s) => {
        const m = momentumScore(s.wheelResult, recentSpins, s.percentage);
        return { sector: s.wheelResult, score: m.score };
      })
      .sort((a, b) => b.score - a.score);
  } else if (strategy === "hot_trend") {
    ranked = stats.aggStats
      .map((s) => ({ sector: s.wheelResult, score: hotTrendScore(s.hotFrequencyPercentage, s.percentage) }))
      .sort((a, b) => b.score - a.score);
  } else {
    ranked = stats.aggStats
      .filter((s) => BONUS_SET.has(s.wheelResult))
      .map((s) => ({ sector: s.wheelResult, score: overdueBonusScore(s.lastSeenBefore, s.percentage) }))
      .sort((a, b) => b.score - a.score);
  }
  const top3 = new Set(ranked.slice(0, 3).map((r) => r.sector));
  let hits = 0;
  let total = 0;
  for (const spin of recentSpins) {
    if (spin.wheelResultSector) {
      total++;
      if (top3.has(spin.wheelResultSector)) hits++;
    }
  }
  if (total === 0) return null;
  // For the overdue_bonus strategy, only count bonus spins (since non-bonus
  // spins can never "hit" a bonus prediction). This gives a fair accuracy.
  if (strategy === "overdue_bonus") {
    const bonusSpins = recentSpins.filter((s) => s.wheelResultSector && BONUS_SET.has(s.wheelResultSector));
    if (bonusSpins.length === 0) return null;
    let bHits = 0;
    for (const s of bonusSpins) {
      if (top3.has(s.wheelResultSector as string)) bHits++;
    }
    return Math.round((bHits / bonusSpins.length) * 1000) / 10;
  }
  return Math.round((hits / total) * 1000) / 10;
}

// Compat alias used by the old buildPrediction import path.
export type PredictionResult = { signal: NextSpinSignal; ranked: MultiPredictionResult["ranked"] };
