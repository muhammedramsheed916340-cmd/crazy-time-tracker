// Types for the real Crazy Time upstream API responses.
// These match the actual JSON returned by api-cs.casino.org/svc-evolution-game-events/api/crazytime

export interface RawTopSlot {
  wheelSector?: string | null;
  multiplier?: number | null;
}

export interface RawBonusResult {
  color?: string | null;
  multiplier?: number | null;
  type?: string | null;
}

export interface RawBonus {
  type?: string | null;
  result?: RawBonusResult | null;
  bonusMultiplier?: { value?: number | null } | number | null;
  totalMultiplier?: number | null;
}

export interface RawWheelResult {
  type?: string | null;
  wheelSector?: string | null;
  bonus?: RawBonus | null;
}

export interface RawOutcome {
  topSlot?: RawTopSlot | null;
  wheelResult?: RawWheelResult | null;
  maxMultiplier?: number | null;
  isTopSlotMatchedToWheelResult?: boolean | null;
}

export interface RawGameResult {
  outcome?: RawOutcome | null;
}

export interface RawTable {
  id?: string | null;
  name?: string | null;
}

export interface RawDealer {
  name?: string | null;
  uid?: string | null;
}

export interface RawGameEventData {
  id?: string | null;
  startedAt?: string | null;
  settledAt?: string | null;
  status?: string | null;
  gameType?: string | null;
  currency?: string | null;
  wager?: number | null;
  payout?: number | null;
  table?: RawTable | null;
  dealer?: RawDealer | null;
  numOfParticipants?: number | null;
  result?: RawGameResult | null;
}

export interface RawWinner {
  screenName?: string | null;
  winnings?: number | null;
}

export interface RawGameEvent {
  id?: string | null;
  transmissionId?: string | null;
  totalWinners?: number | null;
  totalAmount?: number | null;
  winners?: RawWinner[] | null;
  data?: RawGameEventData | null;
}

export interface RawAggStat {
  wheelResult?: string | null;
  count?: number | null;
  percentage?: number | null;
  lastOccurredAt?: string | null;
  lastSeenBefore?: number | null;
  hotFrequencyPercentage?: number | null;
}

export interface RawBestMultiplier {
  id?: string | null;
  wheelResult?: string | null;
  lastOccurredAt?: string | null;
  maxMultiplier?: number | null;
  bigWinStreamUrl?: string | null;
}

export interface RawTopSlotMatchedStat {
  matched?: boolean | null;
  percentage?: number | null;
  totalCount?: number | null;
  topSlotMatchedFrequencyPercentage?: number | null;
  topSlotMatchedLongTermAverage?: number | null;
}

export interface RawBestIndividualWin {
  id?: string | null;
  screenName?: string | null;
  winAmount?: number | null;
  wheelResult?: string | null;
  maxMultiplier?: number | null;
  lastOccurredAt?: string | null;
}

export interface RawCrazyBonusFlapperStat {
  symbol?: string | null;
  avgMultiplier?: number | null;
  flapperLongTermAverageMultiplier?: number | null;
  flapperMultiplierFrequencyPercentage?: number | null;
}

export interface RawCoinFlipStat {
  symbol?: string | null;
  avgMultiplier?: number | null;
  count?: number | null;
  percentage?: number | null;
  coinFlipFrequencyPercentage?: number | null;
  coinFlipMultiplierFrequencyPercentage?: number | null;
  coinFlipMultiplierLongTermAverage?: number | null;
  coinFlipPercentageLongTermAverage?: number | null;
}

export interface RawCashHuntSymbolStat {
  symbol?: string | null;
  avgMultiplier?: number | null;
  count?: number | null;
  cashHuntMultiplierFrequencyPercentage?: number | null;
  cashHuntLongTermAverage?: number | null;
}

export interface RawStatsResponse {
  totalCount?: number | null;
  aggStats?: RawAggStat[] | null;
  bestMultipliers?: RawBestMultiplier[] | null;
  topSlotToWheelResultStats?: RawTopSlotMatchedStat[] | null;
  bestIndividualWins?: RawBestIndividualWin[] | null;
  cashHuntAvgStatsByPosition?: {
    cashHuntAvgArray?: number[][] | null;
    maxMultiplier?: number | null;
    minMultiplier?: number | null;
  } | null;
  cashHuntSymbolStats?: RawCashHuntSymbolStat[] | null;
  crazyBonusFlapperStats?: RawCrazyBonusFlapperStat[] | null;
  coinFlipStats?: RawCoinFlipStat[] | null;
}

// ----- Normalized shapes used by the UI -----

