"use client";

import { useMemo, useState } from "react";
import { LiveVideoPlayer } from "@/components/crazytime/LiveVideoPlayer";
import { SpinHistory } from "@/components/crazytime/SpinHistory";
import { CrazyTimeStatistics } from "@/components/crazytime/CrazyTimeStatistics";
import { TopSlotMatched } from "@/components/crazytime/TopSlotMatched";
import { CrazyBonusFlapper } from "@/components/crazytime/CrazyBonusFlapper";
import { LatestTopMultipliers } from "@/components/crazytime/LatestTopMultipliers";
import { Prediction } from "@/components/crazytime/Prediction";
import { LiveStatusBar } from "@/components/crazytime/LiveStatusBar";
import { SignalCard } from "@/components/crazytime/SignalCard";
import { AccuracyTracker } from "@/components/crazytime/AccuracyTracker";
import { BonusCenter } from "@/components/crazytime/BonusCenter";
import { useCrazyTimeEvents, useCrazyTimeStats, useCrazyTimePredict } from "@/hooks/use-crazy-time";
import { RefreshCw, Radio, Sparkles, Gift } from "lucide-react";

export default function Home() {
  // Live spin history - refresh every 8s (was 15s) for faster updates
  const events = useCrazyTimeEvents(20, 24, 8000);
  // Live statistics + derived prediction - refresh every 15s (was 30s)
  const stats = useCrazyTimeStats(24, 15000);
  // Live prediction (on-demand, used for the accuracy tracker too)
  const predict = useCrazyTimePredict();
  // Bonus Center popup state
  const [bonusOpen, setBonusOpen] = useState(false);

  const latestSettledAt = useMemo(() => {
    return events.spins[0]?.settledAt ?? null;
  }, [events.spins]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0b14] text-white">
      {/* Header - matching Revo Fixer reference */}
      <header className="bg-[#141827] border-b border-[#1e2240] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[rgba(68,138,255,0.1)] border border-[rgba(68,138,255,0.2)] flex items-center justify-center flex-shrink-0">
              <Radio className="w-4 h-4 text-[#448AFF] animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold leading-tight truncate">
                <span className="text-[#448AFF]">CRAZY TIME</span> LIVE
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#8899cc] leading-tight truncate">
                Real-time Evolution Gaming · Live spins, stats &amp; AI predictions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setBonusOpen(true)}
              className="flex items-center gap-1 text-[11px] sm:text-xs bg-[rgba(255,215,0,0.1)] hover:bg-[rgba(255,215,0,0.2)] border border-[rgba(255,215,0,0.3)] text-[#FFD700] transition px-2.5 py-1.5 rounded-md"
              aria-label="Bonus Intelligence Center"
            >
              <Gift className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bonus Center</span>
            </button>
            <button
              onClick={() => {
                events.refresh();
                stats.refresh();
              }}
              className="flex items-center gap-1 text-[11px] sm:text-xs bg-[rgba(68,138,255,0.1)] hover:bg-[rgba(68,138,255,0.2)] border border-[rgba(68,138,255,0.2)] text-[#448AFF] transition px-2.5 py-1.5 rounded-md"
              aria-label="Refresh all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${events.loading || stats.loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Hero / Live status */}
        <div className="max-w-3xl mx-auto w-full">
          <div className="text-center bg-[#141827] border border-[#1e2240] rounded-2xl px-4 py-3 mb-3">
            <h1 className="text-base sm:text-xl font-extrabold">
              <span className="text-[#448AFF]">CRAZY TIME</span> AI PREDICTOR
            </h1>
            <p className="text-[11px] text-[#8899cc] mt-1">
              Live predictions from real Evolution Gaming Crazy Time data
            </p>
          </div>
          <LiveStatusBar
            loading={events.loading || stats.loading}
            error={events.error || stats.error}
            lastUpdated={events.lastUpdated ?? stats.lastUpdated}
            onRefresh={() => {
              events.refresh();
              stats.refresh();
            }}
            latestSettledAt={latestSettledAt}
            spinsCount={events.spins.length}
            totalCount={events.totalCount}
          />
        </div>

        {/* Hero Signal Card (Revo Fixer style) + Accuracy Tracker */}
        <div className="max-w-3xl mx-auto w-full grid grid-cols-1 gap-4 sm:gap-6">
          <SignalCard
            signals={predict.signals}
            ranked={predict.ranked}
            accuracy={predict.accuracy}
            lastActualSpin={predict.lastActualSpin}
            recentSpinsCount={predict.recentSpinsCount}
            totalSpins={predict.totalSpins}
            loading={predict.loading}
            error={predict.error}
            lastUpdated={predict.lastUpdated}
            fetchNow={predict.fetchNow}
          />
          <AccuracyTracker
            accuracy={predict.accuracy}
            loading={predict.loading}
            error={predict.error}
            databaseStatus={predict.databaseStatus}
            accuracyStatus={predict.accuracyStatus}
          />
        </div>

        {/* Video + Spin history row */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <LiveVideoPlayer />
          </div>
          <div className="lg:col-span-1">
            <SpinHistory
              spins={events.spins}
              loading={events.loading}
              error={events.error}
              totalCount={events.totalCount}
              lastUpdated={events.lastUpdated}
              onRefresh={events.refresh}
            />
          </div>
        </div>

        {/* Stats + Top slot + Flapper row */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <CrazyTimeStatistics
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
          <TopSlotMatched
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
          <CrazyBonusFlapper
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
        </div>

        {/* Multipliers + Prediction row */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <LatestTopMultipliers
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
          <Prediction
            prediction={stats.prediction}
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
        </div>

        {/* Coin flip + Cash hunt extra stats */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <CoinFlipStats
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
          <CashHuntStats
            stats={stats.stats}
            loading={stats.loading}
            error={stats.error}
            lastUpdated={stats.lastUpdated}
          />
        </div>
      </main>

      {/* Bonus Intelligence Center Popup */}
      <BonusCenter open={bonusOpen} onOpenChange={setBonusOpen} />

      {/* Footer */}
      <footer className="mt-auto bg-[#0d1020] border-t border-[#1e2240] text-[#8899cc]">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 text-center text-[11px] sm:text-xs space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-[#448AFF]" />
            Real-time data source:{" "}
            <span className="font-mono text-[#bcc6e0]">
              api-cs.casino.org/svc-evolution-game-events/api/crazytime
            </span>
          </p>
          <p className="text-[#5a6a99]">
            Live video: Evolution Gaming Crazy Time feed (HLS via proxy). Auto-reconnects when the
            stream temporarily fails. 100% real live data — no mock, demo or hardcoded values.
          </p>
          <p className="text-[10px] text-[#5a6a99] pt-1">
            Predictions are derived purely from live statistics (frequency, hot/cold trend, overdue
            signal, top-slot match rate, flapper &amp; cash hunt averages). Backtested model accuracy
            shown is the real hit rate of the top-3 predicted sectors against recent actual spins.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Inline small components for coin flip & cash hunt to keep file count manageable
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionError } from "@/components/crazytime/EmptyState";
import { relativeTime } from "@/lib/crazytime/adapter";
import type { NormalizedStats } from "@/lib/crazytime/types";
import { Coins, Search } from "lucide-react";

function CoinFlipStats({
  stats,
  loading,
  error,
  lastUpdated,
}: {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}) {
  const rows = stats?.coinFlipStats ?? [];
  return (
    <Card className="bg-[#141827] border-[#1e2240] text-white h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
          <Coins className="w-4 h-4 text-[#FFD700]" />
          Coin Flip Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full bg-[#1e2240]" />
            <Skeleton className="h-16 w-full bg-[#1e2240]" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="Waiting for Coin Flip bonus statistics…" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const color = r.symbol === "Blue" ? "#3b82f6" : r.symbol === "Red" ? "#ef4444" : "#6b7280";
              return (
                <div
                  key={r.symbol}
                  className="flex items-center gap-3 rounded-md bg-[#0d1020] px-2 py-2"
                >
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{r.symbol}</span>
                      <span className="font-bold text-[#FFD700] text-sm">
                        {r.avgMultiplier.toFixed(2)}× avg
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#8899cc]">
                      <span>{r.count.toLocaleString()} flips · {r.percentage.toFixed(1)}%</span>
                      <span>
                        LTA mult: {r.coinFlipMultiplierLongTermAverage != null ? r.coinFlipMultiplierLongTermAverage.toFixed(2) + "×" : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-[#5a6a99] text-right">
              Updated {relativeTime(lastUpdated)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CashHuntStats({
  stats,
  loading,
  error,
  lastUpdated,
}: {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}) {
  const rows = (stats?.cashHuntSymbolStats ?? []).slice().sort((a, b) => b.avgMultiplier - a.avgMultiplier);
  return (
    <Card className="bg-[#141827] border-[#1e2240] text-white h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
          <Search className="w-4 h-4 text-[#2ed573]" />
          Cash Hunt Symbol Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-[#1e2240]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="Waiting for Cash Hunt symbol statistics…" />
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, idx) => (
              <div
                key={r.symbol}
                className="flex items-center gap-2 rounded-md bg-[#0d1020] px-2 py-1.5"
              >
                <div className="w-7 h-7 rounded-md bg-[#2ed573] text-[#0a0b14] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Symbol {r.symbol}</span>
                    <span className="text-xs font-bold text-[#FFD700]">
                      {r.avgMultiplier.toFixed(2)}×
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#8899cc]">
                    <span>{r.count.toLocaleString()} picks</span>
                    <span>
                      LTA: {r.cashHuntLongTermAverage != null ? r.cashHuntLongTermAverage.toFixed(2) + "×" : "—"}
                    </span>
                  </div>
                </div>
                <div className="w-12 text-right">
                  {idx === 0 && (
                    <span className="text-[9px] text-[#2ed573] font-bold">BEST</span>
                  )}
                </div>
              </div>
            ))}
            <div className="text-[10px] text-[#5a6a99] text-right">
              Updated {relativeTime(lastUpdated)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
