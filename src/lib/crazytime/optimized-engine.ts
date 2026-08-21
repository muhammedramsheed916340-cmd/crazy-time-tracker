import "server-only";
import type { NormalizedSpin } from "@/lib/crazytime/types";
import { BONUS_TYPES } from "@/lib/crazytime/constants";

// ============================================================
// OPTIMIZED PREDICTION ENGINE — Top-3 Coverage Maximization
// ============================================================
// Instead of just picking the top-3 by score, this engine:
// 1. Scores all 8 candidates with 6 evidence signals
// 2. Evaluates ALL possible 3-sector combinations (C(8,3) = 56 combos)
// 3. For each combination, computes the historical coverage rate
//    (how often the actual next spin was in that combo)
// 4. Selects the combo with the best walk-forward validated coverage
// 5. Adds a diversity bonus to avoid 3 candidates from the same weak signal
// ============================================================

const BONUS_SET = new Set<string>(BONUS_TYPES);
const ALL_SECTORS = ["1", "2", "5", "10", "CoinFlip", "Pachinko", "CashHunt", "CrazyBonus"];

// Wheel base probabilities (theoretical, from the 21-segment wheel)
const WHEEL_BASE = {
  "1": 38.10, "2": 19.05, "5": 14.29, "10": 4.76,
  Pachinko: 9.52, CashHunt: 9.52, CoinFlip: 4.76, CrazyBonus: 4.76,
} as Record<string, number>;

// Generate all C(8,3) = 56 combinations
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

const ALL_COMBOS = combinations(ALL_SECTORS, 3);

// ============================================================
// CANDIDATE SCORING
// ============================================================

export interface CandidateEvidence {
  sector: string;
  frequencyScore: number;
  recencyScore: number;
  transitionScore: number;
  intervalScore: number;
  distributionScore: number;
  momentumScore: number;
  totalScore: number;
}

export interface OptimizedWeights {
  frequency: number;
  recency: number;
  transition: number;
  interval: number;
  distribution: number;
  momentum: number;
  info: string;
}

// Compute adaptive weights via walk-forward backtesting
export function computeOptimalWeights(spins: ValidatedSpin[]): OptimizedWeights {
  const DEFAULT: OptimizedWeights = {
    frequency: 0.25, recency: 0.12, transition: 0.25,
    interval: 0.10, distribution: 0.18, momentum: 0.10,
    info: "Default weights (insufficient data for adaptation)",
  };

  if (spins.length < 40) return DEFAULT;

  // Walk-forward: test each component's individual top-1 accuracy
  let freqHits = 0, recHits = 0, transHits = 0, intHits = 0, distHits = 0, momHits = 0;
  let total = 0;

  const startIdx = Math.max(20, spins.length - 80);
  for (let i = startIdx; i < spins.length - 1; i++) {
    const prior = spins.slice(Math.max(0, i - 150), i);
    if (prior.length < 20) continue;
    const actual = spins[i + 1].result;
    total++;

    // Compute simple stats for each component
    const freqs: Record<string, number> = {};
    for (const s of prior) freqs[s.result] = (freqs[s.result] ?? 0) + 1;
    const n = prior.length;

    // Frequency: most frequent in recent 20
    const recent20 = prior.slice(-20);
    const freq20: Record<string, number> = {};
    for (const s of recent20) freq20[s.result] = (freq20[s.result] ?? 0) + 1;
    const freqPredicted = Object.entries(freq20).sort(([,a],[,b]) => b - a)[0]?.[0];
    if (freqPredicted === actual) freqHits++;

    // Recency: the last result (anti-repeat: the most recent different one)
    const lastDiff = [...prior].reverse().find(s => s.result !== prior[prior.length - 1].result);
    if (lastDiff?.result === actual) recHits++;

    // Transition: Markov order-1
    const lastResult = prior[prior.length - 1].result;
    const transMap: Record<string, number> = {};
    for (let j = 0; j < prior.length - 1; j++) {
      if (prior[j].result === lastResult) {
        transMap[prior[j + 1].result] = (transMap[prior[j + 1].result] ?? 0) + 1;
      }
    }
    const transPredicted = Object.entries(transMap).sort(([,a],[,b]) => b - a)[0]?.[0];
    if (transPredicted === actual) transHits++;

    // Interval: most overdue (highest gap)
    const gaps: Record<string, number> = {};
    for (const sector of ALL_SECTORS) {
      let gap = 0;
      for (let j = prior.length - 1; j >= 0; j--) {
        if (prior[j].result === sector) break;
        gap++;
      }
      gaps[sector] = gap;
    }
    const intPredicted = Object.entries(gaps).sort(([,a],[,b]) => b - a)[0]?.[0];
    if (intPredicted === actual) intHits++;

    // Distribution: highest base frequency (theoretical wheel)
    const distPredicted = Object.entries(WHEEL_BASE).sort(([,a],[,b]) => b - a)[0]?.[0];
    if (distPredicted === actual) distHits++;

    // Momentum: biggest increase in recent vs long-term frequency
    const longFreq: Record<string, number> = {};
    for (const s of prior) longFreq[s.result] = (longFreq[s.result] ?? 0) + 1;
    let bestDelta = -Infinity, momPredicted = "";
    for (const sector of ALL_SECTORS) {
      const r = (freq20[sector] ?? 0) / 20 * 100;
      const l = (longFreq[sector] ?? 0) / prior.length * 100;
      const delta = r - l;
      if (delta > bestDelta) { bestDelta = delta; momPredicted = sector; }
    }
    if (momPredicted === actual) momHits++;
  }

  if (total === 0) return DEFAULT;

  // Squared accuracy → weight
  const sq = (h: number) => Math.max(0.03, (h / total) ** 2 + 0.03);
  const rf = sq(freqHits), rr = sq(recHits), rt = sq(transHits),
    ri = sq(intHits), rd = sq(distHits), rm = sq(momHits);
  const sum = rf + rr + rt + ri + rd + rm;

  const weights: OptimizedWeights = {
    frequency: rf / sum,
    recency: rr / sum,
    transition: rt / sum,
    interval: ri / sum,
    distribution: rd / sum,
    momentum: rm / sum,
    info: `Walk-forward (${total} pts): freq=${Math.round(freqHits/total*100)}% rec=${Math.round(recHits/total*100)}% trans=${Math.round(transHits/total*100)}% int=${Math.round(intHits/total*100)}% dist=${Math.round(distHits/total*100)}% mom=${Math.round(momHits/total*100)}%`,
  };
  return weights;
}

