"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionError } from "./EmptyState";
import { cardImage, formatTime, relativeTime, label } from "@/lib/crazytime/adapter";
import { SECTOR_COLORS, BIG_WIN_MULTIPLIER_THRESHOLD } from "@/lib/crazytime/constants";
import type { NormalizedSpin } from "@/lib/crazytime/types";
import { History } from "lucide-react";

interface Props {
  spins: NormalizedSpin[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  lastUpdated: string | null;
  onRefresh: () => void;
}

export function SpinHistory({ spins, loading, error, totalCount, lastUpdated }: Props) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <History className="w-4 h-4 text-amber-500" />
          Spin History
        </CardTitle>
        <Badge variant="secondary" className="font-mono">
          {totalCount.toLocaleString()} total
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && spins.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : spins.length === 0 ? (
          <EmptyState message="Waiting for the first spin of the live session…" />
        ) : (
          <ScrollArea className="h-full max-h-[520px]">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {spins.map((spin, idx) => (
                <SpinRow key={spin.id || idx} spin={spin} latest={idx === 0} />
              ))}
            </ul>
          </ScrollArea>
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

function SpinRow({ spin, latest }: { spin: NormalizedSpin; latest: boolean }) {
  const sector = spin.wheelResultSector;
  const topSlotSector = spin.topSlotSector;
  const img = cardImage(sector);
  const big = (spin.maxMultiplier ?? 0) >= BIG_WIN_MULTIPLIER_THRESHOLD;
  const bg = sector ? SECTOR_COLORS[sector] ?? "#e5e7eb" : "#e5e7eb";

  return (
    <li className="flex items-center gap-3 py-2.5 px-1">
      <div
        className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: bg }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={label(sector)} className="w-full h-full object-cover" />
        ) : (
          label(sector).slice(0, 3)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            {label(sector)}
          </span>
          {latest && (
            <Badge className="bg-red-600 hover:bg-red-600 text-[9px] py-0 px-1.5">NEW</Badge>
          )}
          {big && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[9px] py-0 px-1.5">
              BIG WIN
            </Badge>
          )}
          {spin.isTopSlotMatched && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-emerald-500 text-emerald-600">
              TOP SLOT MATCH
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
          <span>{formatTime(spin.settledAt)}</span>
          <span>·</span>
          <span>{relativeTime(spin.settledAt)}</span>
          {spin.dealerName && (
            <>
              <span>·</span>
              <span className="truncate">Dealer: {spin.dealerName}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {spin.maxMultiplier != null && spin.maxMultiplier > 1 && (
          <div className="text-sm font-bold text-amber-600">
            {spin.maxMultiplier.toLocaleString()}×
          </div>
        )}
        {topSlotSector && (
          <div className="text-[10px] text-zinc-400">Top slot: {label(topSlotSector)}</div>
        )}
        {spin.bonusType && (
          <div className="text-[10px] text-zinc-400">
            Bonus: {spin.bonusType}
            {spin.bonusTotalMultiplier != null ? ` (${spin.bonusTotalMultiplier}×)` : ""}
          </div>
        )}
      </div>
    </li>
  );
}
