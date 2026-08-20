"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { relativeTime } from "@/lib/crazytime/adapter";

interface Props {
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  onRefresh: () => void;
  latestSettledAt: string | null;
  spinsCount: number;
  totalCount: number;
}

export function LiveStatusBar({
  loading,
  error,
  lastUpdated,
  onRefresh,
  latestSettledAt,
  spinsCount,
  totalCount,
}: Props) {
  const isLive = !error && (spinsCount > 0 || totalCount > 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 flex-wrap">
        {isLive ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
            <Wifi className="w-3 h-3" /> Live data
          </Badge>
        ) : error ? (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="w-3 h-3" /> {error.slice(0, 40)}
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Connecting…
          </Badge>
        )}
        {latestSettledAt && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Latest spin {relativeTime(latestSettledAt)}
          </span>
        )}
        {lastUpdated && (
          <span className="text-[11px] text-zinc-400">
            · refreshed {relativeTime(lastUpdated)}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        disabled={loading}
        className="h-7 gap-1 text-[11px]"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        Refresh now
      </Button>
    </div>
  );
}