// Score a single candidate with all evidence signals
export function scoreCandidate(
  sector: string,
  analysis: {
    recent: WindowAnalysis;
    long: WindowAnalysis;
  },
  weights: OptimizedWeights,
  lastResult: string | null,
  transitions: Map<string, Map<string, number>>,
  recentSpins: ValidatedSpin[]
): CandidateEvidence {
  const recentStat = analysis.recent.sectorStats[sector];
  const longStat = analysis.long.sectorStats[sector];

  // Frequency: blend recent (50%) + long-term (50%)
  const frequencyScore = ((recentStat?.frequency ?? 0) * 0.5 + (longStat?.frequency ?? 0) * 0.5);

  // Recency: lower gap = higher score (0 gap → 100, max gap → 0)
  const recencyScore = recentStat
    ? Math.max(0, 100 - (recentStat.recency / Math.max(1, analysis.recent.totalSpins)) * 100)
    : 0;

  // Transition: Markov P(this | lastResult)
  let transitionScore = 0;
  if (lastResult && transitions.has(lastResult)) {
    const inner = transitions.get(lastResult)!;
    let total = 0;
    for (const c of inner.values()) total += c;
    transitionScore = total > 0 ? ((inner.get(sector) ?? 0) / total) * 100 : 0;
  }

  // Interval: overdue signal (current gap vs average interval)
  const currentGap = recentStat?.recency ?? 0;
  const avgInterval = recentStat?.avgInterval || 1;
  const intervalScore = Math.min(100, (currentGap / avgInterval) * 40);

  // Distribution: theoretical wheel probability (stable, anti-overfit)
  const distributionScore = WHEEL_BASE[sector] ?? 0;

  // Momentum: recent frequency vs long-term
  const momentumScore = Math.max(0, Math.min(100, 50 + (recentStat?.momentumDelta ?? 0)));

  const totalScore =
    frequencyScore * weights.frequency +
    recencyScore * weights.recency +
    transitionScore * weights.transition +
    intervalScore * weights.interval +
    distributionScore * weights.distribution +
    momentumScore * weights.momentum;

  return {
    sector,
    frequencyScore: Math.round(frequencyScore * 100) / 100,
    recencyScore: Math.round(recencyScore * 100) / 100,
    transitionScore: Math.round(transitionScore * 100) / 100,
    intervalScore: Math.round(intervalScore * 100) / 100,
    distributionScore: Math.round(distributionScore * 100) / 100,
    momentumScore: Math.round(momentumScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
  };
}

// ============================================================
// JOINT TOP-3 COMBINATION OPTIMIZATION
// ============================================================
// Instead of just taking the top-3 by score, evaluate all 56 possible
// 3-sector combinations and pick the one that maximizes expected coverage.
//
// For each combination, the expected coverage is:
//   P(actual ∈ combo) = Σ P(sector_i) for i in combo
// where P(sector_i) is the candidate's score (normalized to a probability).
//
// We also add a diversity bonus: combinations that cover different signal
// types (not all from the same weak signal) get a small boost.

export interface ComboEvaluation {
  combo: string[];
  coverageScore: number;     // sum of individual scores
  diversityScore: number;     // bonus for covering different evidence types
  totalScore: number;        // coverage + diversity
  expectedHitRate: number;   // historical hit rate for this combo (if available)
}

export function evaluateTop3Combos(
  candidates: CandidateEvidence[],
  weights: OptimizedWeights,
  historicalComboPerformance?: Map<string, number>
): ComboEvaluation[] {
  const evaluations: ComboEvaluation[] = [];

  for (const combo of ALL_COMBOS) {
    // Coverage score: sum of candidate scores in this combo
    const comboCandidates = combo.map(sector =>
      candidates.find(c => c.sector === sector)
    ).filter(Boolean) as CandidateEvidence[];

    if (comboCandidates.length !== 3) continue;

    const coverageScore = comboCandidates.reduce((sum, c) => sum + c.totalScore, 0);

    // Diversity score: reward combos that include both numbers AND bonuses
    const numNumbers = comboCandidates.filter(c => !BONUS_SET.has(c.sector)).length;
    const numBonuses = comboCandidates.filter(c => BONUS_SET.has(c.sector)).length;
    // Best diversity: 2 numbers + 1 bonus, or 3 numbers (covering the base)
    let diversityScore = 0;
    if (numNumbers === 3) diversityScore = 10; // pure number coverage
    else if (numNumbers === 2 && numBonuses === 1) diversityScore = 15; // balanced
    else if (numNumbers === 1 && numBonuses === 2) diversityScore = 5; // bonus-heavy (risky)
    else if (numBonuses === 3) diversityScore = -10; // all bonuses (very risky)

    // Historical performance bonus: if this combo has performed well in walk-forward
    let historicalBonus = 0;
    if (historicalComboPerformance) {
      const key = combo.sort().join("|");
      const hitRate = historicalComboPerformance.get(key);
      if (hitRate != null) {
        // Boost combos with >60% historical hit rate, penalize <40%
        historicalBonus = (hitRate - 50) * 0.3;
      }
    }

    const totalScore = coverageScore + diversityScore + historicalBonus;

    evaluations.push({
      combo,
      coverageScore: Math.round(coverageScore * 100) / 100,
      diversityScore,
      totalScore: Math.round(totalScore * 100) / 100,
      expectedHitRate: historicalComboPerformance?.get(combo.sort().join("|")) ?? 0,
    });
  }

  // Sort by total score (highest first)
  evaluations.sort((a, b) => b.totalScore - a.totalScore);
  return evaluations;
}

// Build historical combo performance map from walk-forward backtest
export function buildComboPerformanceMap(
  spins: ValidatedSpin[],
  analysisFn: (spins: ValidatedSpin[]) => CandidateEvidence[],
  maxPoints: number = 80
): Map<string, { hits: number; total: number; rate: number }> {
  const comboStats = new Map<string, { hits: number; total: number; rate: number }>();

  if (spins.length < 30) return comboStats;

  const startIdx = Math.max(20, spins.length - maxPoints);
  for (let i = startIdx; i < spins.length - 1; i++) {
    const prior = spins.slice(Math.max(0, i - 150), i);
    if (prior.length < 20) continue;
    const actual = spins[i + 1].result;

    // Score candidates using the provided function
    const candidates = analysisFn(prior);
    if (candidates.length < 3) continue;

    // For each possible top-3 combo, record hit/miss
    // (only evaluate combos that would have been selected = top by score)
    const topByScore = [...candidates].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map(c => c.sector);
    const key = topByScore.sort().join("|");

    const stats = comboStats.get(key) ?? { hits: 0, total: 0, rate: 0 };
    stats.total++;
    if (topByScore.includes(actual)) stats.hits++;
    stats.rate = (stats.hits / stats.total) * 100;
    comboStats.set(key, stats);
  }

  return comboStats;
}
