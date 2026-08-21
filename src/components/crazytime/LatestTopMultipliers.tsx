"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionError } from "./EmptyState";
import { label, relativeTime, cardImage } from "@/lib/crazytime/adapter";
import type { NormalizedStats } from "@/lib/crazytime/types";
import { Trophy } from "lucide-react";

interface Props {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function LatestTopMultipliers({ stats, loading, error, lastUpdated }: Props) {
  const best = stats?.bestMultipliers ?? [];

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Latest Top Multipliers
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">24h</Badge>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : best.length === 0 ? (
          <EmptyState message="Waiting for the latest big win multipliers…" />
        ) : (
          <ol className="space-y-2">
            {best.map((m, idx) => {
              const img = cardImage(m.wheelResult);
              return (
                <li
                  key={m.id || idx}
                  className="flex items-center gap-3 rounded-md bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-zinc-800/30 border border-amber-200 dark:border-amber-900/40 px-2 py-2"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={label(m.wheelResult)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px]">{label(m.wheelResult).slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {label(m.wheelResult)}
                      </span>
                      <span className="font-bold text-base text-amber-600">
                        {m.maxMultiplier.toLocaleString()}×
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {relativeTime(m.lastOccurredAt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
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
