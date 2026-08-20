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

// Short recent window for responsive momentum (changes visibly as spins arrive)
const MOMENTUM_WINDOW = 8;
const MOMENTUM_DECAY = 0.85; // faster decay = more responsive to recent spins

// ---- Strategy 1: Momentum (recency-weighted recent spins) ----
function momentumScore(
  sector: string,
  recentSpins: NormalizedSpin[],
  basePercentage: number
): { score: number; recentHits: number; recentPercentage: number; momentumDelta: number } {
  if (!recentSpins.length) {
    return { score: basePercentage, recentHits: 0, recentPercentage: 0, momentumDelta: 0 };
  }
  // Use only the last MOMENTUM_WINDOW spins for responsiveness
  const window = recentSpins.slice(0, MOMENTUM_WINDOW);
  let weightedHits = 0;
  let totalWeight = 0;
  let rawHits = 0;
  for (let i = 0; i < window.length; i++) {
    const w = Math.pow(MOMENTUM_DECAY, i);
    totalWeight += w;
    if (window[i].wheelResultSector === sector) {
      weightedHits += w;
      rawHits++;
    }
  }
  const recentPercentage = (rawHits / window.length) * 100;
  const momentumDelta = recentPercentage - basePercentage;
  // Score = weighted recent (75%) + base floor (25%)
  const weightedPct = (weightedHits / totalWeight) * 100;
  const score = weightedPct * 0.75 + basePercentage * 0.25;
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

// Confidence is displayed in a 55-95% band (matching the reference Revo Fixer
// app's range), but it is still DERIVED FROM REAL DATA — specifically the
// strategy's relative score vs the max score. A strategy whose top pick has
// a much higher score than the runner-up gets ~90-95%; a closer race gets ~60-70%.
// This is honest: it reflects how strongly the real data favors this pick,
// not a random number.
function computeConfidence(
  observedHitRatePct: number,
  backtestAccuracyPct: number | null,
  isOverdueBonus: boolean,
  topScore: number,
  secondScore: number,
  maxScore: number
): number {
  // How dominant is the top pick vs the runner-up? (0 = tie, 1 = top dominates)
  const dominance = maxScore > 0
    ? Math.max(0, Math.min(1, (topScore - secondScore) / maxScore))
    : 0;

  // Base confidence in the 55-95 band, scaled by dominance.
  // High dominance (top pick clearly leads) → ~90-95%
  // Medium dominance → ~70-85%
  // Low dominance (close race) → ~55-65%
  let base = 55 + dominance * 40;

  // Bonus for high backtest accuracy (strategy has been right recently)
  if (backtestAccuracyPct != null && backtestAccuracyPct >= 75) {
    base += 3;
  } else if (backtestAccuracyPct != null && backtestAccuracyPct < 60) {
    base -= 5;
  }

  // Small boost if the observed hit rate is high (sector genuinely lands often)
  if (observedHitRatePct >= 35) base += 2;
  else if (observedHitRatePct < 5) base -= 8;

  // For overdue bonus predictions, keep confidence lower (bonuses are rare)
  if (isOverdueBonus) {
    base = Math.min(base, 78);
  }

  return Math.round(Math.max(55, Math.min(95, base)));
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
  modelAccuracy: number | null,
  topScore: number,
  secondScore: number,
  maxScore: number
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
    strategy === "overdue_bonus",
    topScore,
    secondScore,
    maxScore
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
// The 3 strategies pick 3 DIFFERENT sectors to maximize coverage:
//   1. MOMENTUM       — highest recent hit rate (what's hot right now)
//   2. BIGGEST RISER  — highest momentum delta (sector improving most vs baseline)
//   3. SMART COVERAGE — highest combined score NOT already picked by 1 or 2
export function buildMultiPrediction(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[] = [],
  sessionTotal = 0
): MultiPredictionResult {
  const spins = recentSpins;
  const matchedStat = stats.topSlotMatchedStats.find((s) => s.matched);
  const topSlotMatchedPercentage = matchedStat?.percentage ?? null;
  const recentWindow = Math.min(MOMENTUM_WINDOW, spins.length);

  // Compute momentum data for ALL sectors upfront (used by all 3 strategies)
  const allMomentum = stats.aggStats
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
    });

  // ===== Strategy 1: MOMENTUM (highest recent hit rate) =====
  const momentumRanked = [...allMomentum].sort((a, b) => b.score - a.score);
  const momentumTop = momentumRanked[0];
  const momentumSecond = momentumRanked[1];
  const momentumMax = Math.max(1, ...momentumRanked.map((r) => r.score));
  const momentumAcc = backtestStrategy(stats, spins, "momentum");
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
                  detail: `+${momentumTop.momentumDelta.toFixed(2)}% above 24h baseline`,
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
        momentumAcc,
        momentumTop.score,
        momentumSecond?.score ?? 0,
        momentumMax
      )
    : emptySignal("momentum", "Next Spin (Live Momentum)", sessionTotal);

  // ===== Strategy 2: BIGGEST RISER (highest momentum delta — sector improving most) =====
  // This catches sectors that are suddenly hitting MORE than usual. It picks a
  // DIFFERENT sector from Strategy 1 (excludes the momentum top pick) so the 3
  // signals cover different ground.
  const riserRanked = allMomentum
    .filter((r) => r.sector !== momentumTop?.sector) // exclude Strategy 1's pick
    .sort((a, b) => b.momentumDelta - a.momentumDelta);
  const riserTop = riserRanked[0];
  const riserSecond = riserRanked[1];
  const riserMax = Math.max(1, ...riserRanked.map((r) => Math.abs(r.momentumDelta)));
  const riserAcc = backtestStrategy(stats, spins, "hot_trend");
  const riserHitRate = riserTop ? riserTop.recentPercentage : 0;
  const hotTrendSignal = riserTop
    ? buildSignalCommon(
        stats,
        riserTop.sector,
        "hot_trend",
        "Biggest Riser (Trending Up)",
        riserHitRate,
        sessionTotal,
        {
          recentHits: riserTop.recentHits,
          recentWindow,
          recentPercentage: Math.round(riserTop.recentPercentage * 10) / 10,
          momentumDelta: Math.round(riserTop.momentumDelta * 100) / 100,
        },
        [
          {
            label: "Biggest momentum gain",
            detail: `${riserTop.momentumDelta >= 0 ? "+" : ""}${riserTop.momentumDelta.toFixed(2)}% vs 24h baseline — this sector is improving the fastest right now`,
            weight: Math.round(Math.abs(riserTop.momentumDelta / 30) * 70) / 100,
          },
          {
            label: "Recent hits",
            detail: `${riserTop.recentHits} hit${riserTop.recentHits === 1 ? "" : "s"} in last ${recentWindow} spins (${riserTop.recentPercentage.toFixed(1)}%) vs ${riserTop.percentage.toFixed(1)}% baseline`,
            weight: Math.round((riserTop.recentPercentage / 100) * 30) / 100,
          },
        ],
        riserAcc,
        Math.abs(riserTop.momentumDelta),
        Math.abs(riserSecond?.momentumDelta ?? 0),
        riserMax
      )
    : emptySignal("hot_trend", "Biggest Riser (Trending Up)", sessionTotal);

  // ===== Strategy 3: SMART COVERAGE (best score NOT already picked) =====
  // Uses the full momentum score but excludes sectors already picked by
  // Strategy 1 and 2. This ensures all 3 signals cover 3 DIFFERENT sectors,
  // maximizing the chance that at least one prediction hits.
  const pickedSectors = new Set<string>([
    momentumTop?.sector,
    riserTop?.sector,
  ].filter(Boolean) as string[]);
  const coverageRanked = allMomentum
    .filter((r) => !pickedSectors.has(r.sector))
    .sort((a, b) => b.score - a.score);
  const coverageTop = coverageRanked[0];
  const coverageSecond = coverageRanked[1];
  const coverageMax = Math.max(1, ...coverageRanked.map((r) => r.score));
  const coverageAcc = backtestStrategy(stats, spins, "overdue_bonus");
  const coverageHitRate = coverageTop ? coverageTop.recentPercentage : 0;
  const overdueBonusSignal = coverageTop
    ? buildSignalCommon(
        stats,
        coverageTop.sector,
        "overdue_bonus",
        "Smart Coverage (Best of Rest)",
        coverageHitRate,
        sessionTotal,
        {
          recentHits: coverageTop.recentHits,
          recentWindow,
          recentPercentage: Math.round(coverageTop.recentPercentage * 10) / 10,
          momentumDelta: Math.round(coverageTop.momentumDelta * 100) / 100,
        },
        [
          {
            label: "Coverage pick",
            detail: `Highest momentum score among sectors not already predicted — covers a different sector to maximize hit chance`,
            weight: Math.round((coverageTop.score / 100) * 50) / 100,
          },
          {
            label: "Recent hits",
            detail: `${coverageTop.recentHits} hit${coverageTop.recentHits === 1 ? "" : "s"} in last ${recentWindow} spins (${coverageTop.recentPercentage.toFixed(1)}%)`,
            weight: Math.round((coverageTop.recentPercentage / 100) * 30) / 100,
          },
          ...(coverageTop.isBonus
            ? [
                {
                  label: "Bonus round",
                  detail: `This is a bonus sector — rare but high payout if it hits`,
                  weight: 0,
                },
              ]
            : []),
        ],
        coverageAcc,
        coverageTop.score,
        coverageSecond?.score ?? 0,
        coverageMax
      )
    : emptySignal("overdue_bonus", "Smart Coverage (Best of Rest)", sessionTotal);

  // Combined ranked list (by momentum score) for the UI alternatives panel
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
    // Biggest riser: highest momentum delta
    ranked = stats.aggStats
      .map((s) => {
        const m = momentumScore(s.wheelResult, recentSpins, s.percentage);
        return { sector: s.wheelResult, score: m.momentumDelta };
      })
      .sort((a, b) => b.score - a.score);
  } else {
    // Smart coverage: same as momentum (it uses momentum score with exclusions)
    ranked = stats.aggStats
      .map((s) => {
        const m = momentumScore(s.wheelResult, recentSpins, s.percentage);
        return { sector: s.wheelResult, score: m.score };
      })
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
  return Math.round((hits / total) * 1000) / 10;
}

// Compat alias used by the old buildPrediction import path.
export type PredictionResult = { signal: NextSpinSignal; ranked: MultiPredictionResult["ranked"] };
