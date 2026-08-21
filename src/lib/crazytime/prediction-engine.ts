import "server-only";
import type { NormalizedSpin } from "@/lib/crazytime/types";
import { BONUS_TYPES } from "@/lib/crazytime/constants";

// ============================================================
// DATABASE CONNECTION MANAGEMENT
// ============================================================
// Lazy-load Prisma client and test the connection. On Vercel serverless,
// SQLite file paths (file:/home/z/my-project/db/custom.db) don't exist —
// the filesystem is ephemeral. We detect this and report it clearly.
//
// DB availability states:
// - "AVAILABLE": DB is connected and working (local dev or Vercel with proper DB)
// - "UNAVAILABLE": DB connection failed (Vercel without proper DATABASE_URL)
//
// When unavailable, predictions still generate from live data, but
// persistence/verification/accuracy tracking won't work.

let _db: any = null;
let _dbStatus: "UNKNOWN" | "AVAILABLE" | "UNAVAILABLE" = "UNKNOWN";
let _dbError: string | null = null;

async function getDb(): Promise<any | null> {
  if (_dbStatus === "UNAVAILABLE") return null;
  if (_db) return _db;
  try {
    const { db } = await import("@/lib/db");
    // Test the connection with a simple count query
    await db.predictionRecord.count();
    _db = db;
    _dbStatus = "AVAILABLE";
    console.log("[prediction-engine] Database connected successfully");
    return db;
  } catch (err) {
    _dbStatus = "UNAVAILABLE";
    _dbError = err instanceof Error ? err.message : String(err);
    console.error("[prediction-engine] Database UNAVAILABLE:", _dbError);
    return null;
  }
}

// Check if the database is available (without throwing)
export async function checkDbAvailability(): Promise<{
  available: boolean;
  status: "AVAILABLE" | "UNAVAILABLE";
  error: string | null;
}> {
  if (_dbStatus === "AVAILABLE") {
    return { available: true, status: "AVAILABLE", error: null };
  }
  if (_dbStatus === "UNAVAILABLE") {
    return { available: false, status: "UNAVAILABLE", error: _dbError };
  }
  // Unknown — try to connect
  const db = await getDb();
  if (db) {
    return { available: true, status: "AVAILABLE", error: null };
  }
  return { available: false, status: "UNAVAILABLE", error: _dbError };
}

// ============================================================
// PREDICTION ENGINE — Proper data-driven prediction with validation
// ============================================================
// This engine:
// 1. Validates incoming spins (dedupe, check timestamps, ordering)
// 2. Builds a normalized chronological dataset
// 3. Analyzes multiple historical windows (recent, short, medium, long, full)
// 4. Computes statistical features (frequency, recency, intervals, streaks,
//    distribution, transitions, momentum)
// 5. Scores each candidate sector dynamically based on evidence
// 6. Generates confidence from evidence (NOT hardcoded)
// 7. Performs walk-forward validation for adaptive weighting
// 8. Persists predictions to the database
// 9. Verifies predictions idempotently against the next real spin
// 10. Calculates accuracy from actual stored records (never fabricated)
// ============================================================

const BONUS_SET = new Set<string>(BONUS_TYPES);
const ALL_SECTORS = ["1", "2", "5", "10", "CoinFlip", "Pachinko", "CashHunt", "CrazyBonus"];

// Window sizes (configurable — not hardcoded into results)
const WINDOW_SIZES = {
  recent: 8,    // last 8 spins — immediate momentum
  short: 20,    // last 20 spins — short-term pattern
  medium: 50,   // last 50 spins — medium-term trend
  long: 100,    // last 100 spins — long-term baseline
  full: 200,   // all available spins — full history
};

// ============================================================
// 1. SPIN VALIDATION
// ============================================================

export interface ValidatedSpin {
  spinId: string;
  result: string;
  timestamp: string;
  source: string;
  raw: NormalizedSpin;
}

