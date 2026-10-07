# PaperTrade — Important Rules & Preferences

This file records decisions, rules, and preferences I want Claude to remember and follow when working on this project. Update as we go.

---

## 🚫 Do NOT touch these cards

The three dashboard metric cards below stay **visual-only, dummy placeholders**. Do not connect them to real data, do not add logic, do not compute anything for them, do not modify their sub-text without asking.

- **Unrealized Net P&L** — keep as `—` with "Neutral" badge and "Coming in Part 3" sub
- **Buying Power** — keep as `—` with "1.0×" badge and "Coming in Part 3" sub
- **Exposure Telemetry** — keep as `—` with "0 Positions" badge and "Coming in Part 3" sub

They exist purely so the dashboard grid looks complete. Only the **Total Paper Capital** card (leftmost) is wired to real DB data.

---

## ✅ What's actually working right now (Phase 1, end of Part 2)

- Portfolio CRUD (create / rename / reset cash / delete) — real Postgres
- Notes CRUD inside portfolio, split between **Portfolio notes** and **Stock notes** (per-ticker), with filter chips
- Sidebar "Paper Capital" total — real sum from DB
- Dashboard "Total Paper Capital" card — real sum from DB
- Dashboard "Your Portfolios" strip — real portfolio cards
- Health endpoint `/api/health` — pings Postgres

---

## 🟡 What's placeholder / decoration only

- The three cards above (Unrealized P&L, Buying Power, Exposure Telemetry)
- Top-bar ⌘K search input (disabled)
- Time range switcher (1D/1W/1M/YTD/ALL) — clickable but doesn't filter
- "ENGINE ONLINE" status banner
- `/search` page — placeholder
- `/history` (Order History) page — placeholder
- Portfolio detail "Overview" tab — placeholder

> Note: several items above (search, history, Overview tab) are no longer placeholder as of Parts 3–5. Keep this list in sync when you touch them.

---

## 🏗️ Rules I want followed

1. **Mobile-first, always responsive.** I use this on my phone. Every new layout, page, dialog, table, chart, or component must work at ~360–414px width without horizontal scroll or overflow. Prefer `flex-col md:flex-row`, responsive font sizes (`text-[24px] md:text-[36px]`), wrap/scroll long control rows, use `hidden lg:block` / `lg:hidden` when a desktop-only element doesn't fit. Never add a fixed pixel width that assumes a laptop viewport. Hover-only affordances (`opacity-0 group-hover:opacity-100`) must have a mobile fallback.
2. **Don't add features I didn't ask for.** No feature-flag scaffolding, no "future-proofing" abstractions I didn't request. Bug-fix or feature-only.
3. **Don't spin up authentication** — this is single-user, local.
4. **Currency default is INR** with the Indian lakh grouping (₹10,00,000 not ₹1,000,000). US portfolios are supported per-portfolio.
5. **Yahoo Finance is the data source** for Phase 1 (US + Indian stocks + US options). Wrap it behind a `MarketDataProvider` interface so Phase 2 (Finnhub WS) and Phase 3 (Dhan/Upstox) can swap in cleanly.
6. **Postgres is local** (`postgresql@17` via Homebrew, database `papertrade`, user `apple`, port 5432). Neon later.
7. **No commenting on obvious code.** Only WHY-comments for non-obvious constraints.
8. **Prisma 6 only** — do not upgrade to Prisma 8-RC (breaking CLI changes I don't want to relearn).
9. **shadcn/ui + Tailwind** for all components. No other component library.

---

## 📋 Roadmap

**Phase 1 — Polling (in progress)**
- Part 1 ✅ Foundation (Next.js + Postgres + shell UI)
- Part 2 ✅ Portfolios CRUD + notes
- Part 3 ✅ Yahoo Finance data layer + ticker search + live prices + charts
- Part 4 ✅ Stock trading (buy/sell, FIFO partial sells, aggregated positions w/ expandable lots, real Order History)
- Part 5 ✅ Options trading (US only via Yahoo — chain browse, buy contracts, FIFO sell-to-close, live premium refresh, options in Positions + Order History)

**Trading model (as of Part 5):**
- Positions aggregate by symbol (stocks) / contractSymbol (options) — shows avg cost + total qty
- Individual lots stored in DB, expandable in the UI (click chevron)
- Sells use FIFO — partial sells split the oldest lot(s) automatically
- Options: 1 contract = 100 shares; cash = premium × 100 × contracts; only BUY-TO-OPEN + SELL-TO-CLOSE
- Currency check on buy: option contracts settle in USD → require a USD portfolio
- All P&L computed lot-by-lot at close time; realized/unrealized flow through Postgres

**Phase 2 — Real-time (later)**
- Custom `server.js` + Finnhub WebSocket + SSE to browser

**Phase 3 — Optional (later)**
- Dhan / Upstox WebSocket for Indian live data

---

## 🗂️ File map (as of now)

```
src/
├── app/
│   ├── page.tsx                          Dashboard (real capital, dummy 3 cards)
│   ├── layout.tsx                        Root layout w/ sidebar + top bar
│   ├── globals.css                       Dark theme, emerald tokens, INR utilities
│   ├── api/health/route.ts               Postgres ping
│   ├── api/quote/route.ts                Single stock quote
│   ├── api/quotes/route.ts               Batch stock quotes (positions refresh)
│   ├── api/history/route.ts              Price history for charts
│   ├── api/search/route.ts               Ticker search
│   ├── api/options/chain/route.ts        Options chain for a symbol
│   ├── api/options/quotes/route.ts       Batch option premiums (positions refresh)
│   ├── portfolios/
│   │   ├── page.tsx                      List all portfolios
│   │   ├── actions.ts                    create/rename/updateCash/delete
│   │   ├── new-portfolio-dialog.tsx      Create dialog
│   │   ├── trade-actions.ts              openStockPosition / sellShares / openOptionPosition / sellOptionContracts
│   │   └── [id]/
│   │       ├── page.tsx                  Detail w/ tabs
│   │       ├── portfolio-header.tsx      Rename / reset cash / delete menu
│   │       ├── notes-actions.ts          Note CRUD server actions
│   │       ├── notes-panel.tsx           Notes tab UI (portfolio vs stock split)
│   │       ├── positions-panel.tsx       Stock positions (aggregated, FIFO sell)
│   │       └── options-positions.tsx     Option positions (aggregated, FIFO sell)
│   ├── search/
│   │   ├── page.tsx                      Live quote + chart + options chain
│   │   ├── quote-card.tsx                Hero quote + BuyDialog
│   │   ├── buy-dialog.tsx                Stock buy modal
│   │   ├── price-chart.tsx               Lightweight-charts price panel
│   │   ├── options-chain.tsx             Expiry picker + strike table
│   │   └── option-buy-dialog.tsx         Option buy modal (100× multiplier)
│   └── history/page.tsx                  Real Order History (stocks + options)
├── components/
│   ├── sidebar.tsx                       Server component, reads DB
│   ├── sidebar-nav.tsx                   Client nav links
│   ├── top-search.tsx                    Disabled ⌘K search
│   ├── metric-card.tsx                   MetricCard + MicroBadge
│   ├── status-banner.tsx                 "ENGINE ONLINE" banner
│   ├── time-range-switcher.tsx           1D/1W/1M/YTD/ALL (visual only)
│   └── ui/                               shadcn components
├── lib/
│   ├── db.ts                             Prisma singleton
│   ├── currency.ts                       INR/USD formatting w/ Indian grouping
│   └── utils.ts                          shadcn cn helper
└── prisma/schema.prisma                  Portfolio, Trade, Note models
```
