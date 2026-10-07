"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { marketHoursStatus, type MarketCode } from "@/lib/market-hours";
import type { MarketState } from "@/lib/market";

/**
 * Ticks every 30s so a dialog left open across the open/close boundary
 * flips its Buy/Sell button without a page refresh.
 * Returns { open: true } on the first (pre-mount) render so we don't
 * emit a hydration mismatch on the disabled attribute.
 */
export function useMarketOpen(
  market: MarketCode,
  quoteState?: MarketState,
): { open: boolean; reason: string } {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { open: true, reason: "" };
  const status = marketHoursStatus(market, now);
  if (
    quoteState &&
    quoteState !== "REGULAR" &&
    quoteState !== "UNKNOWN"
  ) {
    return {
      open: false,
      reason: `${status.marketLabel} not in regular session — trades ${status.hoursLabel}, Mon–Fri`,
    };
  }
  return { open: status.open, reason: status.open ? "" : status.reason };
}

export function MarketClosedBanner({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-[13px] flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
      <div>{reason}</div>
    </div>
  );
}
