"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gift,
  RefreshCw,
  Bell,
  BellRing,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle2,
  X,
  Zap,
} from "lucide-react";
import { relativeTime, label } from "@/lib/crazytime/adapter";

interface BonusStat {
  key: string;
  label: string;
  color: string;
  emoji: string;
  totalCount24h: number;
  percentage24h: number;
  hotFrequencyPercentage: number | null;
  lastSeenBefore: number | null;
  roundsSinceLast: number;
  lastHitAt: string | null;
  lastHitMultiplier: number | null;
  windowHits: number;
  recentHits30: number;
  recentHits60: number;
  trendDelta: number;
  avgMultiplier: number | null;
  maxMultiplier: number | null;
}

interface LatestBonus {
  id: string;
  bonusKey: string;
  bonusLabel: string;
  color: string;
  settledAt: string | null;
  multiplier: number | null;
  bonusResultColor: string | null;
  bonusResultType: string | null;
  dealerName: string | null;
}

interface BonusHistoryItem {
  id: string;
  bonusKey: string;
  bonusLabel: string;
  color: string;
  emoji: string;
  settledAt: string | null;
  multiplier: number | null;
  bonusResultColor: string | null;
  bonusResultType: string | null;
  dealerName: string | null;
}

interface BonusResponse {
  bonusStats: BonusStat[];
  latestBonus: LatestBonus | null;
  bonusHistory: BonusHistoryItem[];
  distribution: { key: string; label: string; count: number; percentage: number }[];
  mostFrequent: { key: string; label: string; count: number } | null;
  longestGap: { key: string; label: string; roundsSinceLast: number } | null;
  totalBonuses: number;
  totalSpinsAnalyzed: number;
  bonusRate: number;
  fetchedAt: string;
  error?: string;
}

interface AlertItem {
  id: string;
  type: "new_bonus" | "bonus_changed" | "long_gap" | "frequency_shift" | "new_data";
  title: string;
  message: string;
  severity: "info" | "warning" | "success";
  timestamp: string;
}

interface BonusCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Long-gap threshold: if a bonus hasn't appeared in 40+ rounds, alert
const LONG_GAP_THRESHOLD = 40;
// Frequency shift threshold: if trend delta exceeds 5%, alert
const FREQ_SHIFT_THRESHOLD = 5;

