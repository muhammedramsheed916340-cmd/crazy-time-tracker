"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "./EmptyState";
import { SectionError } from "./EmptyState";
import { label, relativeTime } from "@/lib/crazytime/adapter";
import { SECTOR_COLORS } from "@/lib/crazytime/constants";
import type { NormalizedStats } from "@/lib/crazytime/types";
import { BarChart3, Flame, Snowflake } from "lucide-react";

interface Props {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function CrazyTimeStatistics({ stats, loading, error, lastUpdated }: Props) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          Crazy Time Statistics
        </CardTitle>
        {stats && (
          <Badge variant="secondary" className="font-mono">
            {stats.totalCount.toLocaleString()} spins (24h)
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !stats || stats.aggStats.length === 0 ? (
          <EmptyState message="Statistics are loading from the live data source…" />
        ) : (
          <div className="space-y-1.5">
            {stats.aggStats.map((s) => {
              const bg = SECTOR_COLORS[s.wheelResult] ?? "#e5e7eb";
              const hot = (s.hotFrequencyPercentage ?? 0) > 0;
              return (
                <div
                  key={s.wheelResult}
                  className="flex items-center gap-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1.5"
                >
                  <div
                    className="w-3 h-8 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: bg }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {label(s.wheelResult)}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {s.count.toLocaleString()} · {s.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, s.percentage)}%`,
                          backgroundColor: bg,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right flex-shrink-0">
                    <div className="flex items-center justify-end gap-1 text-[10px]">
                      {hot ? (
                        <Flame className="w-3 h-3 text-red-500" />
                      ) : (
                        <Snowflake className="w-3 h-3 text-sky-500" />
                      )}
                      <span
                        className={
                          hot
                            ? "text-red-600 font-semibold"
                            : "text-sky-600 font-semibold"
                        }
                      >
                        {hot ? "+" : ""}
                        {(s.hotFrequencyPercentage ?? 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-400">
                      Last {relativeTime(s.lastOccurredAt)}
                    </div>
                    {s.lastSeenBefore != null && (
                      <div className="text-[9px] text-zinc-400">
                        Skip {s.lastSeenBefore}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {lastUpdated && (
          <div className="mt-2 text-[10px] text-zinc-400 text-right">
            Updated {relativeTime(lastUpdated)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
