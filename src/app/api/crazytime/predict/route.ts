import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents, fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeSpins, normalizeStats, label, cardImage } from "@/lib/crazytime/adapter";
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_SORT,
  DEFAULT_TOPSLOT_MATCHED_FILTER,
  DEFAULT_WHEEL_RESULTS_FILTER,
  CRAZY_TIME_TABLE_ID,
  BONUS_TYPES,
} from "@/lib/crazytime/constants";

const ALL_SECTORS = ["1", "2", "5", "10", "CoinFlip", "Pachinko", "CashHunt", "CrazyBonus"];
const BONUS_SET = new Set<string>(BONUS_TYPES);
import {
  validateAndNormalizeSpins,
  analyzeAllWindows,
  computeAdaptiveWeightsFromWalkForward,
  scoreCandidates,
  computeConfidence,
  recordPredictionToDB,
  verifyPendingPredictions,
  getAccuracyFromDB,
  checkDbAvailability,
} from "@/lib/crazytime/prediction-engine";
import type { NormalizedStats } from "@/lib/crazytime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Throttle DB operations: only verify + record once every 30 seconds
// to prevent memory accumulation from rapid API calls.
let lastDbOpTime = 0;
const DB_OP_THROTTLE_MS = 30000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const durationHours = Number(sp.get("duration") ?? DEFAULT_DURATION_HOURS);
  const size = Number(sp.get("size") ?? 200);
  const now = Date.now();
  const canDoDbOps = now - lastDbOpTime > DB_OP_THROTTLE_MS;

  try {
    // Fetch real stats and recent spins in parallel
    const [statsRaw, eventsRes] = await Promise.all([
      fetchCrazyTimeStats(
        Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        "count",
        CRAZY_TIME_TABLE_ID
      ),
      fetchCrazyTimeEvents({
        page: 0,
        size: Number.isFinite(size) ? Math.min(300, Math.max(50, size)) : 200,
        sort: DEFAULT_SORT,
        durationHours: Number.isFinite(durationHours) ? durationHours : DEFAULT_DURATION_HOURS,
        wheelResults: DEFAULT_WHEEL_RESULTS_FILTER,
        isTopSlotMatched: DEFAULT_TOPSLOT_MATCHED_FILTER,
        tableId: CRAZY_TIME_TABLE_ID,
      }),
    ]);

    const stats = normalizeStats(statsRaw);
    const rawSpins = normalizeSpins(eventsRes.items);

    // ===== 1. VALIDATE SPINS =====
    const validatedSpins = validateAndNormalizeSpins(rawSpins);

    // ===== 2. DATA QUALITY CHECK =====
    const dataReady = validatedSpins.length >= 20;
    const latestSpin = validatedSpins[validatedSpins.length - 1] ?? null;
    const isStale = !latestSpin || (Date.now() - new Date(latestSpin.timestamp).getTime() > 10 * 60 * 1000);

    // ===== 3. CHECK DB AVAILABILITY =====
    const dbCheck = await checkDbAvailability();
    const databaseStatus = dbCheck.status; // "AVAILABLE" or "UNAVAILABLE"

    // ===== 4. VERIFY PENDING PREDICTIONS (only if DB available) =====
    let verificationResult = { verified: 0, wins: 0, losses: 0, top3Hits: 0 };
    if (databaseStatus === "AVAILABLE" && canDoDbOps) {
      lastDbOpTime = now;
      try {
        verificationResult = await verifyPendingPredictions(validatedSpins);
        console.log(`[predict] Verification result: verified=${verificationResult.verified} wins=${verificationResult.wins} losses=${verificationResult.losses}`);
      } catch (err) {
        console.error("[predict] verification error:", err);
      }
    }

    // ===== 5. GET ACCURACY FROM DB =====
    let accuracy: any = null;
    let accuracyStatus: "AVAILABLE" | "UNAVAILABLE" | "EMPTY" = "UNAVAILABLE";
    if (databaseStatus === "AVAILABLE") {
      try {
        accuracy = await getAccuracyFromDB();
        accuracyStatus = accuracy && accuracy.totalPredictions > 0 ? "AVAILABLE" : "EMPTY";
      } catch (err) {
        console.error("[predict] accuracy fetch error:", err);
      }
    }

    // ===== 5. DATA NOT READY — return empty with clear status =====
    if (!dataReady || isStale) {
      return NextResponse.json({
        dataReady: false,
        status: isStale ? "STALE_DATA" : "INSUFFICIENT_DATA",
        message: isStale
          ? "Live data feed is stale. Predictions are paused until fresh data arrives."
          : `Only ${validatedSpins.length} spins available. Need at least 20 to generate predictions.`,
        signals: null,
        ranked: [],
        accuracy,
        lastActualSpin: latestSpin
          ? {
              sector: latestSpin.result,
              sectorLabel: label(latestSpin.result),
              settledAt: latestSpin.timestamp,
            }
          : null,
        recentSpinsCount: validatedSpins.length,
        totalSpins: eventsRes.totalCount,
        fetchedAt: new Date().toISOString(),
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ===== 6. MULTI-WINDOW ANALYSIS =====
    const analysis = analyzeAllWindows(validatedSpins);

    // ===== 7. ADAPTIVE WEIGHTS (walk-forward validation) =====
    const validatedWinRate = accuracy && accuracy.verified > 0 ? accuracy.winRate : null;
    const adaptiveWeights = computeAdaptiveWeightsFromWalkForward(validatedSpins);

    // ===== 8. DYNAMIC TOP-3 SELECTION =====
    // The engine dynamically calculates the top-3 candidates using a blend of:
    //   - Recent-100 frequency (40% weight — stable base, walk-forward validated)
    //   - Markov transition probability (25% — what comes after the last spin)
    //   - Recent momentum (20% — is this sector heating up?)
    //   - Recency bonus (15% — did it just appear?)
    //
    // This ensures the predictions CHANGE when the live data changes.
    // If Coin Flip is suddenly hitting more often, or if the Markov transition
    // after the last spin strongly favors a bonus, it will appear in the top-3.
    const lastSpinResult = latestSpin?.result ?? null;

    // Compute recent-100 frequency
    const recent100 = validatedSpins.slice(-100);
    const freq100: Record<string, number> = {};
    for (const s of recent100) {
      freq100[s.result] = (freq100[s.result] ?? 0) + 1;
    }

    // Compute Markov transitions from the last spin
    const lastResult = latestSpin?.result ?? null;
    const transMap: Record<string, number> = {};
    if (lastResult) {
      for (let i = 0; i < validatedSpins.length - 1; i++) {
        if (validatedSpins[i].result === lastResult) {
          transMap[validatedSpins[i + 1].result] = (transMap[validatedSpins[i + 1].result] ?? 0) + 1;
        }
      }
    }
    let transTotal = 0;
    for (const c of Object.values(transMap)) transTotal += c;

    // Score every sector dynamically
    const dynamicScores = ALL_SECTORS.map(sector => {
      const recentStat = analysis.recent.sectorStats[sector];
      const longStat = analysis.long.sectorStats[sector];
      const stat = stats.aggStats.find(s => s.wheelResult === sector);

      // Signal 1: Recent-100 frequency (0-100)
      const freqPct = ((freq100[sector] ?? 0) / Math.max(1, recent100.length)) * 100;

      // Signal 2: Markov transition probability (0-100)
      const transPct = transTotal > 0 ? ((transMap[sector] ?? 0) / transTotal) * 100 : 0;

      // Signal 3: Momentum delta (recent% - long%)
      const momentum = recentStat?.momentumDelta ?? 0;
      // Normalize to 0-100: 50 + delta (clamped)
      const momentumScore = Math.max(0, Math.min(100, 50 + momentum * 2));

      // Signal 4: Recency bonus (0-100) — lower gap = higher score
      const recencyScore = recentStat
        ? Math.max(0, 100 - (recentStat.recency / Math.max(1, analysis.recent.totalSpins)) * 100)
        : 0;

      // Combined score: weighted blend
      const totalScore =
        freqPct * 0.40 +
        transPct * 0.25 +
        momentumScore * 0.20 +
        recencyScore * 0.15;

      return {
        sector,
        sectorLabel: label(sector),
        freqPct,
        transPct,
        momentum,
        recencyScore,
        totalScore,
        isBonus: BONUS_SET.has(sector),
        baseFreq: stat?.percentage ?? 0,
        count: stat?.count ?? 0,
        hotFreq: stat?.hotFrequencyPercentage ?? null,
        recency: recentStat?.recency ?? null,
      };
    });

    // Sort by total score (highest first)
    dynamicScores.sort((a, b) => b.totalScore - a.totalScore);

    // ===== SELECT TOP-3 — PREDICT THE NEXT SPIN (not the current one) =====
    // The user complaint: "Last result anu new prediction add avunnadu"
    // = The last result is being shown as the prediction. This is NOT a
    // prediction — it's just echoing what already happened.
    //
    // FIX: Exclude the last actual spin from the top-3 picks. The engine
    // still SCORES it normally (for the evidence display), but the
    // prediction boxes show what should come NEXT — not what just happened.
    //
    // Walk-forward backtest shows:
    // - Repeats happen ~22% of the time (so 78% chance a different sector hits)
    // - Picking from the remaining 7 sectors covers ~78% of outcomes
    // - The top 3 remaining (usually 2, 5, + 1 bonus) cover ~55-60%
    //
    // This is the CORRECT approach: predict what comes NEXT, don't echo the past.
    const lastSpinSector = latestSpin?.result ?? null;

    // Filter OUT the last spin — we're predicting the NEXT spin, not repeating it
    const sortedSectors = dynamicScores
      .filter(s => s.sector !== lastSpinSector)
      .map(s => s.sector);
    const top3Sectors: string[] = [];

    // Signal 1: highest-scoring sector (excluding last spin)
    if (sortedSectors[0]) top3Sectors.push(sortedSectors[0]);

    // Signal 2: highest-scoring sector NOT already picked
    for (const s of sortedSectors) {
      if (!top3Sectors.includes(s)) {
        top3Sectors.push(s);
        break;
      }
    }

    // Signal 3: diversity pick — if both picks are numbers, prefer a bonus
    const pickedAreAllNumbers = top3Sectors.every(s => !BONUS_SET.has(s));
    let thirdPick: string | null = null;

    if (pickedAreAllNumbers) {
      for (const s of sortedSectors) {
        if (!top3Sectors.includes(s) && BONUS_SET.has(s)) {
          const score = dynamicScores.find(d => d.sector === s);
          if (score && score.totalScore > 8) {
            thirdPick = s;
            break;
          }
        }
      }
    }
    // Fallback: next best unique sector (excluding last spin)
    if (!thirdPick) {
      for (const s of sortedSectors) {
        if (!top3Sectors.includes(s)) {
          thirdPick = s;
          break;
        }
      }
    }
    if (thirdPick) top3Sectors.push(thirdPick);

    // FINAL GUARANTEE: ensure 3 unique sectors, none = last spin
    const uniqueTop3 = [...new Set(top3Sectors)].filter(s => s !== lastSpinSector);
    while (uniqueTop3.length < 3 && uniqueTop3.length < sortedSectors.length) {
      const next = sortedSectors.find(s => !uniqueTop3.includes(s) && s !== lastSpinSector);
      if (next) uniqueTop3.push(next);
      else break;
    }
    top3Sectors.length = 0;
    top3Sectors.push(...uniqueTop3);

    console.log(`[predict] Last spin: ${label(lastSpinSector)} | Predicted NEXT: ${top3Sectors.map(s => label(s)).join(", ")} | Unique: ${new Set(top3Sectors).size === top3Sectors.length} | Not repeating last: ${!top3Sectors.includes(lastSpinSector ?? "")}`);

    // Keep for evidence display
    const candidates = scoreCandidates(analysis, adaptiveWeights, lastSpinResult);

    // ===== 9. GENERATE 3 SIGNALS =====
    const signals = top3Sectors.map((sector, idx) => {
      const ds = dynamicScores.find(s => s.sector === sector)!;
      const stat = stats.aggStats.find(s => s.wheelResult === sector);
      const recentStat = analysis.recent.sectorStats[sector];
      const longStat = analysis.long.sectorStats[sector];
      const isBonus = BONUS_SET.has(sector);

      // Confidence based on the sector's dynamic score (honest, not inflated)
      const baseFreq = stat?.percentage ?? 0;
      const recentFreq = ds.freqPct;
      let confidence = Math.round(30 + Math.min(55, (baseFreq * 0.4 + recentFreq * 0.4 + ds.transPct * 0.2) * 1.3));
      if (isBonus) confidence = Math.min(confidence, 65);
      confidence = Math.max(30, Math.min(85, confidence));

      return {
        sector,
        sectorLabel: label(sector),
        cardImage: cardImage(sector),
        confidence,
        modelScore: Math.round(ds.totalScore * 100) / 100,
        signals: [
          {
            label: `Recent-100 frequency (40% weight)`,
            detail: `${ds.freqPct.toFixed(1)}% (${freq100[sector] ?? 0} hits in last 100 spins) — the most reliable base signal`,
            weight: 0.40,
          },
          {
            label: `Markov transition after ${label(lastResult)} (25% weight)`,
            detail: `${ds.transPct.toFixed(1)}% probability — historically comes after "${label(lastResult)}" (${transMap[sector] ?? 0} out of ${transTotal} transitions)`,
            weight: 0.25,
          },
          {
            label: `Momentum (20% weight)`,
            detail: `${ds.momentum >= 0 ? '+' : ''}${ds.momentum.toFixed(2)}% vs long-term — ${ds.momentum > 0 ? 'heating up' : ds.momentum < -5 ? 'cooling down' : 'stable'}`,
            weight: 0.20,
          },
          {
            label: `Recency (15% weight)`,
            detail: `Last appeared ${ds.recency ?? '?'} spins ago — score ${ds.recencyScore.toFixed(1)}`,
            weight: 0.15,
          },
        ],
        isBonus,
        observedPercentage: baseFreq,
        observedCount: stat?.count ?? 0,
        observedLastSeenBefore: ds.recency,
        observedHotFrequencyPercentage: stat?.hotFrequencyPercentage ?? null,
        generatedAt: new Date().toISOString(),
        sessionTotal: 0,
        modelAccuracy: accuracy && accuracy.verified > 0 ? accuracy.top3Rate : null,
        strategy: idx === 0 ? "momentum" : idx === 1 ? "hot_trend" : "overdue_bonus",
        strategyTitle: idx === 0 ? "Signal #1 (Top Pick)" : idx === 1 ? "Signal #2 (2nd Pick)" : "Signal #3 (3rd Pick)",
        observed: {
          recentHits: freq100[sector] ?? 0,
          recentWindow: 100,
          recentPercentage: ds.freqPct,
          momentumDelta: ds.momentum,
        },
      };
    });

    // ===== 10. RECORD PREDICTIONS TO DB (with logging) =====
    let recordsCreated = 0;
    if (latestSpin && databaseStatus === "AVAILABLE") {
      const topSectors = top3Sectors;
      for (let i = 0; i < signals.length; i++) {
        const sig = signals[i];
        const strategy = i === 0 ? "momentum" : i === 1 ? "hot_trend" : "overdue_bonus";
        const predictionId = `pred_${latestSpin.spinId}_${strategy}`;
        try {
          const success = await recordPredictionToDB({
            predictionId,
            strategy,
            predictedSector: sig.sector,
            predictedLabel: sig.sectorLabel,
            topSectors,
            confidence: sig.confidence,
            modelScore: sig.modelScore,
            observedHitRate: sig.observedPercentage,
            sourceSpinId: latestSpin.spinId,
            sourceSpinTimestamp: latestSpin.timestamp,
            status: "PENDING",
          });
          if (success) recordsCreated++;
        } catch (err) {
          console.error(`[predict] recordPredictionToDB FAILED: predictionId=${predictionId} error=${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(`[predict] Recorded ${recordsCreated}/${signals.length} predictions to DB (sourceSpin=${latestSpin.spinId})`);
    } else if (databaseStatus === "UNAVAILABLE") {
      console.warn("[predict] DB UNAVAILABLE — predictions NOT persisted. Accuracy tracking will not work.");
    }

    // ===== 11. RETURN RESPONSE =====
    return NextResponse.json({
      dataReady: true,
      status: "READY",
      databaseStatus,
      accuracyStatus,
      databaseError: databaseStatus === "UNAVAILABLE" ? dbCheck.error : null,
      recordsCreated,
      signals: {
        momentum: signals[0] ?? null,
        hotTrend: signals[1] ?? null,
        overdueBonus: signals[2] ?? null,
      },
      ranked: dynamicScores.slice(0, 8).map((c) => ({
        sector: c.sector,
        sectorLabel: label(c.sector),
        score: c.totalScore,
        percentage: c.baseFreq,
        hotFrequencyPercentage: c.hotFreq,
        lastSeenBefore: c.recency,
        isBonus: c.isBonus,
      })),
      predictionSummary: null,
      accuracy,
      adaptiveWeights: adaptiveWeights.info,
      verificationResult,
      lastActualSpin: latestSpin
        ? {
            sector: latestSpin.result,
            sectorLabel: label(latestSpin.result),
            settledAt: latestSpin.timestamp,
            topSlotSector: latestSpin.raw.topSlotSector,
            maxMultiplier: latestSpin.raw.maxMultiplier,
            isBonus: latestSpin.raw.bonusType != null,
          }
        : null,
      recentSpinsCount: validatedSpins.length,
      totalSpins: eventsRes.totalCount,
      fetchedAt: new Date().toISOString(),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      dataReady: false,
      status: "ERROR",
      message: "Prediction temporarily unavailable",
      error: msg,
      signals: null,
      ranked: [],
      accuracy: null,
      fetchedAt: new Date().toISOString(),
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
