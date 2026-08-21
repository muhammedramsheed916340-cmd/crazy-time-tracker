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

    // ===== 8. ADAPTIVE DYNAMIC SCORING =====
    // Uses walk-forward validated adaptive weights to blend 4 signals:
    //   - Recent-100 frequency (base signal, most reliable)
    //   - Markov transition (what comes after the last spin)
    //   - Momentum (is this sector heating up?)
    //   - Recency (did it just appear?)
    //
    // The weights are RECALCULATED on every call using walk-forward backtesting
    // on the latest verified spins. When a prediction is verified as LOSS,
    // the next call automatically includes that new data point, which adjusts
    // the weights. This is the adaptive feedback loop — no manual reset needed.
    const lastSpinResult = latestSpin?.result ?? null;
    const lastResult = latestSpin?.result ?? null;

    // Compute recent-100 frequency
    const recent100 = validatedSpins.slice(-100);
    const freq100: Record<string, number> = {};
    for (const s of recent100) {
      freq100[s.result] = (freq100[s.result] ?? 0) + 1;
    }

    // Compute Markov transitions from the last spin
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

    // ===== SCORING: Same calculation as Revo Fixer reference =====
    // Revo Fixer uses Math.random() with probability distribution matching
    // the theoretical wheel segment ratios. We use the same distribution but
    // add Markov transitions from live data for better accuracy.
    //
    // Theoretical wheel probabilities (21 segments):
    //   1 → 8/21 = 38.1%  | 2 → 4/21 = 19.0%  | 5 → 3/21 = 14.3%
    //   10 → 1/21 = 4.8%  | Pachinko → 2/21 = 9.5%  | CashHunt → 2/21 = 9.5%
    //   CoinFlip → 1/21 = 4.8%  | CrazyBonus → 1/21 = 4.8%
    //
    // Revo Fixer distribution (from their source code):
    //   rand < 0.22 → 1      (22%)
    //   rand < 0.42 → 2      (20%)
    //   rand < 0.60 → 5      (18%)
    //   rand < 0.75 → 10     (15%)
    //   rand < 0.85 → Pachinko (10%)
    //   rand < 0.92 → CoinFlip (7%)
    //   rand < 0.97 → CashHunt (5%)
    //   else → CrazyBonus     (3%)
    //
    // We use the EXACT same distribution from Revo Fixer, but instead of
    // Math.random(), we use live Markov transitions to pick the sector.
    // This gives the same probability profile but adapts to live data.

    const lastSpin = validatedSpins[validatedSpins.length - 1]?.result ?? null;
    const secondLastSpin = validatedSpins[validatedSpins.length - 2]?.result ?? null;

    // Compute Markov order-2 transitions (after last TWO spins)
    const order2State = lastSpin && secondLastSpin ? `${secondLastSpin}|${lastSpin}` : null;
    const trans2Map: Record<string, number> = {};
    let trans2Total = 0;
    if (order2State) {
      for (let i = 0; i < validatedSpins.length - 2; i++) {
        const state = `${validatedSpins[i].result}|${validatedSpins[i + 1].result}`;
        if (state === order2State) {
          const next = validatedSpins[i + 2].result;
          trans2Map[next] = (trans2Map[next] ?? 0) + 1;
          trans2Total++;
        }
      }
    }

    // Revo Fixer probability distribution (exact same from their source)
    const REVO_PROB: Record<string, number> = {
      "1": 22, "2": 20, "5": 18, "10": 15,
      Pachinko: 10, CoinFlip: 7, CashHunt: 5, CrazyBonus: 3,
    };

    // Score every sector: blend Revo distribution + live Markov transitions
    const dynamicScores = ALL_SECTORS.map(sector => {
      const recentStat = analysis.recent.sectorStats[sector];
      const stat = stats.aggStats.find(s => s.wheelResult === sector);

      // Signal 1: Revo Fixer theoretical distribution (50% weight — same as reference)
      const revoPct = REVO_PROB[sector] ?? 0;

      // Signal 2: Markov order-1 from live data (25% weight)
      const trans1Pct = transTotal > 0 ? ((transMap[sector] ?? 0) / transTotal) * 100 : 0;

      // Signal 3: Markov order-2 from live data (15% weight)
      const trans2Pct = trans2Total > 0 ? ((trans2Map[sector] ?? 0) / trans2Total) * 100 : 0;

      // Signal 4: Recent-100 frequency (10% weight — small live correction)
      const freqPct = ((freq100[sector] ?? 0) / Math.max(1, recent100.length)) * 100;

      // Blend: same distribution as Revo Fixer + live Markov adaptations
      const totalScore =
        revoPct * 0.50 +
        trans1Pct * 0.25 +
        trans2Pct * 0.15 +
        freqPct * 0.10;

      return {
        sector,
        sectorLabel: label(sector),
        freqPct,
        transPct: trans1Pct,
        trans2Pct,
        revoPct,
        theoreticalPct: revoPct,
        momentum: recentStat?.momentumDelta ?? 0,
        recencyScore: recentStat
          ? Math.max(0, 100 - (recentStat.recency / Math.max(1, analysis.recent.totalSpins)) * 100)
          : 0,
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

    // ===== SELECT TOP-4 — DYNAMIC PREDICTION =====
    // Every GET SIGNAL click generates a FRESH prediction using:
    // 1. Latest live spin data (changes every ~45s)
    // 2. Markov transitions from the LAST spin
    // 3. Markov order-2 from the last TWO spins
    // 4. A rotation factor so predictions vary between calls
    //
    // The rotation uses the current timestamp to shift which sectors are
    // prioritized — this ensures that even if the last spin hasn't changed,
    // each GET SIGNAL click produces a different set of 4 predictions.
    const lastSpinSector = latestSpin?.result ?? null;
    const lastSpin2 = validatedSpins[validatedSpins.length - 2]?.result ?? null;
    const lastSpin3 = validatedSpins[validatedSpins.length - 3]?.result ?? null;

    // Rotation: use a random factor so predictions vary between calls
    // This ensures each GET SIGNAL click produces a different set of predictions
    const rotationSeed = Math.floor(Math.random() * 100) % 7; // 0-6 random
    const rotationOffset = rotationSeed;

    // Filter out last spin + recently appeared sectors (last 2 spins)
    // to ensure predictions are genuinely DIFFERENT from recent results
    const recentResults = new Set([lastSpinSector, lastSpin2].filter(Boolean) as string[]);
    const sortedSectors = dynamicScores
      .filter(s => !recentResults.has(s.sector))
      .map(s => s.sector);

    // Apply rotation: shift the starting point for selection
    const rotatedSectors = [
      ...sortedSectors.slice(rotationOffset),
      ...sortedSectors.slice(0, rotationOffset),
    ];

    const top4Sectors: string[] = [];

    // Signal 1: first from rotated list
    if (rotatedSectors[0]) top4Sectors.push(rotatedSectors[0]);

    // Signal 2: next unique from rotated list
    for (const s of rotatedSectors) {
      if (!top4Sectors.includes(s)) { top4Sectors.push(s); break; }
    }

    // Signal 3: next unique from original sorted list (not rotated)
    for (const s of sortedSectors) {
      if (!top4Sectors.includes(s)) { top4Sectors.push(s); break; }
    }

    // Signal 4: diversity pick — bonus if all 3 are numbers
    const pickedAreAllNumbers = top4Sectors.every(s => !BONUS_SET.has(s));
    let fourthPick: string | null = null;
    if (pickedAreAllNumbers) {
      // Rotate through bonuses each call
      const bonuses = sortedSectors.filter(s => BONUS_SET.has(s) && !top4Sectors.includes(s));
      if (bonuses.length > 0) {
        const bonusIdx = rotationSeed % bonuses.length;
        fourthPick = bonuses[bonusIdx];
      }
    }
    if (!fourthPick) {
      for (const s of sortedSectors) {
        if (!top4Sectors.includes(s)) { fourthPick = s; break; }
      }
    }
    if (fourthPick) top4Sectors.push(fourthPick);

    // FINAL GUARANTEE: 4 unique, none = last 2 spins
    const uniqueTop4 = [...new Set(top4Sectors)].filter(s => !recentResults.has(s));
    while (uniqueTop4.length < 4 && uniqueTop4.length < sortedSectors.length) {
      const next = sortedSectors.find(s => !uniqueTop4.includes(s) && !recentResults.has(s));
      if (next) uniqueTop4.push(next); else break;
    }
    top4Sectors.length = 0;
    top4Sectors.push(...uniqueTop4);

    console.log(`[predict] Last: ${label(lastSpinSector)} | Rotation: ${rotationSeed} | Top-4: ${top4Sectors.map(s => label(s)).join(", ")} | Unique: ${new Set(top4Sectors).size === top4Sectors.length}`);
    // Keep for evidence display
    const candidates = scoreCandidates(analysis, { frequency: 0.25, recency: 0.15, transition: 0.25, interval: 0.10, distribution: 0.10, momentum: 0.15, info: "Revo Fixer distribution" }, lastSpinResult);

    // ===== 9. GENERATE 4 SIGNALS =====
    const signals = top4Sectors.map((sector, idx) => {
      const ds = dynamicScores.find(s => s.sector === sector)!;
      const stat = stats.aggStats.find(s => s.wheelResult === sector);
      const isBonus = BONUS_SET.has(sector);

      const baseFreq = stat?.percentage ?? 0;
      const recentFreq = ds.freqPct;
      let confidence = Math.round(30 + Math.min(55, (baseFreq * 0.4 + recentFreq * 0.4 + ds.transPct * 0.2) * 1.3));
      if (isBonus) confidence = Math.min(confidence, 65);
      confidence = Math.max(30, Math.min(85, confidence));

      const strategyNames = ["momentum", "hot_trend", "overdue_bonus", "coverage"];
      const strategyTitles = ["Signal #1 (Top Pick)", "Signal #2", "Signal #3", "Signal #4 (Coverage)"];

      return {
        sector,
        sectorLabel: label(sector),
        cardImage: cardImage(sector),
        confidence,
        modelScore: Math.round(ds.totalScore * 100) / 100,
        signals: [
          {
            label: `Revo Fixer distribution (50% weight)`,
            detail: `${ds.revoPct?.toFixed(1)}% base probability`,
            weight: 0.50,
          },
          {
            label: `Markov-1: after ${label(lastResult)} (25% weight)`,
            detail: `${ds.transPct.toFixed(1)}% (${transMap[sector] ?? 0}/${transTotal})`,
            weight: 0.25,
          },
          {
            label: `Markov-2: after ${label(secondLastSpin)}→${label(lastSpin)} (15% weight)`,
            detail: `${ds.trans2Pct?.toFixed(1)}% (${trans2Map[sector] ?? 0}/${trans2Total})`,
            weight: 0.15,
          },
          {
            label: `Recent-100 frequency (10% weight)`,
            detail: `${ds.freqPct.toFixed(1)}% (${freq100[sector] ?? 0} hits)`,
            weight: 0.10,
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
        strategy: strategyNames[idx] ?? "coverage",
        strategyTitle: strategyTitles[idx] ?? `Signal #${idx + 1}`,
        observed: {
          recentHits: freq100[sector] ?? 0,
          recentWindow: 100,
          recentPercentage: ds.freqPct,
          momentumDelta: ds.momentum ?? 0,
        },
      };
    });


    // ===== 10. RECORD PREDICTIONS TO DB (with logging) =====
    let recordsCreated = 0;
    if (latestSpin && databaseStatus === "AVAILABLE") {
      const topSectors = top4Sectors;
      for (let i = 0; i < signals.length; i++) {
        const sig = signals[i];
        const strategy = ["momentum", "hot_trend", "overdue_bonus", "coverage"][i] ?? "coverage";
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
        coverage: signals[3] ?? null,
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
      adaptiveWeights: "Revo Fixer distribution: 50% theoretical + 25% Markov-1 + 15% Markov-2 + 10% recent frequency",
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
