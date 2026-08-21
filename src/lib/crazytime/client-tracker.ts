"use client";

import type { NormalizedSpin } from "@/lib/crazytime/types";
import { label } from "@/lib/crazytime/adapter";

// ============================================================
// CLIENT-SIDE PREDICTION TRACKER
// ============================================================
// Stores prediction records in the browser's localStorage.
// This works on Vercel serverless (where SQLite files don't persist)
// without requiring any external database setup.
//
// The full pipeline runs client-side:
// 1. GET SIGNAL → save prediction as PENDING to localStorage
// 2. New spin arrives → find PENDING predictions whose source spin has a next spin
// 3. Compare predicted vs actual → mark WIN/LOSS
// 4. Calculate accuracy from localStorage records
// 5. Survives page refresh (localStorage is persistent)
// ============================================================

const STORAGE_KEY = "crazytime_predictions";

export interface ClientPredictionRecord {
  predictionId: string;
  strategy: string;
  predictedSector: string;
  predictedLabel: string;
  topSectors: string[];
  confidence: number;
  modelScore: number;
  sourceSpinId: string;
  sourceSpinTimestamp: string;
  predictedAt: string;
  status: "PENDING" | "WIN" | "LOSS";
  actualSector: string | null;
  actualEventId: string | null;
  verifiedAt: string | null;
  isTop3Hit: boolean | null;
}

export interface ClientAccuracyStats {
  totalPredictions: number;
  pending: number;
  verified: number;
  wins: number;
  losses: number;
  top3Hits: number;
  winRate: number;
  top3Rate: number;
  currentStreak: number;
  perStrategy: {
    strategy: string;
    total: number;
    verified: number;
    wins: number;
    losses: number;
    winRate: number;
    top3Rate: number;
  }[];
  recentVerifications: ClientPredictionRecord[];
}

// Read all predictions from localStorage
function readAll(): ClientPredictionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ClientPredictionRecord[];
  } catch {
    return [];
  }
}

// Write all predictions to localStorage
function writeAll(records: ClientPredictionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only the last 500 records to prevent localStorage overflow
    const trimmed = records.slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("[client-tracker] localStorage write failed:", err);
  }
}

// Record a new prediction (with duplicate protection)
export function recordPrediction(
  predictionId: string,
  strategy: string,
  predictedSector: string,
  predictedLabel: string,
  topSectors: string[],
  confidence: number,
  modelScore: number,
  sourceSpinId: string,
  sourceSpinTimestamp: string
): boolean {
  const records = readAll();

  // Duplicate protection: check if this prediction already exists
  const existing = records.find((r) => r.predictionId === predictionId);
  if (existing) {
    console.log(`[client-tracker] DUPLICATE SKIPPED: ${predictionId}`);
    return false;
  }

  // Create new record
  const record: ClientPredictionRecord = {
    predictionId,
    strategy,
    predictedSector,
    predictedLabel,
    topSectors,
    confidence,
    modelScore,
    sourceSpinId,
    sourceSpinTimestamp,
    predictedAt: new Date().toISOString(),
    status: "PENDING",
    actualSector: null,
    actualEventId: null,
    verifiedAt: null,
    isTop3Hit: null,
  };

  records.unshift(record);
  writeAll(records);
  console.log(`[client-tracker] RECORDED: ${predictionId} strategy=${strategy} predicted=${predictedLabel} sourceSpin=${sourceSpinId} status=PENDING`);
  return true;
}

