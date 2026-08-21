"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionError } from "./EmptyState";
import { relativeTime } from "@/lib/crazytime/adapter";
import type { NormalizedStats } from "@/lib/crazytime/types";
import { Wind } from "lucide-react";

interface Props {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const FLAPPER_COLORS: Record<string, string> = {
  Blue: "#3b82f6",
  Green: "#22c55e",
  Yellow: "#eab308",
};

export function CrazyBonusFlapper({ stats, loading, error, lastUpdated }: Props) {
  const flappers = stats?.crazyBonusFlapperStats ?? [];

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Wind className="w-4 h-4 text-sky-500" />
          Crazy Bonus Flapper
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : flappers.length === 0 ? (
          <EmptyState message="Waiting for Crazy Bonus Flapper statistics…" />
        ) : (
          <div className="space-y-2">
            {flappers.map((f) => {
              const color = FLAPPER_COLORS[f.symbol] ?? "#6b7280";
              const lta = f.flapperLongTermAverageMultiplier;
              const diff = lta != null ? f.avgMultiplier - lta : null;
              const positive = (diff ?? 0) > 0;
              return (
                <div
                  key={f.symbol}
                  className="flex items-center gap-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {f.symbol.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {f.symbol}
                      </span>
                      <span className="font-bold text-sm text-amber-600">
                        {f.avgMultiplier.toFixed(2)}× avg
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>
                        Long-term avg:{" "}
                        {lta != null ? lta.toFixed(2) + "×" : "—"}
                      </span>
                      {diff != null && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 px-1 ${
                            positive
                              ? "border-emerald-500 text-emerald-600"
                              : "border-red-500 text-red-600"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {diff.toFixed(2)}×
                        </Badge>
                      )}
                    </div>
                    {f.flapperMultiplierFrequencyPercentage != null && (
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Freq vs avg:{" "}
                        {f.flapperMultiplierFrequencyPercentage > 0 ? "+" : ""}
                        {f.flapperMultiplierFrequencyPercentage.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-zinc-400 text-right pt-1">
              Updated {relativeTime(lastUpdated)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