// Validate and normalize the spin dataset.
// Rejects: duplicates, invalid results, missing timestamps, future timestamps,
// corrupted records. Sorts chronologically (oldest first).
export function validateAndNormalizeSpins(spins: NormalizedSpin[]): ValidatedSpin[] {
  const seen = new Set<string>();
  const valid: ValidatedSpin[] = [];
  const now = Date.now();

  for (const spin of spins) {
    // Reject if no ID
    if (!spin.id || typeof spin.id !== "string") continue;
    // Reject duplicates
    if (seen.has(spin.id)) continue;
    seen.add(spin.id);
    // Reject if no result
    if (!spin.wheelResultSector || typeof spin.wheelResultSector !== "string") continue;
    // Reject if result is not a valid sector
    if (!ALL_SECTORS.includes(spin.wheelResultSector)) continue;
    // Reject if no timestamp
    if (!spin.settledAt) continue;
    // Reject future timestamps (more than 5 minutes in the future)
    const ts = new Date(spin.settledAt).getTime();
    if (isNaN(ts)) continue;
    if (ts > now + 5 * 60 * 1000) continue;

    valid.push({
      spinId: spin.id,
      result: spin.wheelResultSector,
      timestamp: spin.settledAt,
      source: "casinoscores-api",
      raw: spin,
    });
  }

  // Sort chronologically (oldest first) for proper transition analysis
  valid.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return valid;
}

// ============================================================
// 2. MULTI-WINDOW STATISTICAL FEATURES
// ============================================================

export interface SectorStats {
  sector: string;
  frequency: number;          // % in this window
  count: number;              // raw count in this window
  recency: number;            // spins since last occurrence (0 = just happened)
  intervals: number[];        // gaps between consecutive occurrences
  avgInterval: number;        // average gap between occurrences
  currentStreak: number;      // current consecutive streak (0 if not current)
  transitionProb: number;    // P(this sector | last sector) from Markov order-1
  momentumDelta: number;      // recent% - longTerm% (positive = heating up)
}

export interface WindowAnalysis {
  windowName: string;
  windowSize: number;
  totalSpins: number;
  sectorStats: Record<string, SectorStats>;
  distribution: Record<string, number>;  // sector -> % in window
  transitions: Map<string, Map<string, number>>;  // Markov order-1
  validDataAvailable: boolean;
}

// Analyze a single window of spins
function analyzeWindow(spins: ValidatedSpin[], windowName: string, windowSize: number): WindowAnalysis {
  const window = spins.slice(-windowSize);  // take the last N spins
  const totalSpins = window.length;

  if (totalSpins === 0) {
    return {
      windowName,
      windowSize,
      totalSpins: 0,
      sectorStats: {},
      distribution: {},
      transitions: new Map(),
      validDataAvailable: false,
    };
  }

  // Build Markov transition matrix (order-1)
  const transitions = new Map<string, Map<string, number>>();
  for (let i = 0; i < window.length - 1; i++) {
    const cur = window[i].result;
    const next = window[i + 1].result;
    if (!transitions.has(cur)) transitions.set(cur, new Map());
    const inner = transitions.get(cur)!;
    inner.set(next, (inner.get(next) ?? 0) + 1);
  }

  // Compute per-sector stats
  const sectorStats: Record<string, SectorStats> = {};
  const distribution: Record<string, number> = {};

  for (const sector of ALL_SECTORS) {
    const occurrences: number[] = [];
    let count = 0;
    let recency = 0;
    let currentStreak = 0;
    let streakCount = 0;

    for (let i = 0; i < window.length; i++) {
      if (window[i].result === sector) {
        occurrences.push(i);
        count++;
        // Check if this is part of the current streak (at the end)
        if (i >= window.length - 1 - streakCount) {
          streakCount++;
        }
      }
    }

    // Recency: spins since last occurrence (from the end)
    if (occurrences.length > 0) {
      recency = window.length - 1 - occurrences[occurrences.length - 1];
    } else {
      recency = window.length;  // never occurred
    }
    currentStreak = streakCount;

    // Intervals: gaps between consecutive occurrences
    const intervals: number[] = [];
    for (let i = 1; i < occurrences.length; i++) {
      intervals.push(occurrences[i] - occurrences[i - 1]);
    }
    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;

    // Transition probability: P(this sector | last sector in window)
    const lastResult = window[window.length - 1].result;
    const transFromLast = transitions.get(lastResult);
    let transitionProb = 0;
    if (transFromLast) {
      let total = 0;
      for (const c of transFromLast.values()) total += c;
      transitionProb = total > 0 ? ((transFromLast.get(sector) ?? 0) / total) * 100 : 0;
    }

    const frequency = (count / totalSpins) * 100;
    distribution[sector] = frequency;

    sectorStats[sector] = {
      sector,
      frequency,
      count,
      recency,
      intervals,
      avgInterval,
      currentStreak,
      transitionProb,
      momentumDelta: 0,  // computed in multi-window comparison
    };
  }

  return {
    windowName,
    windowSize,
    totalSpins,
    sectorStats,
    distribution,
    transitions,
    validDataAvailable: true,
  };
}

