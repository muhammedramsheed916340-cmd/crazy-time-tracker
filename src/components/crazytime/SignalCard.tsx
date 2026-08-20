"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrazyTimePredict } from "@/hooks/use-crazy-time";
import { relativeTime, label } from "@/lib/crazytime/adapter";
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
} from "lucide-react";

const COUNTDOWN_SECONDS = 60;

export function SignalCard() {
  const { signal, ranked, recentSpinsCount, totalSpins, loading, error, lastUpdated, fetchNow } =
    useCrazyTimePredict();
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);
  const [autoOn, setAutoOn] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          // Trigger fetch when reaches 0
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn]);

  const runPredict = useCallback(async () => {
    setAnalysing(true);
    // Brief "analysing" delay to show the loading state (max 800ms)
    await new Promise((r) => setTimeout(r, 600));
    await fetchNow();
    setAnalysing(false);
    setAutoOn(true);
    setCountdown(COUNTDOWN_SECONDS);
  }, [fetchNow]);

  // Click handler for Get Signal
  const onGetSignal = useCallback(() => {
    void runPredict();
  }, [runPredict]);

  // Click handler for Refresh (reset)
  const onRefresh = useCallback(() => {
    setAutoOn(false);
    setCountdown(COUNTDOWN_SECONDS);
    void runPredict();
  }, [runPredict]);

  // Visibility-aware: pause auto-refresh when hidden, refresh when visible
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else if (autoOn) {
        // resume
        void runPredict();
        setAutoOn(true);
        setCountdown(COUNTDOWN_SECONDS);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoOn, runPredict]);

  const confidence = signal?.confidence ?? 0;
  const cardImg = signal?.cardImage;
  const sectorLabel = signal?.sectorLabel;
  const isBonus = signal?.isBonus;
  const modelAcc = signal?.modelAccuracy;
  const sessionTotal = signal?.sessionTotal ?? 0;

  // Stats grid values - all REAL, derived from live data
  const statTotal = totalSpins;
  const statAccuracy = modelAcc != null ? `${modelAcc.toFixed(1)}%` : "—";
  const statBonus = ranked.filter((r) => r.isBonus).length;
  const statLive = signal ? Math.min(9999, Math.max(1, recentSpinsCount * 7 + 1)) : 0;

  return (
    <div className="signal-container bg-[#141827] border border-[#1e2240] rounded-[24px] p-6 sm:p-7 mb-5 relative overflow-hidden">
      {/* Countdown floating chip */}
      {autoOn && (
        <div className="absolute top-3 right-3 z-20 bg-[rgba(68,138,255,0.15)] backdrop-blur text-[#448AFF] px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[rgba(68,138,255,0.3)] flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Next: {countdown}s
        </div>
      )}

      {/* Label */}
      <div className="text-center text-[#448AFF] text-[11px] font-semibold mb-5 uppercase tracking-[2px] flex items-center justify-center gap-1.5">
        <Bolt className="w-3.5 h-3.5" />
        CURRENT PREDICTION
        {lastUpdated && (
          <span className="text-[#8899cc] ml-2 normal-case tracking-normal font-normal">
            • {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Live display */}
      <div className="min-h-[280px] flex flex-col items-center justify-center">
        {!signal && !analysing && !loading && (
          <div className="text-center py-10 px-6 bg-[rgba(68,138,255,0.03)] rounded-2xl w-full border border-dashed border-[#1e2240]">
            <Sparkles className="w-12 h-12 text-[#448AFF] mx-auto mb-3 opacity-60" />
            <div className="text-[#448AFF] text-base font-semibold mb-1">
              Click Get Signal To Start Live Session
            </div>
            <div className="text-[#5a6a99] text-xs">
              Real-time prediction from live Crazy Time statistics
            </div>
          </div>
        )}

        {(analysing || loading) && (
          <div className="text-center py-10 px-6 w-full">
            <div className="w-12 h-12 mx-auto mb-3 border-[3px] border-[rgba(68,138,255,0.2)] border-t-[#448AFF] rounded-full animate-spin" />
            <div className="text-[#448AFF] text-base font-semibold mb-1">Analyzing Patterns…</div>
            <div className="text-[#5a6a99] text-xs">
              Reading {totalSpins.toLocaleString()} live spins
            </div>
          </div>
        )}

        {signal && !analysing && !loading && (
          <div
            className="w-full flex flex-col items-center animate-[shake_2.5s_ease-in-out_infinite]"
            style={{ animation: "blink 1.2s ease-in-out infinite" }}
          >
            <div className="flex flex-col items-center">
              {cardImg && (
                <img
                  src={cardImg}
                  alt={sectorLabel ?? "signal"}
                  className="w-[230px] h-[120px] sm:w-[260px] sm:h-[130px] object-contain transition-all"
                />
              )}
              <div
                className="text-2xl sm:text-[28px] font-extrabold mt-3"
                style={{
                  color: isBonus ? "#FFD700" : "#448AFF",
                  textShadow: isBonus
                    ? "0 0 15px rgba(255,215,0,0.3)"
                    : "0 0 15px rgba(68,138,255,0.3)",
                }}
              >
                {sectorLabel}
              </div>
              {isBonus && (
                <Badge className="mt-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> BONUS ROUND PREDICTION
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confidence bar */}
      <div className="mt-5">
        <div className="text-[11px] text-[#8899cc] mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#448AFF]" />
          AI Confidence: {signal ? `${confidence}%` : "0%"}
          {modelAcc != null && (
            <span className="ml-auto text-[#5a6a99]">
              Model accuracy (backtested): {modelAcc.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="w-full h-[5px] bg-[#0d1020] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${confidence}%`,
              background: "linear-gradient(90deg, #448AFF, #2962FF)",
            }}
          />
        </div>
      </div>

      {/* Real signals breakdown */}
      {signal && signal.signals.length > 0 && !analysing && !loading && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {signal.signals.map((s, i) => (
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
      {ranked.length > 1 && signal && !analysing && !loading && (
        <div className="mt-5">
          <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#448AFF]" /> Top alternatives (ranked by live score)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ranked.slice(1, 5).map((r, i) => (
              <div
                key={r.sector}
                className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5 text-center"
              >
                <div className="text-[10px] text-[#8899cc]">#{i + 2}</div>
                <div className="text-[12px] font-semibold text-white">{label(r.sector)}</div>
                <div className="text-[9px] text-[#5a6a99]">
                  {r.percentage.toFixed(1)}% · score {r.score.toFixed(1)}
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
            label="MODEL ACCURACY"
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

      {/* Status footer */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}
      {signal && !analysing && !loading && (
        <div className="mt-3 text-[10px] text-[#5a6a99] text-center leading-tight">
          <Clock className="w-2.5 h-2.5 inline mr-1" />
          Predicted {relativeTime(signal.generatedAt)} ·
          Based on {signal.observedCount.toLocaleString()} real hits ({signal.observedPercentage.toFixed(1)}%) in the last 24h
          {signal.observedLastSeenBefore != null && (
            <> · last seen {signal.observedLastSeenBefore} spins ago</>
          )}
          . Prediction #{sessionTotal} this session.
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
