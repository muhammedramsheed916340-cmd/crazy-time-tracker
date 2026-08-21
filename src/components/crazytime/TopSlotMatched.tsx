"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionError } from "./EmptyState";
import { relativeTime } from "@/lib/crazytime/adapter";
import type { NormalizedStats } from "@/lib/crazytime/types";
import { Crosshair } from "lucide-react";

interface Props {
  stats: NormalizedStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function TopSlotMatched({ stats, loading, error, lastUpdated }: Props) {
  const matched = stats?.topSlotMatchedStats.find((s) => s.matched);
  const notMatched = stats?.topSlotMatchedStats.find((s) => !s.matched);

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-fuchsia-500" />
          Top Slot Matched Wheel Result
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !stats ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !matched ? (
          <EmptyState message="Waiting for top slot match statistics…" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label="Matched"
                value={matched.percentage.toFixed(2) + "%"}
                sub={`${matched.totalCount.toLocaleString()} spins`}
                color="bg-emerald-500"
              />
              <StatBox
                label="Not Matched"
                value={(notMatched?.percentage ?? 0).toFixed(2) + "%"}
                sub={`${(notMatched?.totalCount ?? 0).toLocaleString()} spins`}
                color="bg-zinc-400"
              />
            </div>

            <div className="relative h-3 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${matched.percentage}%` }}
              />
              <div
                className="bg-zinc-400 h-full"
                style={{ width: `${notMatched?.percentage ?? 0}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
                <div className="text-zinc-500">Short-term freq.</div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {matched.topSlotMatchedFrequencyPercentage != null
                    ? `${matched.topSlotMatchedFrequencyPercentage.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
                <div className="text-zinc-500">Long-term avg.</div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {matched.topSlotMatchedLongTermAverage != null
                    ? `${matched.topSlotMatchedLongTermAverage.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                Live rate
              </Badge>
              <span>Updated {relativeTime(lastUpdated)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 mb-0.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        {label}
      </div>
      <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="text-[10px] text-zinc-400">{sub}</div>
    </div>
  );
}