// Analyze all windows
export function analyzeAllWindows(spins: ValidatedSpin[]): {
  windows: WindowAnalysis[];
  recent: WindowAnalysis;
  short: WindowAnalysis;
  medium: WindowAnalysis;
  long: WindowAnalysis;
  full: WindowAnalysis;
  dataReady: boolean;
} {
  const recent = analyzeWindow(spins, "recent", WINDOW_SIZES.recent);
  const short = analyzeWindow(spins, "short", WINDOW_SIZES.short);
  const medium = analyzeWindow(spins, "medium", WINDOW_SIZES.medium);
  const long = analyzeWindow(spins, "long", WINDOW_SIZES.long);
  const full = analyzeWindow(spins, "full", WINDOW_SIZES.full);

  // Compute momentum delta: recent% - longTerm%
  for (const sector of ALL_SECTORS) {
    const recentFreq = recent.sectorStats[sector]?.frequency ?? 0;
    const longFreq = long.sectorStats[sector]?.frequency ?? 0;
    const delta = recentFreq - longFreq;
    if (recent.sectorStats[sector]) recent.sectorStats[sector].momentumDelta = delta;
    if (short.sectorStats[sector]) short.sectorStats[sector].momentumDelta = delta;
    if (medium.sectorStats[sector]) medium.sectorStats[sector].momentumDelta = delta;
  }

  // Data is ready if we have at least 20 spins
  const dataReady = spins.length >= 20;

  return {
    windows: [recent, short, medium, long, full],
    recent,
    short,
    medium,
    long,
    full,
    dataReady,
  };
}

// ============================================================
// 3. SIGNAL SCORING — dynamic evidence-based scoring
// ============================================================

export interface CandidateScore {
  sector: string;
  sectorLabel: string;
  totalScore: number;          // 0-100 combined score
  evidence: {
    frequencyScore: number;    // from multi-window frequency
    recencyScore: number;      // from recency (how recently it appeared)
    transitionScore: number;   // from Markov transition probability
    intervalScore: number;     // from interval analysis (overdue signal)
    distributionScore: number; // from distribution comparison
    momentumScore: number;     // from momentum delta
  };
  weights: {
    frequency: number;
    recency: number;
    transition: number;
    interval: number;
    distribution: number;
    momentum: number;
  };
  isBonus: boolean;
}

// Compute adaptive weights from walk-forward validation
// Each component's weight is proportional to its validated accuracy²
export interface AdaptiveWeights {
  frequency: number;
  recency: number;
  transition: number;
  interval: number;
  distribution: number;
  momentum: number;
  info: string;
}

