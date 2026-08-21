import { NextRequest, NextResponse } from "next/server";
import { fetchCrazyTimeEvents, fetchCrazyTimeStats } from "@/lib/crazytime/upstream";
import { normalizeSpins, normalizeStats, label, cardImage } from "@/lib/crazytime/adapter";
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

    // ===== 8. SCORE CANDIDATES =====
    const lastSpinResult = latestSpin?.result ?? null;
    const candidates = scoreCandidates(analysis, adaptiveWeights, lastSpinResult);

    // ===== 9. GENERATE 3 SIGNALS (top-3 candidates) =====
    const top3 = candidates.slice(0, 3);

    const signals = top3.map((cand, idx) => {
      const confidence = computeConfidence(
        cand,
        candidates[idx + 1],
        validatedSpins.length,
        validatedWinRate
      );

      return {
        sector: cand.sector,
        sectorLabel: label(cand.sector),
        cardImage: cardImage(cand.sector),
        confidence,
        modelScore: Math.round(cand.totalScore * 100) / 100,
        signals: [
          {
            label: `Frequency evidence (${analysis.recent.windowName} window)`,
            detail: `${cand.evidence.frequencyScore.toFixed(1)}% recent frequency (blended with long-term)`,
            weight: cand.weights.frequency,
          },
          {
            label: `Recency evidence`,
            detail: `${cand.evidence.recencyScore.toFixed(1)}% — last appeared ${analysis.recent.sectorStats[cand.sector]?.recency ?? 0} spins ago`,
            weight: cand.weights.recency,
          },
          {
            label: `Transition evidence (Markov after ${label(lastSpinResult)})`,
            detail: `${cand.evidence.transitionScore.toFixed(1)}% probability — historically comes after "${label(lastSpinResult)}"`,
            weight: cand.weights.transition,
          },
          {
            label: `Interval evidence (overdue)`,
            detail: `${cand.evidence.intervalScore.toFixed(1)}% — avg interval ${analysis.short.sectorStats[cand.sector]?.avgInterval.toFixed(1) ?? "—"} spins`,
            weight: cand.weights.interval,
          },
          {
            label: `Distribution evidence`,
            detail: `${cand.evidence.distributionScore.toFixed(1)}% long-term base frequency`,
            weight: cand.weights.distribution,
          },
          {
            label: `Momentum evidence`,
            detail: `${cand.evidence.momentumScore.toFixed(1)}% — momentum delta ${analysis.recent.sectorStats[cand.sector]?.momentumDelta.toFixed(2) ?? "0"}%`,
            weight: cand.weights.momentum,
          },
        ],
        isBonus: cand.isBonus,
        observedPercentage: analysis.long.sectorStats[cand.sector]?.frequency ?? 0,
        observedCount: stats.aggStats.find((s) => s.wheelResult === cand.sector)?.count ?? 0,
        observedLastSeenBefore: analysis.recent.sectorStats[cand.sector]?.recency ?? null,
        observedHotFrequencyPercentage: stats.aggStats.find((s) => s.wheelResult === cand.sector)?.hotFrequencyPercentage ?? null,
        generatedAt: new Date().toISOString(),
        sessionTotal: 0,
        modelAccuracy: accuracy && accuracy.verified > 0 ? accuracy.top3Rate : null,
        strategy: idx === 0 ? "momentum" : idx === 1 ? "hot_trend" : "overdue_bonus",
        strategyTitle: idx === 0 ? "Signal #1 (Top Pick)" : idx === 1 ? "Signal #2 (2nd Pick)" : "Signal #3 (3rd Pick)",
        observed: {
          recentHits: analysis.recent.sectorStats[cand.sector]?.count ?? 0,
          recentWindow: analysis.recent.totalSpins,
          recentPercentage: analysis.recent.sectorStats[cand.sector]?.frequency ?? 0,
          momentumDelta: analysis.recent.sectorStats[cand.sector]?.momentumDelta ?? 0,
        },
      };
    });

    // ===== 10. RECORD PREDICTIONS TO DB (with logging) =====
    let recordsCreated = 0;
    if (latestSpin && databaseStatus === "AVAILABLE") {
      const topSectors = top3.map((c) => c.sector);
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
      ranked: candidates.slice(0, 8).map((c) => ({
        sector: c.sector,
        sectorLabel: label(c.sector),
        score: c.totalScore,
        percentage: analysis.long.sectorStats[c.sector]?.frequency ?? 0,
        hotFrequencyPercentage: stats.aggStats.find((s) => s.wheelResult === c.sector)?.hotFrequencyPercentage ?? null,
        lastSeenBefore: analysis.recent.sectorStats[c.sector]?.recency ?? null,
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
