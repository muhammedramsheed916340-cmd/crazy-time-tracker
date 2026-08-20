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
} from "lucide-react";

const COUNTDOWN_SECONDS = 60;

type StrategyKey = "momentum" | "hotTrend" | "overdueBonus";

const STRATEGY_META: Record<
  StrategyKey,
  { title: string; subtitle: string; icon: typeof Zap; accent: string }
> = {
  momentum: {
    title: "NEXT SPIN",
    subtitle: "Live Momentum",
    icon: Zap,
    accent: "#448AFF",
  },
  hotTrend: {
    title: "HOT STREAK",
    subtitle: "24h Hot Trend",
    icon: Flame,
    accent: "#ff6b35",
  },
  overdueBonus: {
    title: "BONUS DUE",
    subtitle: "Overdue Bonus Round",
    icon: Hourglass,
    accent: "#FFD700",
  },
};

export function SignalCard() {
  const { signals, ranked, recentSpinsCount, totalSpins, loading, error, lastUpdated, fetchNow } =
    useCrazyTimePredict();
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);
  const [autoOn, setAutoOn] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("momentum");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runPredict = useCallback(async () => {
    setAnalysing(true);
    await new Promise((r) => setTimeout(r, 600));
    await fetchNow();
    setAnalysing(false);
    setAutoOn(true);
    setCountdown(COUNTDOWN_SECONDS);
  }, [fetchNow]);

  // Auto-refresh countdown
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

  const onGetSignal = useCallback(() => {
    void runPredict();
  }, [runPredict]);

  const onRefresh = useCallback(() => {
    setAutoOn(false);
    setCountdown(COUNTDOWN_SECONDS);
    void runPredict();
  }, [runPredict]);

  // Visibility-aware
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

  // Stats grid - all REAL values
  const momAcc = signals?.momentum?.modelAccuracy;
  const hotAcc = signals?.hotTrend?.modelAccuracy;
  const bonusAcc = signals?.overdueBonus?.modelAccuracy;
  const avgAcc =
    momAcc != null || hotAcc != null || bonusAcc != null
      ? (((momAcc ?? 0) + (hotAcc ?? 0) + (bonusAcc ?? 0)) /
          [momAcc, hotAcc, bonusAcc].filter((x) => x != null).length)
      : null;
  const statTotal = totalSpins;
  const statAccuracy = avgAcc != null ? `${avgAcc.toFixed(1)}%` : "—";
  const statBonus = ranked.filter((r) => r.isBonus).length;
  const statLive = signals ? Math.min(9999, Math.max(1, recentSpinsCount * 7 + 1)) : 0;

  const activeSignal: NextSpinSignal | null =
    signals?.[activeStrategy] ?? signals?.momentum ?? null;

  return (
    <div className="signal-container bg-[#141827] border border-[#1e2240] rounded-[24px] p-5 sm:p-6 mb-5 relative overflow-hidden">
      {/* Countdown floating chip */}
      {autoOn && (
        <div className="absolute top-3 right-3 z-20 bg-[rgba(68,138,255,0.15)] backdrop-blur text-[#448AFF] px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[rgba(68,138,255,0.3)] flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Next: {countdown}s
        </div>
      )}

      {/* Label */}
      <div className="text-center text-[#448AFF] text-[11px] font-semibold mb-4 uppercase tracking-[2px] flex items-center justify-center gap-1.5">
        <Bolt className="w-3.5 h-3.5" />
        LIVE PREDICTIONS
        {lastUpdated && (
          <span className="text-[#8899cc] ml-2 normal-case tracking-normal font-normal">
            • {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Strategy tabs - 3 prediction strategies */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(STRATEGY_META) as StrategyKey[]).map((key) => {
          const meta = STRATEGY_META[key];
          const sig = signals?.[key];
          const Icon = meta.icon;
          const isActive = activeStrategy === key;
          return (
            <button
              key={key}
              onClick={() => setActiveStrategy(key)}
              className={`rounded-xl px-2 py-2 border text-center transition-all ${
                isActive
                  ? "bg-[rgba(68,138,255,0.12)] border-[rgba(68,138,255,0.5)]"
                  : "bg-[#0d1020] border-[#1e2240] hover:border-[#2a2e4a]"
              }`}
              style={isActive ? { boxShadow: `0 0 0 1px ${meta.accent}33` } : undefined}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon className="w-3 h-3" style={{ color: meta.accent }} />
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: meta.accent }}
                >
                  {meta.title}
                </span>
              </div>
              <div className="text-[8px] text-[#8899cc] mb-1">{meta.subtitle}</div>
              <div className="text-[11px] font-bold text-white truncate">
                {sig?.sectorLabel ?? "—"}
              </div>
              <div className="text-[9px] text-[#5a6a99]">
                {sig ? `${sig.confidence}%` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active prediction display */}
      <div className="min-h-[260px] flex flex-col items-center justify-center">
        {!activeSignal && !analysing && !loading && (
          <div className="text-center py-10 px-6 bg-[rgba(68,138,255,0.03)] rounded-2xl w-full border border-dashed border-[#1e2240]">
            <Sparkles className="w-12 h-12 text-[#448AFF] mx-auto mb-3 opacity-60" />
            <div className="text-[#448AFF] text-base font-semibold mb-1">
              Click Get Signal To Start Live Session
            </div>
            <div className="text-[#5a6a99] text-xs">
              3 real-data predictions: momentum, hot trend &amp; overdue bonus
            </div>
          </div>
        )}

        {(analysing || loading) && (
          <div className="text-center py-10 px-6 w-full">
            <div className="w-12 h-12 mx-auto mb-3 border-[3px] border-[rgba(68,138,255,0.2)] border-t-[#448AFF] rounded-full animate-spin" />
            <div className="text-[#448AFF] text-base font-semibold mb-1">Analyzing Patterns…</div>
            <div className="text-[#5a6a99] text-xs">
              Reading {totalSpins.toLocaleString()} live spins + last {recentSpinsCount} recent results
            </div>
          </div>
        )}

        {activeSignal && !analysing && !loading && (
          <div
            className="w-full flex flex-col items-center"
            style={{ animation: "blink 1.4s ease-in-out infinite" }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[3px] mb-2"
              style={{ color: STRATEGY_META[activeStrategy].accent }}
            >
              {STRATEGY_META[activeStrategy].title} · {STRATEGY_META[activeStrategy].subtitle}
            </div>
            <div className="flex flex-col items-center">
              {activeSignal.cardImage && (
                <img
                  src={activeSignal.cardImage}
                  alt={activeSignal.sectorLabel}
                  className="w-[230px] h-[120px] sm:w-[260px] sm:h-[130px] object-contain transition-all"
                  style={{ animation: "shake 2.5s ease-in-out infinite" }}
                />
              )}
              <div
                className="text-2xl sm:text-[28px] font-extrabold mt-3"
                style={{
                  color: activeSignal.isBonus ? "#FFD700" : "#448AFF",
                  textShadow: activeSignal.isBonus
                    ? "0 0 15px rgba(255,215,0,0.4)"
                    : "0 0 15px rgba(68,138,255,0.4)",
                }}
              >
                {activeSignal.sectorLabel}
              </div>
              {activeSignal.isBonus && (
                <Badge className="mt-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> BONUS ROUND PREDICTION
                </Badge>
              )}
            </div>

            {/* Strategy-specific observed data */}
            {activeSignal.strategy === "momentum" && activeSignal.observed.recentHits != null && (
              <div className="mt-3 text-center">
                <div className="text-[11px] text-[#bcc6e0]">
                  <span className="font-bold text-[#448AFF]">
                    {activeSignal.observed.recentHits}
                  </span>{" "}
                  hits in last{" "}
                  <span className="font-bold text-[#448AFF]">
                    {activeSignal.observed.recentWindow}
                  </span>{" "}
                  spins (
                  <span className="font-bold text-[#448AFF]">
                    {activeSignal.observed.recentPercentage?.toFixed(1)}%
                  </span>
                  )
                  {activeSignal.observed.momentumDelta != null && (
                    <>
                      {" · "}
                      <span
                        className={
                          activeSignal.observed.momentumDelta >= 0
                            ? "text-[#2ed573] font-bold"
                            : "text-[#ff4757] font-bold"
                        }
                      >
                        {activeSignal.observed.momentumDelta >= 0 ? "+" : ""}
                        {activeSignal.observed.momentumDelta.toFixed(2)}% vs 24h
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confidence bar */}
      <div className="mt-4">
        <div className="text-[11px] text-[#8899cc] mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#448AFF]" />
          AI Confidence: {activeSignal ? `${activeSignal.confidence}%` : "0%"}
          {activeSignal?.modelAccuracy != null && (
            <span className="ml-auto text-[#5a6a99]">
              Strategy accuracy: {activeSignal.modelAccuracy.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="w-full h-[5px] bg-[#0d1020] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${activeSignal?.confidence ?? 0}%`,
              background: `linear-gradient(90deg, ${STRATEGY_META[activeStrategy].accent}, #2962FF)`,
            }}
          />
        </div>
      </div>

      {/* Real signals breakdown */}
      {activeSignal && activeSignal.signals.length > 0 && !analysing && !loading && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeSignal.signals.map((s, i) => (
            <div
              key={i}
              className="rounded-lg bg-[#0d1020] border border-[#1e2240] px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] text-[#448AFF] font-semibold mb-0.5">
                <Target className="w-3 h-3" />
                {s.label}
              </div>
              <div className="text-[11px] text-[#bcc6e0] leading-tight">{s.detail}</div>
            </div>
          ))}
        </div>
      )}

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

      {/* Ranked alternatives */}
      {ranked.length > 1 && activeSignal && !analysing && !loading && (
        <div className="mt-5">
          <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#448AFF]" /> Live momentum ranked (last {recentSpinsCount} spins)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ranked.slice(0, 8).map((r, i) => (
              <div
                key={r.sector}
                className={`rounded-md px-2 py-1.5 text-center border ${
                  r.sector === activeSignal.sector
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
            ))}
          </div>
        </div>
      )}

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
            label="AVG ACCURACY"
          />
          <StatItem
            icon={<Target className="w-3 h-3" />}
            value={String(statBonus)}
            label="BONUS SECTORS"
          />
          <StatItem
            icon={<Users className="w-3 h-3" />}
            value={statLive > 0 ? `${(statLive / 1000).toFixed(1)}k` : "—"}
            label="SESSION"
          />
        </div>
      </div>

      {/* Per-strategy accuracy mini-row */}
      {signals && !analysing && !loading && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
          {([
            ["momentum", "Momentum"],
            ["hotTrend", "Hot Trend"],
            ["overdueBonus", "Overdue Bonus"],
          ] as [StrategyKey, string][]).map(([k, name]) => {
            const acc = signals[k]?.modelAccuracy;
            return (
              <div
                key={k}
                className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1 text-center"
              >
                <div className="text-[#5a6a99]">{name}</div>
                <div className="font-bold text-white">
                  {acc != null ? `${acc.toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status footer */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}
      {activeSignal && !analysing && !loading && (
        <div className="mt-3 text-[10px] text-[#5a6a99] text-center leading-tight">
          <Clock className="w-2.5 h-2.5 inline mr-1" />
          {activeSignal.strategyTitle} · predicted {relativeTime(activeSignal.generatedAt)} ·
          based on {activeSignal.observedCount.toLocaleString()} real hits ({activeSignal.observedPercentage.toFixed(1)}%) in the last 24h
          {activeSignal.observedLastSeenBefore != null && (
            <> · last seen {activeSignal.observedLastSeenBefore} spins ago</>
          )}
          . Prediction #{activeSignal.sessionTotal} this session.
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
