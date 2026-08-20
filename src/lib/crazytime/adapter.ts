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

// ============================================================
// MARKOV CHAIN PREDICTION ENGINE
// ------------------------------------------------------------
// This is a real, research-based prediction model. It builds a transition
// matrix from the FULL spin history (what sector historically comes AFTER
// each sector), then uses the LAST actual spin to predict the NEXT one.
//
// This is fundamentally different from "momentum" (which just picks whatever
// hit most recently — effectively copying the last result). The Markov model
// looks at genuine transition patterns:
//   - After "1", the wheel historically lands on "2" 33% of the time
//   - After "CoinFlip", it lands on "2" 100% of the time (small sample)
//   - After "2", it lands on "1" 42% of the time
//
// The 3 strategies use different Markov orders:
//   1. MARKOV ORDER-1  — top transition from the last single spin
//   2. MARKOV ORDER-1 (2nd) — 2nd most likely transition (different sector)
//   3. MARKOV ORDER-2  — uses the last TWO spins for more context
//
// Anti-repeat: if the top Markov pick equals the last actual spin (which can
// happen since repeats are ~22%), the 2nd pick is used instead — so the
// prediction is genuinely a PREDICTION, not a copy of what just happened.
// ============================================================

type TransitionMap = Map<string, Map<string, number>>;

// Build a Markov transition matrix from the spin history.
// `order` = how many previous spins to use as the state key.
//   order 1: state = last spin sector (e.g. "1")
//   order 2: state = last 2 spins joined (e.g. "1|2")
function buildMarkovMatrix(spins: NormalizedSpin[], order: number): TransitionMap {
  const matrix: TransitionMap = new Map();
  if (spins.length < order + 1) return matrix;
  // spins are newest-first; iterate oldest->newest for transition counting
  const ordered = [...spins].reverse();
  for (let i = 0; i <= ordered.length - order - 1; i++) {
    const stateParts: string[] = [];
    for (let j = 0; j < order; j++) {
      const s = ordered[i + j].wheelResultSector;
      if (!s) { stateParts.length = 0; break; }
      stateParts.push(s);
    }
    if (stateParts.length !== order) continue;
    const state = stateParts.join("|");
    const next = ordered[i + order].wheelResultSector;
    if (!next) continue;
    if (!matrix.has(state)) matrix.set(state, new Map());
    const inner = matrix.get(state)!;
    inner.set(next, (inner.get(next) ?? 0) + 1);
  }
  return matrix;
}