// Verify pending predictions against the latest spins.
// IDEMPOTENT: only verifies predictions whose source spin has a NEXT spin
// in the history, and never verifies the same prediction twice.
export function verifyPending(spins: NormalizedSpin[]): {
  verified: number;
  wins: number;
  losses: number;
  top3Hits: number;
} {
  const result = { verified: 0, wins: 0, losses: 0, top3Hits: 0 };
  if (typeof window === "undefined") return result;
  if (spins.length < 2) return result;

  // Spins are newest-first from the API. Reverse to oldest-first for indexing.
  const chronological = [...spins].reverse();

  // Build a map of spinId → index
  const spinIndexMap = new Map<string, number>();
  for (let i = 0; i < chronological.length; i++) {
    if (chronological[i].id) {
      spinIndexMap.set(chronological[i].id, i);
    }
  }

  const records = readAll();
  let modified = false;

  for (const record of records) {
    if (record.status !== "PENDING") continue;

    // Find the source spin's position
    const sourceIdx = spinIndexMap.get(record.sourceSpinId);
    if (sourceIdx === undefined) continue;

    // The NEXT spin after the source is the actual result
    const nextIdx = sourceIdx + 1;
    if (nextIdx >= chronological.length) continue; // no next spin yet

    const actualSpin = chronological[nextIdx];
    if (!actualSpin.wheelResultSector) continue;

    const actualSector = actualSpin.wheelResultSector;
    const isHit = actualSector === record.predictedSector;
    const isTop3Hit = record.topSectors.includes(actualSector);

    // Update the record
    record.actualSector = actualSector;
    record.actualEventId = actualSpin.id;
    record.verifiedAt = new Date().toISOString();
    record.isHit = isHit;
    record.isTop3Hit = isTop3Hit;
    record.status = isHit ? "WIN" : "LOSS";

    console.log(`[client-tracker] VERIFIED: ${record.predictionId} source=${record.sourceSpinId} actual=${actualSpin.id} predicted=${record.predictedSector} actual=${actualSector} status=${record.status}`);

    result.verified++;
    if (isHit) result.wins++;
    else result.losses++;
    if (isTop3Hit) result.top3Hits++;
    modified = true;
  }

  if (modified) writeAll(records);
  return result;
}

// Get accuracy stats from localStorage
export function getAccuracy(): ClientAccuracyStats {
  const records = readAll();

  const totalPredictions = records.length;
  const pending = records.filter((r) => r.status === "PENDING").length;
  const verified = records.filter((r) => r.status === "WIN" || r.status === "LOSS").length;
  const wins = records.filter((r) => r.status === "WIN").length;
  const losses = records.filter((r) => r.status === "LOSS").length;
  const top3Hits = records.filter((r) => r.isTop3Hit === true).length;

  const winRate = verified > 0 ? (wins / verified) * 100 : 0;
  const top3Rate = verified > 0 ? (top3Hits / verified) * 100 : 0;

  // Current streak
  let currentStreak = 0;
  const sorted = [...records].sort(
    (a, b) => new Date(b.predictedAt).getTime() - new Date(a.predictedAt).getTime()
  );
  for (const r of sorted) {
    if (r.status === "PENDING") continue;
    if (currentStreak === 0) {
      currentStreak = r.status === "WIN" ? 1 : -1;
    } else if (currentStreak > 0 && r.status === "WIN") {
      currentStreak++;
    } else if (currentStreak < 0 && r.status === "LOSS") {
      currentStreak--;
    } else {
      break;
    }
  }

  // Per-strategy
  const strategies = ["momentum", "hot_trend", "overdue_bonus"];
  const perStrategy = strategies.map((strategy) => {
    const stratAll = records.filter((r) => r.strategy === strategy);
    const stratVerified = stratAll.filter((r) => r.status === "WIN" || r.status === "LOSS").length;
    const stratWins = stratAll.filter((r) => r.status === "WIN").length;
    const stratLosses = stratAll.filter((r) => r.status === "LOSS").length;
    const stratTop3 = stratAll.filter((r) => r.isTop3Hit === true).length;
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

  // Recent verifications (last 10, newest first)
  const recentVerifications = records.slice(0, 10);

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
}

// Clear all predictions (for debugging)
export function clearAll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  console.log("[client-tracker] All predictions cleared");
}
