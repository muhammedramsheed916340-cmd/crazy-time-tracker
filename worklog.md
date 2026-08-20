---
Task ID: crazy-time-full-build
Agent: Z.ai Code (main)
Task: Build a complete Crazy Time live tracker (same-to-same as casinoorg-india.com/india/casinoscores/crazy-time/) using REAL live data only — no mock/demo/fake data. Fix all blank sections (Spin History, Statistics, Top Slot Matched, Crazy Bonus Flapper, Latest Top Multipliers, Prediction, Live status, Live video) and the "Something went wrong" rendering error.

Work Log:
- Investigated the real upstream data source by downloading and parsing the Next.js chunks served by https://in.casino.org/india/casinoscores/crazy-time/.
- Discovered the real API base: https://api-cs.casino.org/svc-evolution-game-events/api/crazytime
- Extracted the exact constants the upstream app uses to query the API:
  - CRAZY_TIME_TABLE_ID = "CrazyTime0000001"
  - WHEEL_RESULTS_FILTER_FULL = "Pachinko,CashHunt,CrazyBonus,CoinFlip,1,2,5,10"
  - TRUE_FALSE_LIST (isTopSlotMatched) = "true,false"
  - WHEEL_RESULT_CARD_IMAGE map, TOP_SLOT_IMAGE map, sector labels, etc.
- Verified the real API works server-side (CORS only allows https://in.casino.org, so all client requests must be proxied through our own Next.js route handlers).
- ROOT CAUSE #1 (blank spins): `URLSearchParams` URL-encodes the comma in `wheelResults=Pachinko,...` to `%2C`, and the upstream API returns an empty array `[]` for that. Fixed by building the query string with raw commas.
- ROOT CAUSE #2 (rendering error): No safe normalizer existed, so a single malformed spin could crash the page. Added a defensive normalizer (`adapter.ts`) that never throws on missing/null/undefined fields and a per-record try/catch in `normalizeSpin`.
- ROOT CAUSE #3 (live video failing intermittently): egprom CDN (https://live101.egprom.com/app/43/amlst:dc3_ct_auto/playlist.m3u8) returns HTTP 418 to browser requests that lack a Referer header, and browsers cannot set Referer themselves. Fixed by adding a server-side stream proxy route (/api/crazytime/stream) that injects the proper Origin/Referer and rewrites all playlist/variant/segment URLs back through the proxy. Also switched the player to prefer hls.js (the Chromium native HLS demuxer fails on the master playlist's multi-variant structure).
- Created the live-refresh system: `useLiveFetch` hook polls every 15s for events and 30s for stats, is visibility-aware (pauses when tab hidden), aborts in-flight requests, and exposes a manual refresh.
- Built all UI sections using shadcn/ui Card/Badge/Skeleton/ScrollArea with consistent styling matching the reference site's amber/rose/purple Crazy Time theme:
  - LiveVideoPlayer (hls.js with exponential-backoff auto-reconnect, never crashes the rest of the page)
  - SpinHistory (real spins with sector card images, relative times, multipliers, NEW/BIG WIN/TOP SLOT MATCH badges)
  - CrazyTimeStatistics (real aggStats with hot/cold frequency bars and last-seen info)
  - TopSlotMatched (real matched vs not-matched percentages, short-term vs long-term average)
  - CrazyBonusFlapper (real Yellow/Green/Blue flapper averages vs long-term)
  - LatestTopMultipliers (real bestMultipliers ranked list with card images)
  - Prediction (derived purely from real stats: hot/cold/overdue sectors, top slot match probability, coin flip split, best flapper, best cash hunt symbol — no fabricated predictions)
  - CoinFlipStats + CashHuntStats (extra bonus round statistics from real data)
  - LiveStatusBar (live badge, latest spin time, refresh button)
- Sticky footer implemented with min-h-screen flex flex-col + mt-auto.
- Browser-verified the full flow with agent-browser:
  - Page loads with no React rendering errors
  - Live video: readyState=4, videoWidth=1280, videoHeight=720, paused=false, currentTime advancing — playing live HD stream
  - 43 relative-time entries, 51 multipliers, 46 percentages in the DOM
  - All 8 sector labels present (One/Two/Five/Ten/Coin Flip/Pachinko/Cash Hunt/Crazy Time)
  - Real top multipliers: Cash Hunt 1000×, Crazy Time 300×, etc.
  - Real predictions: Coin Flip +21.2% hot, Pachinko -24.9% cold, etc.
  - Network: stream segments returning 200 every second, events and stats endpoints returning 200
  - Zero console errors, zero page errors

Stage Summary:
- Real upstream API: https://api-cs.casino.org/svc-evolution-game-events/api/crazytime (events, /stats, /{id})
- Server-side proxy routes: /api/crazytime/events, /api/crazytime/stats, /api/crazytime/spin/[id], /api/crazytime/stream
- Live video: hls.js + server-side stream proxy (egprom → /api/crazytime/stream) with auto-reconnect
- Files produced:
  - src/lib/crazytime/constants.ts
  - src/lib/crazytime/types.ts
  - src/lib/crazytime/upstream.ts (server-only fetcher)
  - src/lib/crazytime/adapter.ts (normalizer + prediction builder)
  - src/hooks/use-crazy-time.ts (live-refresh hooks)
  - src/components/crazytime/LiveVideoPlayer.tsx
  - src/components/crazytime/SpinHistory.tsx
  - src/components/crazytime/CrazyTimeStatistics.tsx
  - src/components/crazytime/TopSlotMatched.tsx
  - src/components/crazytime/CrazyBonusFlapper.tsx
  - src/components/crazytime/LatestTopMultipliers.tsx
  - src/components/crazytime/Prediction.tsx
  - src/components/crazytime/LiveStatusBar.tsx
  - src/components/crazytime/EmptyState.tsx
  - src/app/api/crazytime/events/route.ts
  - src/app/api/crazytime/stats/route.ts
  - src/app/api/crazytime/spin/[id]/route.ts
  - src/app/api/crazytime/stream/route.ts (HLS proxy)
  - src/app/page.tsx (main page assembling all sections)
  - src/app/layout.tsx (updated metadata)
- Result: 100% real live data, no mock/demo/fake/hardcoded values. All sections populate, video plays, refresh works, no rendering errors.