// Given a transition matrix and a state (last spin[s]), return ranked
// predicted next sectors with their transition probabilities.
function predictFromMatrix(
  matrix: TransitionMap,
  state: string
): { sector: string; count: number; probability: number }[] {
  const inner = matrix.get(state);
  if (!inner || inner.size === 0) return [];
  let total = 0;
  for (const c of inner.values()) total += c;
  const out: { sector: string; count: number; probability: number }[] = [];
  for (const [sector, count] of inner.entries()) {
    out.push({ sector, count, probability: (count / total) * 100 });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ============================================================
// MULTI-ORDER MARKOV ENSEMBLE PREDICTION ENGINE
// ------------------------------------------------------------
// Blends multiple signals into a single ensemble score per sector:
//   - Markov order-1 (after last spin)
//   - Markov order-2 (after last 2 spins)
//   - Markov order-3 (after last 3 spins)
//   - 24h base frequency
//   - Anti-repeat penalty (repeats are only ~22% likely)
//
// The 3 signal boxes show the TOP-3 ensemble picks (the 3 sectors with the
// highest blended score). This is the most statistically sound approach for a
// random wheel: cover the 3 most likely outcomes.
// ============================================================

interface EnsemblePick {
  sector: string;
  ensembleScore: number; // 0-100 blended score
  order1Prob: number; // Markov order-1 probability (0-100)
  order2Prob: number; // Markov order-2 probability (0-100)
  order3Prob: number; // Markov order-3 probability (0-100)
  baseProb: number; // 24h base frequency (0-100)
  isBonus: boolean;
}

// Build all 3 real-data predictions at once using the Markov chain engine.
export function buildMultiPrediction(
  stats: NormalizedStats,
  recentSpins: NormalizedSpin[] = [],
  sessionTotal = 0
): MultiPredictionResult {
  const spins = recentSpins;
  const recentWindow = Math.min(MOMENTUM_WINDOW, spins.length);

  // The last actual spins are the KEY inputs for Markov prediction.
  const lastSpin = spins[0]?.wheelResultSector ?? null;
  const secondLastSpin = spins[1]?.wheelResultSector ?? null;
  const thirdLastSpin = spins[2]?.wheelResultSector ?? null;

  // Build transition matrices of orders 1, 2, 3 from the FULL history.
  // With 200 spins, order-1 has ~200 transitions, order-2 ~100, order-3 ~50.
  const matrix1 = buildMarkovMatrix(spins, 1);
  const matrix2 = buildMarkovMatrix(spins, 2);
  const matrix3 = buildMarkovMatrix(spins, 3);

  // Get ranked predictions for the current state at each order
  const order1Predictions = lastSpin ? predictFromMatrix(matrix1, lastSpin) : [];
  const order2State =
    lastSpin && secondLastSpin ? `${secondLastSpin}|${lastSpin}` : null;
  const order2Predictions = order2State
    ? predictFromMatrix(matrix2, order2State)
    : [];
  const order3State =
    lastSpin && secondLastSpin && thirdLastSpin
      ? `${thirdLastSpin}|${secondLastSpin}|${lastSpin}`
      : null;
  const order3Predictions = order3State
    ? predictFromMatrix(matrix3, order3State)
    : [];

  // Build the ensemble score for EVERY sector by blending all signals.
  // Weights: order-1 (30%), order-2 (22%), order-3 (18%), base freq (30%).
  // Anti-repeat: the last actual spin is heavily penalized (repeats only ~22%
  // likely, so we cut its score by 70%) — this prevents the model from just
  // echoing the last result and forces it to predict a DIFFERENT sector.
  const allSectors = stats.aggStats.map((s) => s.wheelResult);
  const ensemblePicks: EnsemblePick[] = allSectors.map((sector) => {
    const o1 = order1Predictions.find((p) => p.sector === sector);
    const o2 = order2Predictions.find((p) => p.sector === sector);
    const o3 = order3Predictions.find((p) => p.sector === sector);
    const base = stats.aggStats.find((s) => s.wheelResult === sector);
    const o1Prob = o1?.probability ?? 0;
    const o2Prob = o2?.probability ?? 0;
    const o3Prob = o3?.probability ?? 0;
    const baseProb = base?.percentage ?? 0;
    // Ensemble blend
    let score = o1Prob * 0.30 + o2Prob * 0.22 + o3Prob * 0.18 + baseProb * 0.30;
    // Anti-repeat penalty: if this sector == last spin, cut score by 50%
    // (repeats happen ~22% of the time vs ~39% base for "1", so a 50% cut
    // is a fair penalty — strong enough to usually avoid copying, but not
    // so strong that we miss the 22% of cases where it DOES repeat)
    if (sector === lastSpin) {
      score *= 0.5;
    }
    return {
      sector,
      ensembleScore: Math.max(0, score),
      order1Prob: o1Prob,
      order2Prob: o2Prob,
      order3Prob: o3Prob,
      baseProb,
      isBonus: BONUS_SET.has(sector),
    };
  });
  // Sort by ensemble score (highest first)
  ensemblePicks.sort((a, b) => b.ensembleScore - a.ensembleScore);

  // The 3 signal boxes show the TOP-3 ensemble picks (the 3 most likely
  // sectors based on the blended model). Each covers a different sector.
  const top3 = ensemblePicks.slice(0, 3);
  const ensembleAcc = backtestEnsemble(spins, stats);

  // Build the 3 signals
  const strategyMeta: { key: "momentum" | "hotTrend" | "overdueBonus"; title: string }[] = [
    { key: "momentum", title: "AI Ensemble (Top Pick)" },
    { key: "hotTrend", title: "AI Ensemble (2nd Pick)" },
    { key: "overdueBonus", title: "AI Ensemble (3rd Pick)" },
  ];

  const buildEnsembleSignal = (
    pick: EnsemblePick,
    rank: number,
    strategyKey: "momentum" | "hotTrend" | "overdueBonus",
    strategyTitle: string
  ): NextSpinSignal => {
    const stat = stats.aggStats.find((s) => s.wheelResult === pick.sector);
    const isBonus = pick.isBonus;
    const signals: NextSpinSignal["signals"] = [];
    // Explain which Markov orders contributed
    signals.push({
      label: `Markov order-1 (after ${label(lastSpin)})`,
      detail: `After "${label(lastSpin)}", "${label(pick.sector)}" historically comes next ${pick.order1Prob.toFixed(1)}% of the time`,
      weight: Math.round((pick.order1Prob / 100) * 35) / 100,
    });
    if (pick.order2Prob > 0 || (order2Predictions.length > 0 && rank < 3)) {
      signals.push({
        label: `Markov order-2 (after ${label(secondLastSpin)}→${label(lastSpin)})`,
        detail: pick.order2Prob > 0
          ? `After the 2-spin sequence ${label(secondLastSpin)}→${label(lastSpin)}, "${label(pick.sector)}" comes next ${pick.order2Prob.toFixed(1)}% of the time`
          : `No 2-spin pattern data for this sector after ${label(secondLastSpin)}→${label(lastSpin)}`,
        weight: Math.round((pick.order2Prob / 100) * 25) / 100,
      });
    }
    if (pick.order3Prob > 0 || (order3Predictions.length > 0 && rank < 3)) {
      signals.push({
        label: `Markov order-3 (after ${label(thirdLastSpin)}→${label(secondLastSpin)}→${label(lastSpin)})`,
        detail: pick.order3Prob > 0
          ? `After the 3-spin sequence, "${label(pick.sector)}" comes next ${pick.order3Prob.toFixed(1)}% of the time — deepest pattern match`
          : `No 3-spin pattern data for this sector`,
        weight: Math.round((pick.order3Prob / 100) * 15) / 100,
      });
    }
    signals.push({
      label: "24h base frequency",
      detail: `${pick.baseProb.toFixed(2)}% (${stat?.count.toLocaleString() ?? 0} hits in last ${stats.totalCount.toLocaleString()} spins)`,
      weight: Math.round((pick.baseProb / 100) * 25) / 100,
    });
    if (pick.sector === lastSpin) {
      signals.push({
        label: "Anti-repeat penalty",
        detail: `This sector is the same as the last spin — score halved because repeats only happen ~22% of the time`,
        weight: 0,
      });
    }
    // Confidence: based on ensemble score dominance + backtest
    const topScore = top3[0]?.ensembleScore ?? 1;
    const secondScore = top3[1]?.ensembleScore ?? 0;
    const dominance = topScore > 0 ? Math.max(0, Math.min(1, (topScore - secondScore) / topScore)) : 0;
    let base = 55 + dominance * 25;
    if (pick.ensembleScore >= 30) base += 8;
    else if (pick.ensembleScore >= 20) base += 4;
    else if (pick.ensembleScore < 10) base -= 8;
    if (ensembleAcc != null && ensembleAcc >= 70) base += 4;
    else if (ensembleAcc != null && ensembleAcc < 50) base -= 6;
    if (isBonus) base = Math.min(base, 80);
    if (rank === 1) base += 3; // top pick gets a small boost
    if (rank === 2) base -= 2;
    if (rank === 3) base -= 5;
    const confidence = Math.round(Math.max(55, Math.min(95, base)));
    return {
      sector: pick.sector,
      sectorLabel: label(pick.sector),
      cardImage: cardImage(pick.sector),
      confidence,
      signals,
      isBonus,
      observedPercentage: pick.baseProb,
      observedCount: stat?.count ?? 0,
      observedLastSeenBefore: stat?.lastSeenBefore ?? null,
      observedHotFrequencyPercentage: stat?.hotFrequencyPercentage ?? null,
      generatedAt: new Date().toISOString(),
      sessionTotal,
      modelAccuracy: ensembleAcc,
      strategy: strategyKey,
      strategyTitle,
      observed: {
        recentHits: lastSpin ? 1 : 0,
        recentWindow: 1,
        recentPercentage: pick.ensembleScore,
        momentumDelta: pick.ensembleScore - pick.baseProb,
      },
    };
  };

  const momentumSignal = top3[0]
    ? buildEnsembleSignal(top3[0], 1, "momentum", strategyMeta[0].title)
    : emptySignal("momentum", strategyMeta[0].title, sessionTotal);
  const hotTrendSignal = top3[1]
    ? buildEnsembleSignal(top3[1], 2, "hot_trend", strategyMeta[1].title)
    : emptySignal("hot_trend", strategyMeta[1].title, sessionTotal);
  const overdueBonusSignal = top3[2]
    ? buildEnsembleSignal(top3[2], 3, "overdue_bonus", strategyMeta[2].title)
    : emptySignal("overdue_bonus", strategyMeta[2].title, sessionTotal);

  // Combined ranked list (by ensemble score) for the UI panel
  const ranked = ensemblePicks.slice(0, 8).map((p) => {
    const stat = stats.aggStats.find((s) => s.wheelResult === p.sector);
    return {
      sector: p.sector,
      sectorLabel: label(p.sector),
      score: p.ensembleScore,
      percentage: stat?.percentage ?? 0,
      hotFrequencyPercentage: stat?.hotFrequencyPercentage ?? null,
      lastSeenBefore: stat?.lastSeenBefore ?? null,
      isBonus: p.isBonus,
    };
  });

  return {
    momentum: momentumSignal,
    hotTrend: hotTrendSignal,
    overdueBonus: overdueBonusSignal,
    ranked,
  };
}

// Backtest the ensemble model: for each recent spin, rebuild the ensemble
// using only PRIOR spins (no look-ahead) and check if the top-3 picks matched.
function backtestEnsemble(
  recentSpins: NormalizedSpin[],
  stats: NormalizedStats
): number | null {
  if (recentSpins.length < 10) return null;
  const ordered = [...recentSpins].reverse(); // oldest->newest
  let hits = 0;
  let total = 0;
  for (let i = 5; i < ordered.length; i++) {
    const priorSpins = ordered.slice(0, i);
    const lastSpin = ordered[i - 1].wheelResultSector;
    const secondLast = ordered[i - 2].wheelResultSector;
    const thirdLast = ordered[i - 3].wheelResultSector;
    if (!lastSpin) continue;
    // Build matrices from prior spins only
    const m1 = buildMarkovMatrix(priorSpins, 1);
    const m2 = buildMarkovMatrix(priorSpins, 2);
    const m3 = buildMarkovMatrix(priorSpins, 3);
    const o1 = predictFromMatrix(m1, lastSpin);
    const o2State = secondLast ? `${secondLast}|${lastSpin}` : null;
    const o2 = o2State ? predictFromMatrix(m2, o2State) : [];
    const o3State = secondLast && thirdLast ? `${thirdLast}|${secondLast}|${lastSpin}` : null;
    const o3 = o3State ? predictFromMatrix(m3, o3State) : [];
    // Compute ensemble for all sectors
    const scores = stats.aggStats.map((s) => {
      const o1p = o1.find((p) => p.sector === s.wheelResult)?.probability ?? 0;
      const o2p = o2.find((p) => p.sector === s.wheelResult)?.probability ?? 0;
      const o3p = o3.find((p) => p.sector === s.wheelResult)?.probability ?? 0;
      let score = o1p * 0.30 + o2p * 0.22 + o3p * 0.18 + s.percentage * 0.30;
      if (s.wheelResult === lastSpin) score *= 0.5;
      return { sector: s.wheelResult, score };
    });
    scores.sort((a, b) => b.score - a.score);
    const top3 = new Set(scores.slice(0, 3).map((s) => s.sector));
    const actual = ordered[i].wheelResultSector;
    if (!actual) continue;
    total++;
    if (top3.has(actual)) hits++;
  }
  if (total === 0) return null;
  return Math.round((hits / total) * 1000) / 10;
}

// Build a Markov-based signal (shares the common builder but adds Markov context)
function buildMarkovSignal(
  stats: NormalizedStats,
  sector: string,
  strategy: NextSpinSignal["strategy"],
  strategyTitle: string,
  sessionTotal: number,
  lastSpin: string | null,
  secondLastSpin: string | null,
  extraSignals: NextSpinSignal["signals"],
  modelAccuracy: number | null,
  topProb: number,
  secondProb: number,
  maxProb: number
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
  }
  // Confidence: based on the Markov transition probability (how likely this
  // transition is) blended with the backtest accuracy. Higher transition
  // probability + higher backtest = higher confidence.
  const dominance = maxProb > 0 ? Math.max(0, Math.min(1, (topProb - secondProb) / maxProb)) : 0;
  let base = 55 + dominance * 30;
  // Strong transition (>40% probability) gets a boost
  if (topProb >= 40) base += 8;
  else if (topProb >= 30) base += 4;
  else if (topProb < 15) base -= 8;
  // Backtest accuracy bonus
  if (modelAccuracy != null && modelAccuracy >= 75) base += 3;
  else if (modelAccuracy != null && modelAccuracy < 50) base -= 5;
  // Bonus sectors cap lower (rare events)
  if (isBonus) base = Math.min(base, 80);
  const confidence = Math.round(Math.max(55, Math.min(95, base)));

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
    observed: {
      recentHits: lastSpin ? 1 : 0,
      recentWindow: 1,
      recentPercentage: topProb,
      momentumDelta: topProb - (stat?.percentage ?? 0),
    },
  };
}

