import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents } from "@/lib/crazytime/upstream";
import { normalizeSpins } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
} from "@/lib/crazytime/constants";
import {
  validateAndNormalizeSpins,
  analyzeAllWindows,
  computeAdaptiveWeightsFromWalkForward,
  scoreCandidates,
  computeConfidence,
  type ValidatedSpin,
} from "@/lib/crazytime/prediction-engine";
import {
  computeOptimalWeights,
  scoreCandidate,
  evaluateTop3Combos,
  type CandidateEvidence,
} from "@/lib/crazytime/optimized-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const ALL_SECTORS = ["1", "2", "5", "10", "CoinFlip", "Pachinko", "CashHunt", "CrazyBonus"];

interface BacktestResult {
  engine: string;
  top1Rate: number;
  top3Rate: number;
  missRate: number;
  recent20Top3Rate: number;
  recent50Top3Rate: number;
  totalPoints: number;
  perSectorCoverage: Record<string, { appeared: number; inTop3: number; coverage: number }>;
  recentResults: { predicted: string[]; actual: string; hit: boolean }[];
}

function runBacktest(
  spins: ValidatedSpin[],
  engineName: string,
  selectFn: (candidates: CandidateEvidence[], analysis: any, weights: any) => string[]
): BacktestResult {
  let top1Hits = 0, top3Hits = 0;
  const results: { predicted: string[]; actual: string; hit: boolean }[] = [];
  const perSector: Record<string, { appeared: number; inTop3: number }> = {};
  for (const s of ALL_SECTORS) perSector[s] = { appeared: 0, inTop3: 0 };

  const startIdx = Math.max(20, spins.length - 100);
  for (let i = startIdx; i < spins.length - 1; i++) {
    const prior = spins.slice(Math.max(0, i - 200), i);
    if (prior.length < 20) continue;

    const analysis = analyzeAllWindows(prior);
    if (!analysis.dataReady) continue;

    const weights = computeOptimalWeights(prior);
    const lastResult = prior[prior.length - 1].result;

    // Score all candidates
    const candidates: CandidateEvidence[] = ALL_SECTORS.map(sector =>
      scoreCandidate(sector, analysis, weights, lastResult, analysis.recent.transitions, prior)
    );

    // Select top-3 using the engine's selection function
    const top3 = selectFn(candidates, analysis, weights);
    const actual = spins[i + 1].result;

    const top1Hit = top3[0] === actual;
    const top3Hit = top3.includes(actual);
    if (top1Hit) top1Hits++;
    if (top3Hit) top3Hits++;

    perSector[actual].appeared++;
    if (top3Hit) perSector[actual].inTop3++;

    results.push({ predicted: top3, actual, hit: top3Hit });
  }

  const total = results.length;
  const top1Rate = total > 0 ? (top1Hits / total) * 100 : 0;
  const top3Rate = total > 0 ? (top3Hits / total) * 100 : 0;

  const recent20 = results.slice(-20);
  const recent50 = results.slice(-50);
  const recent20Rate = recent20.length > 0 ? (recent20.filter(r => r.hit).length / recent20.length) * 100 : 0;
  const recent50Rate = recent50.length > 0 ? (recent50.filter(r => r.hit).length / recent50.length) * 100 : 0;

  const perSectorCoverage: Record<string, { appeared: number; inTop3: number; coverage: number }> = {};
  for (const s of ALL_SECTORS) {
    perSectorCoverage[s] = {
      appeared: perSector[s].appeared,
      inTop3: perSector[s].inTop3,
      coverage: perSector[s].appeared > 0 ? (perSector[s].inTop3 / perSector[s].appeared) * 100 : 0,
    };
  }

  return {
    engine: engineName,
    top1Rate,
    top3Rate,
    missRate: 100 - top3Rate,
    recent20Top3Rate: recent20Rate,
    recent50Top3Rate: recent50Rate,
    totalPoints: total,
    perSectorCoverage,
    recentResults: results.slice(-15),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const size = Math.min(500, Math.max(50, Number(sp.get("size") ?? 300)));

  try {
    const eventsRes = await fetchCrazyTimeEvents({
      page: 0, size, sort: DEFAULT_SORT,
      durationHours: DEFAULT_DURATION_HOURS,
      wheelResults: DEFAULT_WHEEL_RESULTS_FILTER,
      isTopSlotMatched: DEFAULT_TOPSLOT_MATCHED_FILTER,
      tableId: CRAZY_TIME_TABLE_ID,
    });

    const rawSpins = normalizeSpins(eventsRes.items);
    const validated = validateAndNormalizeSpins(rawSpins);

    if (validated.length < 30) {
      return NextResponse.json({ error: "Need at least 30 spins" }, { status: 400 });
    }

    // ===== ENGINE 1: Current (top-3 by score) =====
    const currentEngine = runBacktest(
      validated,
      "Current (top-3 by score)",
      (candidates) => candidates.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map(c => c.sector)
    );

    // ===== ENGINE 2: Optimized (joint combo evaluation) =====
    const optimizedEngine = runBacktest(
      validated,
      "Optimized (joint combo + diversity)",
      (candidates) => {
        const evals = evaluateTop3Combos(candidates, computeOptimalWeights(validated));
        return evals[0]?.combo ?? candidates.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map(c => c.sector);
      }
    );

    // ===== ENGINE 3: Theoretical best (always pick 1,2,5 — the 3 most common) =====
    const theoreticalBest = runBacktest(
      validated,
      "Theoretical (always 1,2,5)",
      () => ["1", "2", "5"]
    );

    // ===== ENGINE 4: Always pick top-3 by base frequency =====
    const baseFreqEngine = runBacktest(
      validated,
      "Base frequency (top-3 by 24h %)",
      (candidates) => candidates.sort((a, b) => b.distributionScore - a.distributionScore).slice(0, 3).map(c => c.sector)
    );

    const comparison = {
      spinsAnalyzed: validated.length,
      engines: [currentEngine, optimizedEngine, theoreticalBest, baseFreqEngine],
      bestEngine: [currentEngine, optimizedEngine, theoreticalBest, baseFreqEngine]
        .sort((a, b) => b.top3Rate - a.top3Rate)[0].engine,
      bestTop3Rate: Math.max(currentEngine.top3Rate, optimizedEngine.top3Rate, theoreticalBest.top3Rate, baseFreqEngine.top3Rate),
    };

    return NextResponse.json(comparison, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
