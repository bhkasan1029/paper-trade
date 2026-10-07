import type { MarketState } from "@/lib/market";

export type MarketCode = "INR" | "USD";

type MarketCfg = {
  label: string;
  timeZone: string;
  tzShort: string;
  openMin: number;
  closeMin: number;
};

const MARKETS: Record<MarketCode, MarketCfg> = {
  INR: {
    label: "NSE",
    timeZone: "Asia/Kolkata",
    tzShort: "IST",
    openMin: 9 * 60 + 15,
    closeMin: 15 * 60 + 30,
  },
  USD: {
    label: "US market",
    timeZone: "America/New_York",
    tzShort: "ET",
    openMin: 9 * 60 + 30,
    closeMin: 16 * 60,
  },
};

const IS_WEEKDAY: Record<string, boolean> = {
  Mon: true,
  Tue: true,
  Wed: true,
  Thu: true,
  Fri: true,
  Sat: false,
  Sun: false,
};

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  // en-US 24h format can emit "24" at midnight — normalize.
  if (!Number.isFinite(hour) || hour === 24) hour = 0;
  return {
    weekday: get("weekday"),
    hour,
    minute: parseInt(get("minute"), 10) || 0,
  };
}

function formatClockLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export type MarketHoursStatus = {
  open: boolean;
  marketLabel: string;
  /** Human-readable window like "9:15 AM – 3:30 PM IST" */
  hoursLabel: string;
  /** Short reason usable in a toast / banner */
  reason: string;
  weekday: string;
};

/**
 * Wall-clock check for regular trading hours. Handles weekends and DST via
 * Intl time-zone formatting. Does NOT know about market holidays — Yahoo's
 * `quote.marketState` covers those for stocks, so trade-actions checks both.
 */
export function marketHoursStatus(
  market: MarketCode,
  at: Date = new Date(),
): MarketHoursStatus {
  const cfg = MARKETS[market];
  const parts = partsInZone(at, cfg.timeZone);
  const nowMin = parts.hour * 60 + parts.minute;
  const isWeekday = IS_WEEKDAY[parts.weekday] === true;
  const open =
    isWeekday && nowMin >= cfg.openMin && nowMin < cfg.closeMin;

  const hoursLabel = `${formatClockLabel(cfg.openMin)} – ${formatClockLabel(cfg.closeMin)} ${cfg.tzShort}`;

  let reason: string;
  if (open) {
    reason = `${cfg.label} open`;
  } else if (!isWeekday) {
    reason = `${cfg.label} closed (${parts.weekday}) — trades ${hoursLabel}, Mon–Fri`;
  } else if (nowMin < cfg.openMin) {
    reason = `${cfg.label} closed — opens today at ${formatClockLabel(cfg.openMin)} ${cfg.tzShort}`;
  } else {
    reason = `${cfg.label} closed for the day — reopens tomorrow at ${formatClockLabel(cfg.openMin)} ${cfg.tzShort}`;
  }

  return {
    open,
    marketLabel: cfg.label,
    hoursLabel,
    reason,
    weekday: parts.weekday,
  };
}

/**
 * Combined check: use Yahoo's `marketState` when we have it (inherits holidays)
 * and additionally require the wall-clock window. Returns { allowed, reason }.
 */
export function canTradeNow(
  market: MarketCode,
  quoteMarketState?: MarketState,
  at: Date = new Date(),
): { allowed: boolean; reason: string } {
  const wall = marketHoursStatus(market, at);
  if (quoteMarketState && quoteMarketState !== "REGULAR" && quoteMarketState !== "UNKNOWN") {
    // Yahoo says pre/post/closed — respect it verbatim, blocks holidays too.
    return {
      allowed: false,
      reason: `${wall.marketLabel} not in regular session — trades ${wall.hoursLabel}, Mon–Fri`,
    };
  }
  return { allowed: wall.open, reason: wall.reason };
}
