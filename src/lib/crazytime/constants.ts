// Real Crazy Time constants extracted from the upstream casinoscores application.
// These match exactly the constants used by in.casino.org/india/casinoscores/crazy-time
// so the real upstream API receives the correct query parameters.

export const UPSTREAM_API_BASE =
  "https://api-cs.casino.org/svc-evolution-game-events/api/crazytime";

// Main Crazy Time table id used by the upstream app.
export const CRAZY_TIME_TABLE_ID = "CrazyTime0000001";

// Default filters mirroring the upstream defaults so the same data set is returned.
export const DEFAULT_PAGE = 0;
export const DEFAULT_SIZE = 20;
export const DEFAULT_SORT = "data.settledAt,desc";
export const DEFAULT_DURATION_HOURS = 24;
// TRUE_FALSE_LIST used by the upstream app (raw comma-separated, NOT URL-encoded)
export const DEFAULT_TOPSLOT_MATCHED_FILTER = "true,false";
// WHEEL_RESULTS_FILTER_FULL = the exact string the upstream app sends to the API.
// (commas must remain raw - the API returns [] if they are %2C-encoded)
export const DEFAULT_WHEEL_RESULTS_FILTER =
  "Pachinko,CashHunt,CrazyBonus,CoinFlip,1,2,5,10";

// Wheel result sectors (matches the upstream WHEEL_RESULTS_CRAZY_TIME_LIST)
export const WHEEL_SECTORS = [
  "1",
  "2",
  "5",
  "10",
  "CoinFlip",
  "Pachinko",
  "CashHunt",
  "CrazyBonus",
] as const;

export type WheelSector = (typeof WHEEL_SECTORS)[number];

// Bonus game types that have a bonus round outcome
export const BONUS_TYPES = ["Pachinko", "CashHunt", "CrazyBonus", "CoinFlip"] as const;

// Cloudinary card images for each wheel sector (matches upstream CRAZY_TIME_WHEEL_RESULT_IMAGE_MAP)
export const WHEEL_RESULT_CARD_IMAGE: Record<string, string> = {
  "1": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/one-card.png",
  "2": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/two-card.png",
  "5": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/five-card.png",
  "10": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/ten-card.png",
  CoinFlip:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/coin-flip-card.png",
  Pachinko:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/pachiko-card.png",
  CashHunt:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/cash-hunt-card.png",
  CrazyBonus:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/crazy-time-card.png",
};

// Top slot small icons (matches upstream CRAZY_TIME_TOP_SLOT_IMAGE_MAP)
export const TOP_SLOT_IMAGE: Record<string, string> = {
  "1": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/one.png",
  "2": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/two.png",
  "5": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/five.png",
  "10": "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/ten.png",
  CoinFlip:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/coin-flip.png",
  Pachinko:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/pachiko.png",
  CashHunt:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/cash-hunt.png",
  CrazyBonus:
    "https://res.cloudinary.com/casinogrounds/image/upload/gameshows/evolution-gaming/crazy-time/crazy-time.png",
};

// Human readable labels for sectors
export const WHEEL_SECTOR_LABELS: Record<string, string> = {
  "1": "One",
  "2": "Two",
  "5": "Five",
  "10": "Ten",
  CoinFlip: "Coin Flip",
  Pachinko: "Pachinko",
  CashHunt: "Cash Hunt",
  CrazyBonus: "Crazy Time",
};

// Live video stream used by the upstream Crazy Time page (Evolution Gaming feed via egprom).
// The egprom CDN blocks browser requests without a Referer header, so we proxy the
// playlist + segments through our own /api/crazytime/stream route which sets the
// proper Origin/Referer server-side. The upstream master playlist URL is preserved
// here so the proxy knows the original source.
export const CRAZY_TIME_LIVE_STREAM_UPSTREAM =
  "https://live101.egprom.com/app/43/amlst:dc3_ct_auto/playlist.m3u8";
export const CRAZY_TIME_LIVE_STREAM_URL = "/api/crazytime/stream";

// Big-win threshold for highlighting (matches upstream CRAZY_TIME_BIG_WIN_MULTIPLIER_THRESHOLD)
export const BIG_WIN_MULTIPLIER_THRESHOLD = 2501;

export const SECTOR_COLORS: Record<string, string> = {
  "1": "#fef08a",
  "2": "#bbf7d0",
  "5": "#bae6fd",
  "10": "#fecaca",
  CoinFlip: "#ddd6fe",
  Pachinko: "#fed7aa",
  CashHunt: "#fbcfe8",
  CrazyBonus: "#fdba74",
};
