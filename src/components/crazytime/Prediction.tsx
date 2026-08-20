"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionError } from "./EmptyState";
import { label, relativeTime } from "@/lib/crazytime/adapter";
import type { NormalizedPrediction, NormalizedStats } from "@/lib/crazytime/types";
import { Brain, Flame, Snowflake, Clock, Crosshair, Wind, Search } from "lucide-react";

interface Props {
  prediction: NormalizedPrediction | null;
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function Prediction({ prediction, stats, loading, error, lastUpdated }: Props) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-500" />
          Prediction Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !prediction ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !prediction ? (
          <EmptyState message="Building prediction model from live stats…" />
        ) : (
          <div className="space-y-3">
            {/* Hot / Cold */}
            <div className="grid grid-cols-2 gap-2">
              <PredictionTile
                title="Hot Sectors"
                icon={<Flame className="w-3.5 h-3.5 text-red-500" />}
                items={prediction.hotSectors.map((h) => ({
                  label: label(h.sector),
                  value: `+${h.hotFrequencyPercentage.toFixed(1)}%`,
                  tone: "hot" as const,
                }))}
                empty="No hot sectors right now"
              />
              <PredictionTile
                title="Cold Sectors"
                icon={<Snowflake className="w-3.5 h-3.5 text-sky-500" />}
                items={prediction.coldSectors.map((h) => ({
                  label: label(h.sector),
                  value: `${h.hotFrequencyPercentage.toFixed(1)}%`,
                  tone: "cold" as const,
                }))}
                empty="No cold sectors right now"
              />
            </div>

            {/* Overdue */}
            <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Overdue (longest skip)
                </span>
              </div>
              {prediction.overdueSectors.length === 0 ? (
                <p className="text-[11px] text-zinc-400">No overdue data yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {prediction.overdueSectors.map((o) => (
                    <Badge
                      key={o.sector}
                      variant="outline"
                      className="text-[10px] border-amber-400 text-amber-600"
                    >
                      {label(o.sector)} · skip {o.lastSeenBefore}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Top slot matched */}
            <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Crosshair className="w-3.5 h-3.5 text-fuchsia-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Top Slot Match Probability
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {prediction.topSlotMatchedPercentage != null
                    ? `${prediction.topSlotMatchedPercentage.toFixed(2)}%`
                    : "—"}
                </div>
                <div className="text-[10px] text-zinc-400">
                  Long-term avg:{" "}
                  {prediction.topSlotMatchedLongTermAverage != null
                    ? `${prediction.topSlotMatchedLongTermAverage.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Coin flip split */}
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Coin Flip Blue"
                value={
                  prediction.coinFlipBluePercentage != null
                    ? `${prediction.coinFlipBluePercentage.toFixed(1)}%`
                    : "—"
                }
                color="bg-blue-500"
              />
              <MiniStat
                label="Coin Flip Red"
                value={
                  prediction.coinFlipRedPercentage != null
                    ? `${prediction.coinFlipRedPercentage.toFixed(1)}%`
                    : "—"
                }
                color="bg-red-500"
              />
            </div>

            {/* Best flapper & cash hunt */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wind className="w-3.5 h-3.5 text-sky-500" />
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                    Best Flapper
                  </span>
                </div>
                {prediction.bestFlapper ? (
                  <div className="text-xs">
                    <span className="font-semibold">{prediction.bestFlapper.symbol}</span>{" "}
                    <span className="text-amber-600 font-bold">
                      {prediction.bestFlapper.avgMultiplier.toFixed(2)}×
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400">No flapper data</span>
                )}
              </div>
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Search className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                    Best Cash Hunt
                  </span>
                </div>
                {prediction.bestCashHuntSymbol ? (
                  <div className="text-xs">
                    <span className="font-semibold">
                      {prediction.bestCashHuntSymbol.symbol}
                    </span>{" "}
                    <span className="text-amber-600 font-bold">
                      {prediction.bestCashHuntSymbol.avgMultiplier.toFixed(2)}×
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400">No cash hunt data</span>
                )}
              </div>
            </div>

            <div className="rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/40 px-2 py-2">
              <div className="flex items-start gap-1.5">
                <Brain className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-violet-800 dark:text-violet-200 leading-relaxed">
                  {prediction.summary}
                </p>
              </div>
            </div>

            <p className="text-[9px] text-zinc-400 leading-tight">
              Predictions are derived live from real 24h spin statistics (hot/cold frequency,
              top-slot match rate, flapper &amp; cash hunt averages). They are statistical
              observations, not guarantees.
            </p>

            {lastUpdated && (
              <div className="text-[10px] text-zinc-400 text-right">
                Updated {relativeTime(lastUpdated)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PredictionTile({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; value: string; tone: "hot" | "cold" }[];
  empty: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
          {title}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-zinc-400">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-700 dark:text-zinc-200 truncate">{it.label}</span>
              <span
                className={`font-bold ${
                  it.tone === "hot" ? "text-red-600" : "text-sky-600"
                }`}
              >
                {it.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}