export function BonusCenter({ open, onOpenChange }: BonusCenterProps) {
  const [data, setData] = useState<BonusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastSeenBonusId, setLastSeenBonusId] = useState<string | null>(null);
  const [lastSeenBonusKey, setLastSeenBonusKey] = useState<string | null>(null);
  const [prevFrequencies, setPrevFrequencies] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crazytime/bonus?size=200&_=${Date.now()}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BonusResponse;
      setData(json);
      if (json.error) setError(json.error);

      // ===== ALERT DETECTION (only from real verified data) =====
      if (alertsEnabled && json.latestBonus) {
        const newAlerts: AlertItem[] = [];
        const now = new Date().toISOString();

        // Alert 1: New bonus result detected
        if (lastSeenBonusId !== null && json.latestBonus.id !== lastSeenBonusId) {
          newAlerts.push({
            id: `new_${json.latestBonus.id}_${Date.now()}`,
            type: "new_bonus",
            title: "🆕 New Bonus Result Detected",
            message: `A new ${json.latestBonus.bonusLabel} bonus round just resolved${json.latestBonus.multiplier ? ` with ${json.latestBonus.multiplier}× multiplier` : ""}. This is verified real data.`,
            severity: "success",
            timestamp: now,
          });
        }

        // Alert 2: Bonus result changed (different bonus type from previous)
        if (
          lastSeenBonusKey !== null &&
          json.latestBonus.bonusKey !== lastSeenBonusKey
        ) {
          newAlerts.push({
            id: `changed_${json.latestBonus.id}_${Date.now()}`,
            type: "bonus_changed",
            title: "🔄 Bonus Type Changed",
            message: `The latest bonus changed from ${label(lastSeenBonusKey)} to ${json.latestBonus.bonusLabel}. A different bonus round just occurred.`,
            severity: "info",
            timestamp: now,
          });
        }

        // Alert 3: Long gap since a bonus appeared
        for (const bs of json.bonusStats) {
          if (bs.roundsSinceLast >= LONG_GAP_THRESHOLD) {
            newAlerts.push({
              id: `gap_${bs.key}_${Date.now()}`,
              type: "long_gap",
              title: `⏰ Long Gap: ${bs.label}`,
              message: `${bs.label} hasn't appeared in ${bs.roundsSinceLast} rounds. This is a statistical observation — NOT a guarantee that it will hit next.`,
              severity: "warning",
              timestamp: now,
            });
          }
        }

        // Alert 4: Significant change in recent bonus frequency
        for (const bs of json.bonusStats) {
          const prevPct = prevFrequencies[bs.key];
          if (prevPct !== undefined) {
            const delta = bs.percentage24h - prevPct;
            if (Math.abs(delta) >= FREQ_SHIFT_THRESHOLD) {
              newAlerts.push({
                id: `freq_${bs.key}_${Date.now()}`,
                type: "frequency_shift",
                title: `📊 Frequency Shift: ${bs.label}`,
                message: `${bs.label}'s 24h frequency ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta).toFixed(2)}% (from ${prevPct.toFixed(2)}% to ${bs.percentage24h.toFixed(2)}%). Statistical trend — not a prediction.`,
                severity: "info",
                timestamp: now,
              });
            }
          }
        }

        // Alert 5: New verified bonus data received
        if (lastSeenBonusId === null) {
          newAlerts.push({
            id: `init_${Date.now()}`,
            type: "new_data",
            title: "✅ Bonus Intelligence Active",
            message: `Loaded ${json.totalBonuses} verified bonus rounds from ${json.totalSpinsAnalyzed} real spins. Alerts are now monitoring for changes.`,
            severity: "info",
            timestamp: now,
          });
        }

        if (newAlerts.length > 0) {
          setAlerts((prev) => {
            // Deduplicate: only add alerts that aren't already in the list
            // (same type + same key). This prevents the long-gap alert from
            // repeating on every 30s refresh.
            const existingKeys = new Set(
              prev.map((a) => {
                // Extract the alert "signature" (type + sector/key)
                const match = a.id.match(/^(new|changed|gap|freq|init)_([^_]+)/);
                return match ? `${match[1]}_${match[2]}` : a.id;
              })
            );
            const filtered = newAlerts.filter((na) => {
              const match = na.id.match(/^(new|changed|gap|freq|init)_([^_]+)/);
              const sig = match ? `${match[1]}_${match[2]}` : na.id;
              return !existingKeys.has(sig);
            });
            if (filtered.length === 0) return prev;
            return [...filtered, ...prev].slice(0, 20);
          });
        }

        // Update tracking state
        setLastSeenBonusId(json.latestBonus.id);
        setLastSeenBonusKey(json.latestBonus.bonusKey);
        const newFreqs: Record<string, number> = {};
        for (const bs of json.bonusStats) {
          newFreqs[bs.key] = bs.percentage24h;
        }
        setPrevFrequencies(newFreqs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [alertsEnabled, lastSeenBonusId, lastSeenBonusKey, prevFrequencies]);

  // Fetch when popup opens
  useEffect(() => {
    if (open) {
      void fetchData();
    }
  }, [open, fetchData]);

  // Auto-refresh every 30s while open
  useEffect(() => {
    if (!open) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      void fetchData();
    }, 30000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, fetchData]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] bg-[#0a0b14] border-[#1e2240] text-white p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-[#1e2240] flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[rgba(255,215,0,0.15)] border border-[rgba(255,215,0,0.3)] flex items-center justify-center">
              <Gift className="w-4 h-4 text-[#FFD700]" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Bonus Intelligence Center
              </DialogTitle>
              <p className="text-[10px] text-[#8899cc]">
                Real verified bonus data · {data ? `${data.totalBonuses} bonuses tracked` : "loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`h-8 px-2 text-[10px] gap-1 ${
                alertsEnabled
                  ? "text-[#2ed573] hover:bg-[rgba(46,213,115,0.1)]"
                  : "text-[#8899cc] hover:bg-[#1e2240]"
              }`}
            >
              {alertsEnabled ? <BellRing className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
              {alertsEnabled ? "Alerts ON" : "Alerts OFF"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void fetchData()}
              disabled={loading}
              className="h-8 w-8 p-0 text-[#448AFF] hover:bg-[rgba(68,138,255,0.1)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-60px)]">
          <div className="p-4 space-y-4">
            {/* Alerts panel */}
            {alerts.length > 0 && (
              <div className="rounded-xl bg-[#0d1020] border border-[#1e2240] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">
                    <BellRing className="w-3 h-3" />
                    Live Alerts ({alerts.length})
                  </div>
                  <button
                    onClick={clearAlerts}
                    className="text-[9px] text-[#8899cc] hover:text-white underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-1.5">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg px-2.5 py-2 border text-[10px] flex items-start gap-2 ${
                        alert.severity === "success"
                          ? "bg-[rgba(46,213,115,0.08)] border-[rgba(46,213,115,0.3)]"
                          : alert.severity === "warning"
                            ? "bg-[rgba(255,165,2,0.08)] border-[rgba(255,165,2,0.3)]"
                            : "bg-[rgba(68,138,255,0.08)] border-[rgba(68,138,255,0.3)]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-[11px] mb-0.5">
                          {alert.title}
                        </div>
                        <div className="text-[#bcc6e0] leading-relaxed">
                          {alert.message}
                        </div>
                        <div className="text-[8px] text-[#5a6a99] mt-0.5">
                          {relativeTime(alert.timestamp)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeAlert(alert.id)}
                        className="text-[#5a6a99] hover:text-white flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-[#5a6a99] mt-2 leading-tight">
                  ⚠️ Alerts are triggered ONLY from real verified incoming data. Statistical
                  observations are NOT guarantees of future outcomes.
                </p>
              </div>
            )}

            {/* Latest bonus result */}
            <div>
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#FFD700]" />
                Latest Bonus Result
              </div>
              {loading && !data ? (
                <Skeleton className="h-20 w-full bg-[#1e2240]" />
              ) : data?.latestBonus ? (
                <div
                  className="rounded-xl p-3 border flex items-center gap-3"
                  style={{
                    backgroundColor: `${data.latestBonus.color}15`,
                    borderColor: `${data.latestBonus.color}40`,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: `${data.latestBonus.color}30` }}
                  >
                    {BONUS_EMOJI[data.latestBonus.bonusKey] ?? "🎯"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-white">
                        {data.latestBonus.bonusLabel}
                      </span>
                      <Badge className="bg-[#2ed573]/20 text-[#2ed573] border border-[#2ed573]/40 text-[8px] py-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2ed573] animate-pulse mr-1" />
                        LIVE
                      </Badge>
                    </div>
                    <div className="text-[10px] text-[#8899cc] mt-0.5">
                      {data.latestBonus.multiplier != null && (
                        <span className="text-[#FFD700] font-bold">
                          {data.latestBonus.multiplier}× multiplier
                        </span>
                      )}
                      {data.latestBonus.bonusResultColor && (
                        <span className="ml-2">· {data.latestBonus.bonusResultColor}</span>
                      )}
                      {data.latestBonus.dealerName && (
                        <span className="ml-2">· Dealer: {data.latestBonus.dealerName}</span>
                      )}
                    </div>
                    <div className="text-[9px] text-[#5a6a99] mt-0.5">
                      {relativeTime(data.latestBonus.settledAt)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#0d1020] border border-[#1e2240] p-4 text-center text-[11px] text-[#8899cc]">
                  No bonus rounds in the recent window
                </div>
              )}
            </div>

            {/* 4 Bonus type cards */}
            <div>
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target className="w-3 h-3 text-[#448AFF]" />
                Bonus Frequency & Last-Seen
              </div>
              <div className="grid grid-cols-2 gap-2">
                {loading && !data
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 bg-[#1e2240]" />
                    ))
                  : data?.bonusStats.map((bs) => (
                      <BonusTypeCard key={bs.key} stat={bs} />
                    ))}
              </div>
            </div>

            {/* Distribution statistics */}
            {data && data.distribution.length > 0 && (
              <div className="rounded-xl bg-[#0d1020] border border-[#1e2240] p-3">
                <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-[#2ed573]" />
                  Bonus Distribution (last {data.totalSpinsAnalyzed} spins)
                </div>
                <div className="space-y-1.5">
                  {data.distribution.map((d) => {
                    const stat = data.bonusStats.find((b) => b.key === d.key);
                    const color = stat?.color ?? "#6b7280";
                    return (
                      <div key={d.key} className="flex items-center gap-2">
                        <div className="text-[10px] text-[#bcc6e0] w-20 flex-shrink-0">
                          {BONUS_EMOJI[d.key]} {d.label}
                        </div>
                        <div className="flex-1 h-3 rounded-full bg-[#141827] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, d.percentage)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <div className="text-[9px] text-[#8899cc] w-16 text-right flex-shrink-0">
                          {d.count} ({d.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-[#1e2240]">
                  <div className="text-center">
                    <div className="text-[9px] text-[#8899cc]">TOTAL BONUSES</div>
                    <div className="text-sm font-bold text-[#FFD700]">
                      {data.totalBonuses}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[#8899cc]">BONUS RATE</div>
                    <div className="text-sm font-bold text-[#448AFF]">
                      {data.bonusRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[#8899cc]">MOST FREQ.</div>
                    <div className="text-sm font-bold text-[#2ed573] truncate">
                      {data.mostFrequent?.label ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Longest gap alert */}
            {data?.longestGap && (
              <div className="rounded-xl bg-[rgba(255,165,2,0.08)] border border-[rgba(255,165,2,0.3)] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#ffa502] uppercase tracking-wider mb-1">
                  <Clock className="w-3 h-3" />
                  Longest Current Gap
                </div>
                <div className="text-[11px] text-[#bcc6e0]">
                  <span className="font-bold text-white">{data.longestGap.label}</span> hasn't
                  appeared in{" "}
                  <span className="font-bold text-[#ffa502]">{data.longestGap.roundsSinceLast} rounds</span>
                  . <span className="text-[#5a6a99]">(Statistical observation — NOT a prediction)</span>
                </div>
              </div>
            )}

            {/* Bonus history */}
            <div>
              <div className="text-[10px] text-[#8899cc] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#FFD700]" />
                Bonus History (last {data?.bonusHistory.length ?? 0} bonus rounds)
              </div>
              {loading && !data ? (
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-[#1e2240]" />
                  ))}
                </div>
              ) : data?.bonusHistory.length ? (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {data.bonusHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-2 rounded-lg bg-[#0d1020] border border-[#1e2240] px-2 py-1.5"
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: `${h.color}30` }}
                      >
                        {h.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-semibold text-white truncate">
                            {h.bonusLabel}
                          </span>
                          {h.multiplier != null && (
                            <span className="text-[10px] text-[#FFD700] font-bold flex-shrink-0">
                              {h.multiplier}×
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[#5a6a99]">
                          {relativeTime(h.settledAt)}
                          {h.bonusResultColor && ` · ${h.bonusResultColor}`}
                          {h.dealerName && ` · ${h.dealerName}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] p-3 text-center text-[10px] text-[#8899cc]">
                  No bonus history yet
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="rounded-lg bg-[#0d1020] border border-[#1e2240] p-2">
              <div className="flex items-start gap-1.5 text-[9px] text-[#5a6a99] leading-relaxed">
                <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5 text-[#ffa502]" />
                <div>
                  <strong className="text-[#8899cc]">Historical/Statistical Information:</strong> All
                  bonus data shown is from real verified Crazy Time rounds. Frequencies, trends, and
                  gaps are statistical observations of past data — they are{" "}
                  <strong>NOT predictions</strong> and do NOT guarantee any future bonus outcome.
                  Crazy Time is a random game; past patterns do not influence future spins.
                </div>
              </div>
            </div>

            {/* Live data status */}
            <div className="flex items-center justify-between text-[9px] text-[#5a6a99]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 text-[#2ed573]" />
                Auto-refresh every 30s
              </span>
              {data && (
                <span>Updated {relativeTime(data.fetchedAt)}</span>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const BONUS_EMOJI: Record<string, string> = {
  CashHunt: "🎯",
  Pachinko: "🟠",
  CoinFlip: "🪙",
  CrazyBonus: "🎡",
};

function BonusTypeCard({ stat }: { stat: BonusStat }) {
  const isHot = (stat.hotFrequencyPercentage ?? 0) > 0;
  const isLongGap = stat.roundsSinceLast >= LONG_GAP_THRESHOLD;
  return (
    <div
      className="rounded-xl p-2.5 border"
      style={{
        backgroundColor: `${stat.color}10`,
        borderColor: `${stat.color}30`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{stat.emoji}</span>
          <span className="text-[11px] font-bold text-white">{stat.label}</span>
        </div>
        {isLongGap && (
          <Badge className="bg-[#ffa502]/20 text-[#ffa502] border border-[#ffa502]/40 text-[7px] py-0 px-1">
            LONG GAP
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 text-[9px]">
        <div>
          <div className="text-[#5a6a99]">24h freq</div>
          <div className="font-bold text-white">
            {stat.percentage24h.toFixed(1)}%
          </div>
          <div className="text-[#5a6a99]">({stat.totalCount24h} hits)</div>
        </div>
        <div>
          <div className="text-[#5a6a99]">Last seen</div>
          <div className="font-bold text-[#FFD700]">{stat.roundsSinceLast}r ago</div>
          <div className="text-[#5a6a99]">{relativeTime(stat.lastHitAt)}</div>
        </div>
      </div>
      {/* Trend indicator */}
      <div className="flex items-center gap-1 mt-1.5 text-[8px]">
        {stat.trendDelta > 0 ? (
          <TrendingUp className="w-2.5 h-2.5 text-[#2ed573]" />
        ) : stat.trendDelta < 0 ? (
          <TrendingDown className="w-2.5 h-2.5 text-[#ff4757]" />
        ) : (
          <Activity className="w-2.5 h-2.5 text-[#8899cc]" />
        )}
        <span
          className={
            stat.trendDelta > 0
              ? "text-[#2ed573]"
              : stat.trendDelta < 0
                ? "text-[#ff4757]"
                : "text-[#8899cc]"
          }
        >
          {stat.trendDelta > 0 ? "+" : ""}
          {stat.trendDelta.toFixed(2)}% trend
        </span>
        {stat.hotFrequencyPercentage != null && (
          <span className="text-[#5a6a99] ml-auto">
            hot {(stat.hotFrequencyPercentage ?? 0).toFixed(1)}%
          </span>
        )}
      </div>
      {/* Multiplier stats */}
      {stat.avgMultiplier != null && (
        <div className="flex items-center justify-between mt-1 text-[8px] text-[#5a6a99]">
          <span>avg {stat.avgMultiplier}×</span>
          {stat.maxMultiplier != null && <span>max {stat.maxMultiplier}×</span>}
        </div>
      )}
    </div>
  );
}