export interface NormalizedSpin {
  id: string;
  eventId: string;
  settledAt: string | null;
  startedAt: string | null;
  status: string | null;
  gameType: string | null;
  dealerName: string | null;
  tableName: string | null;
  tableId: string | null;
  wager: number | null;
  payout: number | null;
  numOfParticipants: number | null;
  totalWinners: number | null;
  totalAmount: number | null;
  topSlotSector: string | null;
  topSlotMultiplier: number | null;
  wheelResultType: string | null;
  wheelResultSector: string | null;
  isTopSlotMatched: boolean;
  maxMultiplier: number | null;
  bonusType: string | null;
  bonusResultColor: string | null;
  bonusResultType: string | null;
  bonusResultMultiplier: number | null;
  bonusTotalMultiplier: number | null;
  bonusMultiplierValue: number | null;
  topWinners: { screenName: string; winnings: number }[];
  raw: RawGameEvent;
}

export interface NormalizedStats {
  totalCount: number;
  aggStats: {
    wheelResult: string;
    count: number;
    percentage: number;
    lastOccurredAt: string | null;
    lastSeenBefore: number | null;
    hotFrequencyPercentage: number | null;
  }[];
  bestMultipliers: {
    id: string;
    wheelResult: string;
    lastOccurredAt: string | null;
    maxMultiplier: number;
    bigWinStreamUrl: string | null;
  }[];
  topSlotMatchedStats: {
    matched: boolean;
    percentage: number;
    totalCount: number;
    topSlotMatchedFrequencyPercentage: number | null;
    topSlotMatchedLongTermAverage: number | null;
  }[];
  bestIndividualWins: {
    id: string;
    screenName: string;
    winAmount: number;
    wheelResult: string;
    maxMultiplier: number;
    lastOccurredAt: string | null;
  }[];
  crazyBonusFlapperStats: {
    symbol: string;
    avgMultiplier: number;
    flapperLongTermAverageMultiplier: number | null;
    flapperMultiplierFrequencyPercentage: number | null;
  }[];
  coinFlipStats: {
    symbol: string;
    avgMultiplier: number;
    count: number;
    percentage: number;
    coinFlipFrequencyPercentage: number | null;
    coinFlipMultiplierFrequencyPercentage: number | null;
    coinFlipMultiplierLongTermAverage: number | null;
    coinFlipPercentageLongTermAverage: number | null;
  }[];
  cashHuntSymbolStats: {
    symbol: string;
    avgMultiplier: number;
    count: number;
    cashHuntMultiplierFrequencyPercentage: number | null;
    cashHuntLongTermAverage: number | null;
  }[];
  raw: RawStatsResponse;
}

export interface NormalizedPrediction {
  hotSectors: { sector: string; hotFrequencyPercentage: number }[];
  coldSectors: { sector: string; hotFrequencyPercentage: number }[];
  overdueSectors: { sector: string; lastSeenBefore: number }[];
  topSlotMatchedPercentage: number | null;
  topSlotMatchedLongTermAverage: number | null;
  coinFlipBluePercentage: number | null;
  coinFlipRedPercentage: number | null;
  bestFlapper: { symbol: string; avgMultiplier: number } | null;
  bestCashHuntSymbol: { symbol: string; avgMultiplier: number } | null;
  summary: string;
}

// A single "next spin" signal derived purely from real live stats.
export interface NextSpinSignal {
  sector: string; // raw sector key (e.g. "1", "Pachinko")
  sectorLabel: string; // human label
  cardImage: string | null; // cloudinary card image
  confidence: number; // 0-100, derived from real statistical signals
  // The real signals that contributed to this prediction
  signals: {
    label: string;
    detail: string;
    weight: number; // contribution to confidence
  }[];
  // Whether the prediction is a bonus round (Pachinko/CashHunt/CrazyBonus/CoinFlip)
  isBonus: boolean;
  // Real observed stats that fed the prediction
  observedPercentage: number; // % of last 24h spins landing on this sector
  observedCount: number;
  observedLastSeenBefore: number | null;
  observedHotFrequencyPercentage: number | null;
  generatedAt: string; // ISO
  // Real session counter (counts how many predictions have been made this session)
  sessionTotal: number;
  // Real model accuracy computed against recent spins:
  // how often the highest-weighted sector matched the actual next spin in the recent window
  modelAccuracy: number | null;
  // Identifier of the prediction strategy that produced this signal
  strategy: PredictionStrategy;
  // Human-readable title for the strategy
  strategyTitle: string;
  // Real observed values used by this strategy (for transparency)
  observed: {
    recentHits?: number; // hits in the recent momentum window
    recentWindow?: number; // size of the momentum window
    recentPercentage?: number; // % in the recent window
    momentumDelta?: number; // recent % minus 24h % (positive = heating up)
  };
}

export type PredictionStrategy =
  | "momentum" // weighted by recent spins (live momentum)
  | "hot_trend" // 24h hot frequency (sectors above long-term average)
  | "overdue_bonus" // most-overdue bonus round
  | "coverage"; // diversity/coverage pick
