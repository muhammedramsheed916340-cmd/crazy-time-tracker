"use client";

import { useMemo } from "react";
import { LiveVideoPlayer } from "@/components/crazytime/LiveVideoPlayer";
import { SpinHistory } from "@/components/crazytime/SpinHistory";
import { CrazyTimeStatistics } from "@/components/crazytime/CrazyTimeStatistics";
import { TopSlotMatched } from "@/components/crazytime/TopSlotMatched";
import { CrazyBonusFlapper } from "@/components/crazytime/CrazyBonusFlapper";
import { LatestTopMultipliers } from "@/components/crazytime/LatestTopMultipliers";
import { Prediction } from "@/components/crazytime/Prediction";
import { LiveStatusBar } from "@/components/crazytime/LiveStatusBar";
import { useCrazyTimeEvents, useCrazyTimeStats } from "@/hooks/use-crazy-time";
import { RefreshCw, Radio } from "lucide-react";

export default function Home() {
  // Live spin history - refresh every 15s
  const events = useCrazyTimeEvents(20, 24, 15000);
  // Live statistics + derived prediction - refresh every 30s
  const stats = useCrazyTimeStats(24, 30000);

  const latestSettledAt = useMemo(() => {
    return events.spins[0]?.settledAt ?? null;
  }, [events.spins]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-amber-600 via-rose-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                Crazy Time Live Tracker
              </h1>
              <p className="text-[10px] sm:text-[11px] text-white/80 leading-tight truncate">
                Real-time Evolution Gaming Crazy Time · Live spins, stats &amp; predictions
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              events.refresh();
              stats.refresh();
            }}
            className="flex items-center gap-1 text-[11px] sm:text-xs bg-white/15 hover:bg-white/25 transition px-2.5 py-1.5 rounded-md backdrop-blur flex-shrink-0"
            aria-label="Refresh all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${events.loading || stats.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-6">
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

        {/* Video + Spin history row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

      {/* Footer */}
      <footer className="mt-auto bg-zinc-900 dark:bg-black text-zinc-300 dark:text-zinc-400 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 text-center text-[11px] sm:text-xs space-y-1">
          <p>
            Real-time data source:{" "}
            <span className="font-mono text-zinc-200">
              api-cs.casino.org/svc-evolution-game-events/api/crazytime
            </span>
          </p>
          <p className="text-zinc-500">
            Live video: Evolution Gaming Crazy Time feed (HLS). Auto-reconnects when the stream
            temporarily fails. 100% real live data — no mock, demo or hardcoded values.
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
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          Coin Flip Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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
                  className="flex items-center gap-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2"
                >
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{r.symbol}</span>
                      <span className="font-bold text-amber-600 text-sm">
                        {r.avgMultiplier.toFixed(2)}× avg
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{r.count.toLocaleString()} flips · {r.percentage.toFixed(1)}%</span>
                      <span>
                        LTA mult: {r.coinFlipMultiplierLongTermAverage != null ? r.coinFlipMultiplierLongTermAverage.toFixed(2) + "×" : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-zinc-400 text-right">
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
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-500" />
          Cash Hunt Symbol Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="Waiting for Cash Hunt symbol statistics…" />
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, idx) => (
              <div
                key={r.symbol}
                className="flex items-center gap-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1.5"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Symbol {r.symbol}</span>
                    <span className="text-xs font-bold text-amber-600">
                      {r.avgMultiplier.toFixed(2)}×
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{r.count.toLocaleString()} picks</span>
                    <span>
                      LTA: {r.cashHuntLongTermAverage != null ? r.cashHuntLongTermAverage.toFixed(2) + "×" : "—"}
                    </span>
                  </div>
                </div>
                <div className="w-12 text-right">
                  {idx === 0 && (
                    <span className="text-[9px] text-emerald-600 font-bold">BEST</span>
                  )}
                </div>
              </div>
            ))}
            <div className="text-[10px] text-zinc-400 text-right">
              Updated {relativeTime(lastUpdated)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