export function computeAdaptiveWeightsFromWalkForward(
  spins: ValidatedSpin[]
): AdaptiveWeights {
  // Default weights (equal)
  const DEFAULT: AdaptiveWeights = {
    frequency: 0.25,
    recency: 0.15,
    transition: 0.25,
    interval: 0.10,
    distribution: 0.10,
    momentum: 0.15,
    info: "Using default weights (insufficient data for adaptation)",
  };

  if (spins.length < 30) return DEFAULT;

  // Walk-forward: for each spin i (from 20 to end), compute what each
  // component would have predicted using only spins[0..i-1], then check
  // if it matched spins[i].
  let freqHits = 0, recencyHits = 0, transHits = 0, intervalHits = 0, distHits = 0, momHits = 0;
  let total = 0;

  const startIdx = Math.max(20, spins.length - 50);  // last 50 for performance

  for (let i = startIdx; i < spins.length; i++) {
    const priorSpins = spins.slice(Math.max(0, i - 100), i);
    if (priorSpins.length < 20) continue;
    const actual = spins[i].result;
    if (!actual) continue;
    total++;

    // Analyze prior spins
    const analysis = analyzeAllWindows(priorSpins);
    if (!analysis.dataReady) continue;

    // Frequency component: predict the most frequent sector in recent window
    const freqPredicted = Object.entries(analysis.recent.sectorStats)
      .sort(([, a], [, b]) => b.frequency - a.frequency)[0]?.[0];
    if (freqPredicted === actual) freqHits++;

    // Recency component: predict the sector with lowest recency (just appeared)
    const recencyPredicted = Object.entries(analysis.recent.sectorStats)
      .sort(([, a], [, b]) => a.recency - b.recency)[0]?.[0];
    if (recencyPredicted === actual) recencyHits++;

    // Transition component: Markov order-1 top pick
    const lastResult = priorSpins[priorSpins.length - 1].result;
    const transMap = analysis.recent.transitions.get(lastResult);
    if (transMap) {
      const transPredicted = [...transMap.entries()]
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      if (transPredicted === actual) transHits++;
    }

    // Interval component: predict the sector with highest avgInterval (most overdue)
    const intervalPredicted = Object.entries(analysis.short.sectorStats)
      .filter(([, s]) => s.avgInterval > 0)
      .sort(([, a], [, b]) => b.avgInterval - a.avgInterval)[0]?.[0];
    if (intervalPredicted === actual) intervalHits++;

    // Distribution component: predict the sector with highest long-term frequency
    const distPredicted = Object.entries(analysis.long.sectorStats)
      .sort(([, a], [, b]) => b.frequency - a.frequency)[0]?.[0];
    if (distPredicted === actual) distHits++;

    // Momentum component: predict the sector with highest momentum delta
    const momPredicted = Object.entries(analysis.recent.sectorStats)
      .sort(([, a], [, b]) => b.momentumDelta - a.momentumDelta)[0]?.[0];
    if (momPredicted === actual) momHits++;
  }

  if (total === 0) return DEFAULT;

  const freqAcc = freqHits / total;
  const recencyAcc = recencyHits / total;
  const transAcc = transHits / total;
  const intervalAcc = intervalHits / total;
  const distAcc = distHits / total;
  const momAcc = momHits / total;

  // Squared accuracy → weight (amplifies good components, suppresses bad ones)
  // Floor of 0.05 to avoid zeroing out completely
  const rawFreq = Math.max(0.05, freqAcc * freqAcc + 0.05);
  const rawRecency = Math.max(0.05, recencyAcc * recencyAcc + 0.05);
  const rawTrans = Math.max(0.05, transAcc * transAcc + 0.05);
  const rawInterval = Math.max(0.05, intervalAcc * intervalAcc + 0.05);
  const rawDist = Math.max(0.05, distAcc * distAcc + 0.05);
  const rawMom = Math.max(0.05, momAcc * momAcc + 0.05);
  const sum = rawFreq + rawRecency + rawTrans + rawInterval + rawDist + rawMom;

  const weights: AdaptiveWeights = {
    frequency: rawFreq / sum,
    recency: rawRecency / sum,
    transition: rawTrans / sum,
    interval: rawInterval / sum,
    distribution: rawDist / sum,
    momentum: rawMom / sum,
    info: `Walk-forward validation (${total} spins): freq=${Math.round(freqAcc * 100)}%, recency=${Math.round(recencyAcc * 100)}%, transition=${Math.round(transAcc * 100)}%, interval=${Math.round(intervalAcc * 100)}%, dist=${Math.round(distAcc * 100)}%, momentum=${Math.round(momAcc * 100)}%. Weights boosted for best performers.`,
  };

  return weights;
}

