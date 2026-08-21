"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrazyTimePredict } from "@/hooks/use-crazy-time";
import { relativeTime, label } from "@/lib/crazytime/adapter";
import type { NextSpinSignal } from "@/lib/crazytime/types";
import {
  Bolt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  Activity,
  Users,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Flame,
  Hourglass,
  XCircle,
} from "lucide-react";

// Faster countdown (30s) because Crazy Time spins arrive every ~40-50s.
// The new-spin detector polls every 5s, so predictions update within 5s of a
// new spin arriving — no need to wait for the full countdown.
const COUNTDOWN_SECONDS = 30;

type StrategyKey = "momentum" | "hotTrend" | "overdueBonus";

const STRATEGY_META: Record<
  StrategyKey,
  { title: string; subtitle: string; icon: typeof Zap; accent: string; short: string }
> = {
  momentum: {
    title: "SIGNAL 1",
    subtitle: "AI Top Pick",
    icon: Zap,
    accent: "#448AFF",
    short: "ENSEMBLE-1",
  },
  hotTrend: {
    title: "SIGNAL 2",
    subtitle: "AI 2nd Pick",
    icon: Flame,
    accent: "#ff6b35",
    short: "ENSEMBLE-2",
  },
  overdueBonus: {
    title: "SIGNAL 3",
    subtitle: "AI 3rd Pick",
    icon: Hourglass,
    accent: "#FFD700",
    short: "ENSEMBLE-3",
  },
};