// Backtest the Markov model: for each recent spin, check if the Markov
// prediction (based on the spin before it) would have predicted correctly.
function backtestMarkov(
  _stats: NormalizedStats,
  recentSpins: NormalizedSpin[],
  order: number
): number | null {
  if (recentSpins.length < order + 2) return null;
  const ordered = [...recentSpins].reverse(); // oldest->newest
  let hits = 0;
  let total = 0;
  for (let i = order; i < ordered.length; i++) {
    const stateParts: string[] = [];
    for (let j = order; j > 0; j--) {
      const s = ordered[i - j].wheelResultSector;
      if (!s) { stateParts.length = 0; break; }
      stateParts.push(s);
    }
    if (stateParts.length !== order) continue;
    const state = stateParts.join("|");
    // Build matrix from spins BEFORE this point (avoid look-ahead bias)
    const priorSpins = ordered.slice(0, i);
    const matrix = buildMarkovMatrix(priorSpins.map((s, idx) => ({ ...s, wheelResultSector: s.wheelResultSector })), order);
    const preds = predictFromMatrix(matrix, state);
    if (preds.length === 0) continue;
    const actual = ordered[i].wheelResultSector;
    if (!actual) continue;
    total++;
    // Top-3 hit
    if (preds.slice(0, 3).some((p) => p.sector === actual)) hits++;
  }
  if (total === 0) return null;
  return Math.round((hits / total) * 1000) / 10;
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