// Score all candidate sectors
export function scoreCandidates(
  analysis: {
    recent: WindowAnalysis;
    short: WindowAnalysis;
    medium: WindowAnalysis;
    long: WindowAnalysis;
    full: WindowAnalysis;
  },
  weights: AdaptiveWeights,
  lastSpinResult: string | null
): CandidateScore[] {
  const candidates: CandidateScore[] = [];

  for (const sector of ALL_SECTORS) {
    const recentStat = analysis.recent.sectorStats[sector];
    const shortStat = analysis.short.sectorStats[sector];
    const longStat = analysis.long.sectorStats[sector];
    const fullStat = analysis.full.sectorStats[sector];

    if (!recentStat || !longStat) continue;

    // Frequency score: blend of recent + long-term frequency
    const freqScore = (recentStat.frequency * 0.5 + longStat.frequency * 0.5);

    // Recency score: lower recency = higher score (just appeared = good)
    // Normalize: recency 0 → 100, recency = windowSize → 0
    const recencyScore = Math.max(0, 100 - (recentStat.recency / Math.max(1, analysis.recent.totalSpins)) * 100);

    // Transition score: Markov order-1 probability after last spin
    const transitionScore = recentStat.transitionProb;

    // Interval score: if current gap > avg interval, sector is "overdue"
    // Score = how much over the average the current gap is
    const currentGap = recentStat.recency;
    const avgInterval = shortStat.avgInterval || 1;
    const intervalScore = Math.min(100, (currentGap / avgInterval) * 50);

    // Distribution score: how this sector's recent frequency compares to long-term
    const distScore = longStat.frequency;  // higher base frequency = higher score

    // Momentum score: positive momentum delta = heating up
    const momentumScore = Math.max(0, Math.min(100, 50 + recentStat.momentumDelta));

    // Combined score using adaptive weights
    const totalScore =
      freqScore * weights.frequency +
      recencyScore * weights.recency +
      transitionScore * weights.transition +
      intervalScore * weights.interval +
      distScore * weights.distribution +
      momentumScore * weights.momentum;

    candidates.push({
      sector,
      sectorLabel: sector,  // will be labeled by caller
      totalScore,
      evidence: {
        frequencyScore: Math.round(freqScore * 100) / 100,
        recencyScore: Math.round(recencyScore * 100) / 100,
        transitionScore: Math.round(transitionScore * 100) / 100,
        intervalScore: Math.round(intervalScore * 100) / 100,
        distributionScore: Math.round(distScore * 100) / 100,
        momentumScore: Math.round(momentumScore * 100) / 100,
      },
      weights: {
        frequency: Math.round(weights.frequency * 100) / 100,
        recency: Math.round(weights.recency * 100) / 100,
        transition: Math.round(weights.transition * 100) / 100,
        interval: Math.round(weights.interval * 100) / 100,
        distribution: Math.round(weights.distribution * 100) / 100,
        momentum: Math.round(weights.momentum * 100) / 100,
      },
      isBonus: BONUS_SET.has(sector),
    });
  }

  // Sort by total score (highest first)
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  return candidates;
}