export function SignalCard({
  signals,
  ranked,
  accuracy,
  lastActualSpin,
  recentSpinsCount,
  totalSpins,
  loading,
  error,
  lastUpdated,
  fetchNow,
}: {
  signals: ReturnType<typeof useCrazyTimePredict>["signals"];
  ranked: ReturnType<typeof useCrazyTimePredict>["ranked"];
  accuracy: ReturnType<typeof useCrazyTimePredict>["accuracy"];
  lastActualSpin: ReturnType<typeof useCrazyTimePredict>["lastActualSpin"];
  recentSpinsCount: number;
  totalSpins: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  fetchNow: () => Promise<void>;
}) {
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);
  const [autoOn, setAutoOn] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [lastSeenSpinId, setLastSeenSpinId] = useState<string | null>(null);
  const [newSpinDetected, setNewSpinDetected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runPredict = useCallback(async () => {
    setAnalysing(true);
    await new Promise((r) => setTimeout(r, 600));
    await fetchNow();
    setAnalysing(false);
    setAutoOn(true);
    setCountdown(COUNTDOWN_SECONDS);
    setNewSpinDetected(false);
  }, [fetchNow]);

  // Countdown timer (60s auto-refresh)
  useEffect(() => {
    if (!autoOn) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          void runPredict();
          return COUNTDOWN_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [autoOn, runPredict]);

  // NEW SPIN DETECTOR: poll the events API every 5s (was 10s). Crazy Time
  // spins arrive every ~40-50s, so 5s polling means we detect a new spin
  // within 5 seconds of it happening — predictions update almost instantly.
  useEffect(() => {
    if (!autoOn) {
      if (spinCheckRef.current) {
        clearInterval(spinCheckRef.current);
        spinCheckRef.current = null;
      }
      return;
    }
    const checkForNewSpin = async () => {
      try {
        const res = await fetch(`/api/crazytime/events?size=1&_=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const json = await res.json();
        const latestId = json?.spins?.[0]?.id;
        if (!latestId) return;
        if (lastSeenSpinId === null) {
          setLastSeenSpinId(latestId);
          return;
        }
        if (latestId !== lastSeenSpinId) {
          // NEW spin detected! Auto-refresh the prediction immediately.
          setLastSeenSpinId(latestId);
          setNewSpinDetected(true);
          void runPredict();
        }
      } catch {
        // ignore polling errors
      }
    };
    // Check immediately, then every 5s (was 10s)
    void checkForNewSpin();
    spinCheckRef.current = setInterval(checkForNewSpin, 5000);
    return () => {
      if (spinCheckRef.current) clearInterval(spinCheckRef.current);
      spinCheckRef.current = null;
    };
  }, [autoOn, lastSeenSpinId, runPredict]);

  const onGetSignal = useCallback(() => {
    void runPredict();
  }, [runPredict]);

  const onRefresh = useCallback(() => {
    setAutoOn(false);
    setCountdown(COUNTDOWN_SECONDS);
    void runPredict();
  }, [runPredict]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else if (autoOn) {
        void runPredict();
        setAutoOn(true);
        setCountdown(COUNTDOWN_SECONDS);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoOn, runPredict]);

  // Stats grid
  const verifiedTop3Rate = accuracy && accuracy.verified > 0 ? accuracy.top3Rate : null;
  const momAcc = signals?.momentum?.modelAccuracy;
  const hotAcc = signals?.hotTrend?.modelAccuracy;
  const bonusAcc = signals?.overdueBonus?.modelAccuracy;
  const avgBacktest =
    momAcc != null || hotAcc != null || bonusAcc != null
      ? (((momAcc ?? 0) + (hotAcc ?? 0) + (bonusAcc ?? 0)) /
          [momAcc, hotAcc, bonusAcc].filter((x) => x != null).length)
      : null;
  const displayAccuracy = verifiedTop3Rate != null ? verifiedTop3Rate : avgBacktest;
  const statTotal = totalSpins;
  const statAccuracy = displayAccuracy != null ? `${displayAccuracy.toFixed(1)}%` : "—";
  const statVerified = accuracy?.verified ?? 0;

  const signalsList: { key: StrategyKey; signal: NextSpinSignal | null }[] = [
    { key: "momentum", signal: signals?.momentum ?? null },
    { key: "hotTrend", signal: signals?.hotTrend ?? null },
    { key: "overdueBonus", signal: signals?.overdueBonus ?? null },
  ];

  return (
    <div className="signal-container bg-[#141827] border border-[#1e2240] rounded-[24px] p-4 sm:p-6 mb-5 relative overflow-hidden">
      {/* Countdown floating chip */}
      {autoOn && (
        <div className="absolute top-3 right-3 z-20 bg-[rgba(68,138,255,0.15)] backdrop-blur text-[#448AFF] px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[rgba(68,138,255,0.3)] flex items-center gap-1.5">
          <RefreshCw className={`w-3 h-3 ${newSpinDetected ? "animate-spin" : ""}`} />
          {newSpinDetected ? "New spin! Updating..." : `Next: ${countdown}s`}
        </div>
      )}

      {/* Label */}
      <div className="text-center text-[#448AFF] text-[11px] font-semibold mb-3 uppercase tracking-[2px] flex items-center justify-center gap-1.5">
        <Bolt className="w-3.5 h-3.5" />
        3 LIVE PREDICTIONS
        {lastUpdated && (
          <span className="text-[#8899cc] ml-2 normal-case tracking-normal font-normal">
            • {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Last actual spin result — shows what REALLY happened so users can
          immediately see if the previous prediction was right */}
      {lastActualSpin && (
        <div className="mb-3 rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] text-[#8899cc] uppercase tracking-wider flex-shrink-0">
              Last spin
            </span>
            <span className="text-sm font-bold text-white truncate">
              {label(lastActualSpin.sector)}
            </span>
            {lastActualSpin.maxMultiplier != null && lastActualSpin.maxMultiplier > 1 && (
              <span className="text-[10px] text-[#FFD700] font-bold flex-shrink-0">
                {lastActualSpin.maxMultiplier}×
              </span>
            )}
            {lastActualSpin.isBonus && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex-shrink-0">
                BONUS
              </span>
            )}
          </div>
          <span className="text-[9px] text-[#5a6a99] flex-shrink-0">
            {relativeTime(lastActualSpin.settledAt)}
          </span>
        </div>
      )}

      {/* 3 signal cards side-by-side */}
      {!signals && !analysing && !loading ? (
        <div className="text-center py-10 px-6 bg-[rgba(68,138,255,0.03)] rounded-2xl border border-dashed border-[#1e2240]">
          <Sparkles className="w-12 h-12 text-[#448AFF] mx-auto mb-3 opacity-60" />
          <div className="text-[#448AFF] text-base font-semibold mb-1">
            Click Get Signal To Start Live Session
          </div>
          <div className="text-[#5a6a99] text-xs">
            3 real-data predictions will appear here simultaneously
          </div>
        </div>
      ) : (analysing || loading) && !signals ? (
        <div className="text-center py-10 px-6">
          <div className="w-12 h-12 mx-auto mb-3 border-[3px] border-[rgba(68,138,255,0.2)] border-t-[#448AFF] rounded-full animate-spin" />
          <div className="text-[#448AFF] text-base font-semibold mb-1">Analyzing Patterns…</div>
          <div className="text-[#5a6a99] text-xs">
            Reading {totalSpins.toLocaleString()} live spins + last {recentSpinsCount} recent results
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {signalsList.map(({ key, signal }) => (
            <SignalMiniCard
              key={key}
              strategyKey={key}
              signal={signal}
              analysing={analysing || loading}
              lastActualSector={lastActualSpin?.sector ?? null}
            />
          ))}
        </div>
      )}

      {/* AI Adaptive Learning Panel — shows what the model learned from recent mistakes */}
      {(() => {
        const learnSignal = signals?.momentum?.signals?.find(
          (s) => s.label && s.label.includes("Adaptive learning")
        );
        if (!learnSignal) return null;
        return (
          <div className="mt-4 rounded-xl bg-gradient-to-r from-[#448AFF]/10 to-[#2962FF]/10 border border-[#448AFF]/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#448AFF] uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              AI Adaptive Learning (auto-correcting from mistakes)
            </div>
            <div className="text-[11px] text-[#bcc6e0] leading-relaxed">
              {learnSignal.detail}
            </div>
          </div>
        );
      })()}

      {/* Buttons */}
      <div className="flex gap-3 mt-5">
        <Button
          onClick={onGetSignal}
          disabled={analysing || loading}
          className="flex-1 h-12 bg-gradient-to-br from-[#448AFF] to-[#2962FF] hover:from-[#5598FF] hover:to-[#3a72FF] text-white font-bold text-[13px] uppercase tracking-wider rounded-xl shadow-[0_5px_15px_rgba(68,138,255,0.3)] disabled:opacity-60"
        >
          <Sparkles className="w-4 h-4 mr-1" />
          GET SIGNAL
        </Button>
        <Button
          onClick={onRefresh}
          disabled={analysing || loading}
          variant="secondary"
          className="flex-1 h-12 bg-[#0d1020] border border-[#1e2240] text-[#bcc6e0] hover:bg-[#141827] font-bold text-[13px] uppercase tracking-wider rounded-xl disabled:opacity-60"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          REFRESH
        </Button>
      </div>

      {/* Stats grid */}
      <div className="mt-5 bg-[#0d1020] border border-[#1e2240] rounded-xl px-4 py-3">
        <div className="flex justify-between gap-2">
          <StatItem
            icon={<Activity className="w-3 h-3" />}
            value={statTotal.toLocaleString()}
            label="TOTAL SPINS"
          />
          <StatItem
            icon={<CheckCircle2 className="w-3 h-3" />}
            value={statAccuracy}
            label={verifiedTop3Rate != null ? "VERIFIED ACC." : "AVG ACCURACY"}
          />
          <StatItem
            icon={<Target className="w-3 h-3" />}
            value={String(statVerified)}
            label="VERIFIED"
          />
          <StatItem
            icon={<Users className="w-3 h-3" />}
            value={String(recentSpinsCount)}
            label="RECENT"
          />
        </div>
      </div>

      {/* Ranked alternatives */}
      {ranked.length > 1 && signals && !analysing && !loading && (
        <div className="mt-5">
          <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#448AFF]" /> All sectors ranked by live momentum score
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ranked.slice(0, 8).map((r, i) => {
              const isPredicted =
                r.sector === signals.momentum?.sector ||
                r.sector === signals.hotTrend?.sector ||
                r.sector === signals.overdueBonus?.sector;
              return (
                <div
                  key={r.sector}
                  className={`rounded-md px-2 py-1.5 text-center border ${
                    isPredicted
                      ? "bg-[rgba(68,138,255,0.1)] border-[rgba(68,138,255,0.4)]"
                      : "bg-[#0d1020] border-[#1e2240]"
                  }`}
                >
                  <div className="text-[10px] text-[#8899cc]">#{i + 1}</div>
                  <div className="text-[12px] font-semibold text-white">{label(r.sector)}</div>
                  <div className="text-[9px] text-[#5a6a99]">
                    {r.percentage.toFixed(1)}% · {r.score.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status footer */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}
      {signals && !analysing && !loading && (
        <div className="mt-3 text-[10px] text-[#5a6a99] text-center leading-tight">
          <Clock className="w-2.5 h-2.5 inline mr-1" />
          3 predictions generated {relativeTime(signals.momentum?.generatedAt)} from real live data
          (momentum + 24h hot trend + overdue bonus). Auto-refresh every {COUNTDOWN_SECONDS}s.
          {statVerified > 0 && (
            <> {statVerified} predictions verified against actual spins so far.</>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Single signal mini-card (one of the 3 shown simultaneously) ----
function SignalMiniCard({
  strategyKey,
  signal,
  analysing,
  lastActualSector,
}: {
  strategyKey: StrategyKey;
  signal: NextSpinSignal | null;
  analysing: boolean;
  lastActualSector: string | null;
}) {
  const meta = STRATEGY_META[strategyKey];
  const Icon = meta.icon;
  const accent = meta.accent;
  const cardImg = signal?.cardImage;
  const sectorLabel = signal?.sectorLabel;
  const isBonus = signal?.isBonus;
  const confidence = signal?.confidence ?? 0;
  const modelAcc = signal?.modelAccuracy;
  const obs = signal?.observed;
  // Check if this prediction matched the actual last spin
  const wasHit =
    signal?.sector && lastActualSector && signal.sector === lastActualSector;

  return (
    <div
      className={`rounded-2xl bg-[#0d1020] border p-3 flex flex-col items-center text-center relative overflow-hidden transition-all ${
        wasHit ? "border-[#2ed573]" : "border-[#1e2240]"
      }`}
      style={{ borderTop: `2px solid ${wasHit ? "#2ed573" : accent}` }}
    >
      {/* Hit/miss badge */}
      {wasHit && (
        <div className="absolute top-1 right-1 bg-[#2ed573] text-[#0a0b14] text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
          <CheckCircle2 className="w-2 h-2" /> HIT
        </div>
      )}
      {/* Strategy header */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <Icon className="w-3 h-3" style={{ color: accent }} />
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {meta.title}
        </span>
      </div>
      <div className="text-[8px] text-[#8899cc] mb-2">{meta.subtitle}</div>

      {/* Sector image + name */}
      {analysing ? (
        <div className="w-full h-[90px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[rgba(68,138,255,0.2)] border-t-[#448AFF] rounded-full animate-spin" />
        </div>
      ) : cardImg ? (
        <img
          src={cardImg}
          alt={sectorLabel ?? "signal"}
          className="w-[140px] h-[70px] object-contain transition-all"
          style={{ animation: "blink 1.6s ease-in-out infinite" }}
        />
      ) : (
        <div className="w-[140px] h-[70px] flex items-center justify-center text-[#5a6a99] text-[10px]">
          —
        </div>
      )}

      <div
        className="text-base font-extrabold mt-1"
        style={{
          color: isBonus ? "#FFD700" : accent,
          textShadow: isBonus
            ? "0 0 10px rgba(255,215,0,0.3)"
            : `0 0 10px ${accent}40`,
        }}
      >
        {sectorLabel ?? "—"}
      </div>

      {isBonus && (
        <Badge className="mt-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8px] py-0 px-1.5 gap-0.5">
          <Sparkles className="w-2 h-2" /> BONUS
        </Badge>
      )}

      {/* Confidence bar */}
      <div className="w-full mt-3">
        <div className="flex items-center justify-between text-[9px] text-[#8899cc] mb-1">
          <span className="flex items-center gap-0.5">
            <TrendingUp className="w-2.5 h-2.5" style={{ color: accent }} />
            Confidence
          </span>
          <span className="font-bold text-white">{confidence}%</span>
        </div>
        <div className="w-full h-[4px] bg-[#141827] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${confidence}%`,
              background: `linear-gradient(90deg, ${accent}, #2962FF)`,
            }}
          />
        </div>
      </div>

      {/* Real observed data */}
      {signal && (
        <div className="w-full mt-2 space-y-0.5">
          {strategyKey === "momentum" && obs?.recentHits != null && (
            <div className="text-[9px] text-[#bcc6e0] leading-tight">
              {obs.recentHits}/{obs.recentWindow} recent ({obs.recentPercentage}%)
              {obs.momentumDelta != null && (
                <span
                  className={
                    obs.momentumDelta >= 0 ? "text-[#2ed573]" : "text-[#ff4757]"
                  }
                >
                  {" "}
                  {obs.momentumDelta >= 0 ? "+" : ""}
                  {obs.momentumDelta}%
                </span>
              )}
            </div>
          )}
          {strategyKey === "hotTrend" && signal.observedHotFrequencyPercentage != null && (
            <div className="text-[9px] text-[#bcc6e0] leading-tight">
              {signal.observedHotFrequencyPercentage >= 0 ? "+" : ""}
              {signal.observedHotFrequencyPercentage.toFixed(2)}% vs avg
            </div>
          )}
          {strategyKey === "overdueBonus" && signal.observedLastSeenBefore != null && (
            <div className="text-[9px] text-[#bcc6e0] leading-tight">
              Last {signal.observedLastSeenBefore} spins ago
            </div>
          )}
          <div className="text-[9px] text-[#5a6a99]">
            24h: {signal.observedPercentage.toFixed(1)}% ({signal.observedCount})
          </div>
          {modelAcc != null && (
            <div className="text-[8px] text-[#5a6a99]">
              backtest: {modelAcc.toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="text-center flex-1">
      <div className="flex items-center justify-center gap-1 text-[18px] font-extrabold text-[#448AFF] mb-1">
        {icon}
        {value}
      </div>
      <div className="text-[9px] text-[#8899cc] uppercase tracking-[1px]">{label}</div>
    </div>
  );
}
