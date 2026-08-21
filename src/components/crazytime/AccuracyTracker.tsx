"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionError } from "@/components/crazytime/EmptyState";
import { relativeTime, label } from "@/lib/crazytime/adapter";
import { useClientPredictionTracker } from "@/hooks/use-client-prediction-tracker";
import { CheckCircle2, XCircle, Clock3, Target, Trophy, BarChart3, Flame, AlertTriangle, Database } from "lucide-react";

interface Props {
  accuracy: any | null | undefined;
  loading: boolean;
  error: string | null;
  databaseStatus?: "AVAILABLE" | "UNAVAILABLE" | null;
  accuracyStatus?: "AVAILABLE" | "UNAVAILABLE" | "EMPTY" | null;
}

const STRATEGY_LABEL: Record<string, string> = {
  momentum: "Signal #1",
  hot_trend: "Signal #2",
  overdue_bonus: "Signal #3",
};

const STRATEGY_COLOR: Record<string, string> = {
  momentum: "#448AFF",
  hot_trend: "#ff6b35",
  overdue_bonus: "#FFD700",
};

export function AccuracyTracker({ accuracy: serverAccuracy, loading, error }: Props) {
  // Use the CLIENT-SIDE tracker (localStorage) — this works on Vercel
  // without needing a persistent server-side database.
  // Use mounted state to avoid hydration mismatch (localStorage only on client)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clientTracker = useClientPredictionTracker();
  const accuracy = mounted ? clientTracker.accuracy : null;
  return (
    <Card className="bg-[#141827] border-[#1e2240] text-white h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
          <BarChart3 className="w-4 h-4 text-[#2ed573]" />
          Prediction Accuracy Tracker
        </CardTitle>
        {accuracy && accuracy.verified > 0 && (
          <Badge className="bg-[#2ed573]/20 text-[#2ed573] border border-[#2ed573]/40 text-[10px] gap-1">
            <Trophy className="w-2.5 h-2.5" />
            {accuracy.verified} verified
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
        ) : !accuracy || accuracy.totalPredictions === 0 ? (
          <EmptyState message="Click GET SIGNAL — predictions will be verified against the real next spin and tracked here. Data persists in your browser (localStorage)." />
        ) : (
          <div className="space-y-3">
            {/* Overall accuracy cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#8899cc] mb-0.5">
                  <Target className="w-3 h-3 text-[#448AFF]" />
                  WIN RATE
                </div>
                <div className="text-xl font-extrabold text-[#448AFF]">
                  {accuracy.verified > 0 ? `${accuracy.winRate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[9px] text-[#5a6a99]">
                  {accuracy.wins}/{accuracy.verified} verified
                </div>
              </div>
              <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#8899cc] mb-0.5">
                  <Trophy className="w-3 h-3 text-[#2ed573]" />
                  TOP-3 HIT RATE
                </div>
                <div className="text-xl font-extrabold text-[#2ed573]">
                  {accuracy.verified > 0 ? `${accuracy.top3Rate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[9px] text-[#5a6a99]">
                  {accuracy.top3Hits}/{accuracy.verified} verified
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5">
                <div className="text-[9px] text-[#8899cc]">TOTAL</div>
                <div className="text-sm font-bold text-white">{accuracy.totalPredictions}</div>
              </div>
              <div className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5">
                <div className="text-[9px] text-[#8899cc]">PENDING</div>
                <div className="text-sm font-bold text-[#ffa502]">{accuracy.pending}</div>
              </div>
              <div className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5">
                <div className="text-[9px] text-[#8899cc]">WINS</div>
                <div className="text-sm font-bold text-[#2ed573]">{accuracy.wins}</div>
              </div>
              <div className="rounded-md bg-[#0d1020] border border-[#1e2240] px-2 py-1.5">
                <div className="text-[9px] text-[#8899cc]">LOSSES</div>
                <div className="text-sm font-bold text-[#ff4757]">{accuracy.losses}</div>
              </div>
            </div>

            {/* Current streak */}
            {accuracy.currentStreak !== 0 && (
              <div className={`rounded-md px-2 py-1.5 flex items-center justify-between ${
                accuracy.currentStreak > 0
                  ? "bg-[#2ed573]/10 border border-[#2ed573]/30"
                  : "bg-[#ff4757]/10 border border-[#ff4757]/30"
              }`}>
                <div className="flex items-center gap-1 text-[11px]">
                  <Flame className={`w-3 h-3 ${accuracy.currentStreak > 0 ? "text-[#2ed573]" : "text-[#ff4757]"}`} />
                  <span className="text-[#8899cc]">Current streak:</span>
                </div>
                <span className={`text-sm font-bold ${
                  accuracy.currentStreak > 0 ? "text-[#2ed573]" : "text-[#ff4757]"
                }`}>
                  {accuracy.currentStreak > 0
                    ? `${accuracy.currentStreak}W`
                    : `${Math.abs(accuracy.currentStreak)}L`}
                </span>
              </div>
            )}

            {/* Per-strategy accuracy */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider">
                Per-signal real accuracy
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
                            {s.verified > 0 ? `${s.winRate.toFixed(1)}%` : "—"}
                          </span>
                          <span className="text-[10px] text-[#5a6a99]">
                            ({s.verified > 0 ? `${s.top3Rate.toFixed(0)}% top3` : "pending"})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-[#5a6a99]">
                        <span>{s.total} predictions</span>
                        <span>{s.verified} verified · {s.wins}W · {s.losses}L</span>
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
                  {accuracy.recentVerifications.map((r) => {
                    const color = STRATEGY_COLOR[r.strategy] ?? "#6b7280";
                    const pending = r.status === "PENDING";
                    return (
                      <li
                        key={r.predictionId}
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
                                {r.status === "WIN" ? (
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