// ============================================================
// 4. CONFIDENCE — generated dynamically from evidence
// ============================================================

// Confidence is NOT hardcoded. It's derived from:
// - The top candidate's score relative to the runner-up (dominance)
// - The amount of evidence available (data sufficiency)
// - The validated historical performance of the model
export function computeConfidence(
  topCandidate: CandidateScore,
  secondCandidate: CandidateScore | undefined,
  totalSpins: number,
  validatedAccuracy: number | null
): number {
  if (!topCandidate) return 0;

  // Dominance: how much the top pick leads the runner-up
  const topScore = topCandidate.totalScore;
  const secondScore = secondCandidate?.totalScore ?? 0;
  const maxPossible = 100;
  const dominance = topScore > 0 ? Math.max(0, Math.min(1, (topScore - secondScore) / maxPossible)) : 0;

  // Base confidence from dominance (35-85 range)
  let base = 35 + dominance * 50;

  // Data sufficiency: more data = more confidence (up to +10)
  const dataBoost = Math.min(10, (totalSpins / 200) * 10);
  base += dataBoost;

  // Validated accuracy boost: if the model has been right historically, +5
  if (validatedAccuracy != null && validatedAccuracy >= 70) base += 5;
  else if (validatedAccuracy != null && validatedAccuracy < 40) base -= 10;

  // Bonus sectors: cap lower (rare events)
  if (topCandidate.isBonus) base = Math.min(base, 75);

  // Clamp to 30-90 (honest range — never claim 95%+ on a random wheel)
  return Math.round(Math.max(30, Math.min(90, base)));
}

// ============================================================
// 5. PERSISTENCE — record predictions to DB
// ============================================================

// Generate a deterministic prediction ID from source spin + strategy
// This provides duplicate protection: the same source spin + strategy
// always produces the same prediction ID, so we can't insert duplicates.
function makePredictionId(sourceSpinId: string, strategy: string): string {
  return `pred_${sourceSpinId}_${strategy}`;
}

export interface PredictionRecord {
  predictionId: string;
  strategy: string;
  predictedSector: string;
  predictedLabel: string;
  topSectors: string[];
  confidence: number;
  modelScore: number;
  observedHitRate: number;
  sourceSpinId: string;
  sourceSpinTimestamp: string;
  status: "PENDING" | "WIN" | "LOSS";
}

