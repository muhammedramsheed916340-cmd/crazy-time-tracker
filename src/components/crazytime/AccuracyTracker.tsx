"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionError } from "@/components/crazytime/EmptyState";
import { relativeTime, label } from "@/lib/crazytime/adapter";
import type { AccuracyStats } from "@/hooks/use-crazy-time";
import { CheckCircle2, XCircle, Clock3, Target, Trophy, BarChart3 } from "lucide-react";

interface Props {
  accuracy: AccuracyStats | null | undefined;
  loading: boolean;
  error: string | null;
}

const STRATEGY_LABEL: Record<string, string> = {
  momentum: "Momentum",
  hot_trend: "Hot Trend",
  overdue_bonus: "Overdue Bonus",
};

const STRATEGY_COLOR: Record<string, string> = {
  momentum: "#448AFF",
  hot_trend: "#ff6b35",
  overdue_bonus: "#FFD700",
};

export function AccuracyTracker({ accuracy, loading, error }: Props) {
  return (
    <Card className="bg-[#141827] border-[#1e2240] text-white h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
          <BarChart3 className="w-4 h-4 text-[#2ed573]" />
          Prediction Accuracy Tracker
        </CardTitle>
        {accuracy && accuracy.resolved > 0 && (
          <Badge className="bg-[#2ed573]/20 text-[#2ed573] border border-[#2ed573]/40 text-[10px] gap-1">
            <Trophy className="w-2.5 h-2.5" />
            {accuracy.resolved} verified
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error ? (
          <SectionError message={error} />
        ) : loading && !accuracy ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full bg-[#1e2240]" />
            <Skeleton className="h-10 w-full bg-[#1e2240]" />
            <Skeleton className="h-10 w-full bg-[#1e2240]" />
          </div>
        ) : !accuracy || accuracy.total === 0 ? (
          <EmptyState message="Click GET SIGNAL — predictions will be verified against the real next spin and tracked here." />
        ) : (
          <div className="space-y-3">
            {/* Overall accuracy cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#8899cc] mb-0.5">
                  <Target className="w-3 h-3 text-[#448AFF]" />
                  EXACT HIT RATE
                </div>
                <div className="text-xl font-extrabold text-[#448AFF]">
                  {accuracy.resolved > 0 ? `${accuracy.hitRate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[9px] text-[#5a6a99]">
                  {accuracy.hits}/{accuracy.resolved} resolved
                </div>
              </div>
              <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#8899cc] mb-0.5">
                  <Trophy className="w-3 h-3 text-[#2ed573]" />
                  TOP-3 HIT RATE
                </div>
                <div className="text-xl font-extrabold text-[#2ed573]">
                  {accuracy.resolved > 0 ? `${accuracy.top3HitRate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[9px] text-[#5a6a99]">
                  {accuracy.top3Hits}/{accuracy.resolved} resolved
                </div>
              </div>
            </div>

            {/* Per-strategy accuracy */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider">
                Per-strategy real accuracy
              </div>
              {accuracy.perStrategy.map((s) => {
                const color = STRATEGY_COLOR[s.strategy] ?? "#6b7280";
                const name = STRATEGY_LABEL[s.strategy] ?? s.strategy;
                return (
                  <div
                    key={s.strategy}
                    className="flex items-center gap-2 rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5"
                  >
                    <div
                      className="w-2 h-8 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{name}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{ color: "#448AFF" }}
                          >
                            {s.resolved > 0 ? `${s.hitRate.toFixed(1)}%` : "—"}
                          </span>
                          <span className="text-[10px] text-[#5a6a99]">
                            ({s.resolved > 0 ? `${s.top3HitRate.toFixed(0)}% top3` : "pending"})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-[#5a6a99]">
                        <span>{s.total} predictions made</span>
                        <span>{s.resolved} resolved · {s.hits} hits</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent prediction history */}
            <div>
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-1.5">
                Recent predictions vs actual
              </div>
              <ScrollArea className="max-h-64">
                <ul className="space-y-1">
                  {accuracy.recent.map((r) => {
                    const color = STRATEGY_COLOR[r.strategy] ?? "#6b7280";
                    const pending = r.resolvedAt === null || r.isHit === null;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5"
                      >
                        <div
                          className="w-1.5 h-8 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[10px] text-[#8899cc] truncate">
                                {STRATEGY_LABEL[r.strategy] ?? r.strategy}
                              </span>
                              <span className="text-[10px] text-[#5a6a99]">·</span>
                              <span className="text-[10px] text-[#5a6a99]">
                                {relativeTime(r.predictedAt)}
                              </span>
                            </div>
                            <span className="text-[9px] text-[#5a6a99]">
                              {r.confidence}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] mt-0.5">
                            <span className="text-[#bcc6e0]">
                              Predicted:{" "}
                              <span className="font-semibold text-white">
                                {r.predictedLabel}
                              </span>
                            </span>
                            {pending ? (
                              <span className="flex items-center gap-1 text-[10px] text-[#8899cc]">
                                <Clock3 className="w-2.5 h-2.5" />
                                awaiting next spin
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span className="text-[#5a6a99]">Actual:</span>
                                <span className="font-semibold text-white">
                                  {label(r.actualSector)}
                                </span>
                                {r.isHit ? (
                                  <CheckCircle2 className="w-3 h-3 text-[#2ed573]" />
                                ) : r.isTop3Hit ? (
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-[#448AFF]/20 text-[#448AFF] font-bold">
                                    TOP3
                                  </span>
                                ) : (
                                  <XCircle className="w-3 h-3 text-[#ff4757]" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </div>

            <p className="text-[9px] text-[#5a6a99] leading-tight pt-1">
              Every prediction is saved to a database when made, then automatically
              verified against the actual next real Crazy Time spin. The hit rates above
              are the genuine historical accuracy of each strategy — not estimates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