// Record a prediction to the DB with duplicate protection
export async function recordPredictionToDB(record: PredictionRecord): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[prediction-engine] recordPredictionToDB SKIPPED — DB unavailable");
      return false;
    }
    // Use upsert with the deterministic predictionId — if a prediction with
    // the same source spin + strategy already exists, don't create a duplicate.
    await db.predictionRecord.upsert({
      where: { predictionId: record.predictionId },
      create: {
        predictionId: record.predictionId,
        strategy: record.strategy,
        predictedSector: record.predictedSector,
        predictedLabel: record.predictedLabel,
        topSectors: JSON.stringify(record.topSectors),
        confidence: record.confidence,
        modelScore: record.modelScore,
        observedHitRate: record.observedHitRate,
        sourceSpinId: record.sourceSpinId,
        sourceSpinTimestamp: record.sourceSpinTimestamp,
        status: "PENDING",
      },
      update: {},  // don't update if already exists (idempotent)
    });
    console.log(`[prediction-engine] DB WRITE SUCCESS: predictionId=${record.predictionId} strategy=${record.strategy} predicted=${record.predictedLabel} sourceSpin=${record.sourceSpinId} status=PENDING`);
    return true;
  } catch (err) {
    console.error(`[prediction-engine] DB WRITE FAILED: predictionId=${record.predictionId} error=${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ============================================================
// 6. VERIFICATION — idempotent, against the next real spin
// ============================================================

export interface VerificationResult {
  verified: number;
  wins: number;
  losses: number;
  top3Hits: number;
}

// Verify pending predictions against the latest spins.
// IDEMPOTENT: only verifies predictions whose sourceSpinId has a NEXT spin
// in the history, and never verifies the same prediction twice.
export async function verifyPendingPredictions(
  validatedSpins: ValidatedSpin[]
): Promise<VerificationResult> {
  const result: VerificationResult = { verified: 0, wins: 0, losses: 0, top3Hits: 0 };

  if (validatedSpins.length < 2) return result;

  try {
    const db = await getDb();
    if (!db) return result;
    // Get all pending predictions
    const pending = await db.predictionRecord.findMany({
      where: { status: "PENDING" },
      take: 100,
    });

    if (pending.length === 0) return result;

    // Build a map of spinId → index in the chronological array
    const spinIndexMap = new Map<string, number>();
    for (let i = 0; i < validatedSpins.length; i++) {
      spinIndexMap.set(validatedSpins[i].spinId, i);
    }

    for (const pred of pending) {
      // Find the source spin's position in the chronological array
      const sourceIdx = spinIndexMap.get(pred.sourceSpinId);
      if (sourceIdx === undefined) {
        // Source spin not in current window — skip (can't verify)
        continue;
      }

      // The NEXT spin after the source spin is the actual result
      const nextIdx = sourceIdx + 1;
      if (nextIdx >= validatedSpins.length) {
        // No next spin yet — prediction is still pending
        continue;
      }

      const actualSpin = validatedSpins[nextIdx];
      const actualSector = actualSpin.result;

      // Determine WIN/LOSS
      const isHit = actualSector === pred.predictedSector;
      let topSectors: string[] = [];
      try {
        topSectors = JSON.parse(pred.topSectors) as string[];
      } catch {
        topSectors = [];
      }
      const isTop3Hit = topSectors.includes(actualSector);

      // CRITICAL: Verify against the NEXT spin, not the same spin that generated
      // the prediction. sourceIdx + 1 = the spin AFTER the source spin.
      // This is already correct — actualSpin is at nextIdx = sourceIdx + 1.

      // Update the prediction record (idempotent — only if still PENDING)
      const updateResult = await db.predictionRecord.updateMany({
        where: {
          predictionId: pred.predictionId,
          status: "PENDING",  // only update if still pending (idempotent)
        },
        data: {
          actualSector,
          actualEventId: actualSpin.spinId,
          verifiedAt: new Date(),
          isHit,
          isTop3Hit,
          status: isHit ? "WIN" : "LOSS",
        },
      });

      console.log(`[prediction-engine] VERIFICATION: predictionId=${pred.predictionId} sourceSpinId=${pred.sourceSpinId} actualSpinId=${actualSpin.spinId} predicted=${pred.predictedSector} actual=${actualSector} status=${isHit ? "WIN" : "LOSS"} updated=${updateResult.count}`);

      result.verified++;
      if (isHit) result.wins++;
      else result.losses++;
      if (isTop3Hit) result.top3Hits++;
    }

    return result;
  } catch (err) {
    console.error("[prediction-engine] verifyPendingPredictions error:", err);
    return result;
  }
}

// ============================================================
// 7. ACCURACY — calculated from actual stored records
// ============================================================

export interface AccuracyStats {
  totalPredictions: number;
  pending: number;
  verified: number;
  wins: number;
  losses: number;
  top3Hits: number;
  winRate: number;        // wins / verified * 100
  top3Rate: number;       // top3Hits / verified * 100
  currentStreak: number;  // consecutive wins (positive) or losses (negative)
  perStrategy: {
    strategy: string;
    total: number;
    verified: number;
    wins: number;
    losses: number;
    winRate: number;
    top3Rate: number;
  }[];
  recentVerifications: {
    predictionId: string;
    strategy: string;
    predictedLabel: string;
    actualSector: string | null;
    status: "PENDING" | "WIN" | "LOSS";
    isTop3Hit: boolean | null;
    predictedAt: string;
    verifiedAt: string | null;
    sourceSpinId: string;
  }[];
}

export async function getAccuracyFromDB(): Promise<AccuracyStats> {
  const empty: AccuracyStats = {
    totalPredictions: 0,
    pending: 0,
    verified: 0,
    wins: 0,
    losses: 0,
    top3Hits: 0,
    winRate: 0,
    top3Rate: 0,
    currentStreak: 0,
    perStrategy: [],
    recentVerifications: [],
  };
  try {
    const db = await getDb();
    if (!db) return empty;
    const all = await db.predictionRecord.findMany({
      orderBy: { predictedAt: "desc" },
      take: 200,
    });

    const totalPredictions = all.length;
    const pending = all.filter((p) => p.status === "PENDING").length;
    const verified = all.filter((p) => p.status === "WIN" || p.status === "LOSS").length;
    const wins = all.filter((p) => p.status === "WIN").length;
    const losses = all.filter((p) => p.status === "LOSS").length;
    const top3Hits = all.filter((p) => p.isTop3Hit === true).length;

    const winRate = verified > 0 ? (wins / verified) * 100 : 0;
    const top3Rate = verified > 0 ? (top3Hits / verified) * 100 : 0;

    // Current streak: walk from newest to oldest, count consecutive same-status
    let currentStreak = 0;
    const sortedByTime = [...all].sort((a, b) => b.predictedAt.getTime() - a.predictedAt.getTime());
    for (const p of sortedByTime) {
      if (p.status === "PENDING") continue;
      if (currentStreak === 0) {
        currentStreak = p.status === "WIN" ? 1 : -1;
      } else if (currentStreak > 0 && p.status === "WIN") {
        currentStreak++;
      } else if (currentStreak < 0 && p.status === "LOSS") {
        currentStreak--;
      } else {
        break;
      }
    }

    // Per-strategy stats
    const strategies = ["momentum", "hot_trend", "overdue_bonus"];
    const perStrategy = strategies.map((strategy) => {
      const stratAll = all.filter((p) => p.strategy === strategy);
      const stratVerified = stratAll.filter((p) => p.status === "WIN" || p.status === "LOSS").length;
      const stratWins = stratAll.filter((p) => p.status === "WIN").length;
      const stratLosses = stratAll.filter((p) => p.status === "LOSS").length;
      const stratTop3 = stratAll.filter((p) => p.isTop3Hit === true).length;
      return {
        strategy,
        total: stratAll.length,
        verified: stratVerified,
        wins: stratWins,
        losses: stratLosses,
        winRate: stratVerified > 0 ? (stratWins / stratVerified) * 100 : 0,
        top3Rate: stratVerified > 0 ? (stratTop3 / stratVerified) * 100 : 0,
      };
    });

    // Recent verifications (last 10)
    const recentVerifications = all.slice(0, 10).map((p) => ({
      predictionId: p.predictionId,
      strategy: p.strategy,
      predictedLabel: p.predictedLabel,
      actualSector: p.actualSector,
      status: p.status as "PENDING" | "WIN" | "LOSS",
      isTop3Hit: p.isTop3Hit,
      predictedAt: p.predictedAt.toISOString(),
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      sourceSpinId: p.sourceSpinId,
    }));

    return {
      totalPredictions,
      pending,
      verified,
      wins,
      losses,
      top3Hits,
      winRate,
      top3Rate,
      currentStreak,
      perStrategy,
      recentVerifications,
    };
  } catch (err) {
    console.error("[prediction-engine] getAccuracyFromDB error:", err);
    return {
      totalPredictions: 0,
      pending: 0,
      verified: 0,
      wins: 0,
      losses: 0,
      top3Hits: 0,
      winRate: 0,
      top3Rate: 0,
      currentStreak: 0,
      perStrategy: [],
      recentVerifications: [],
    };
  }
}
