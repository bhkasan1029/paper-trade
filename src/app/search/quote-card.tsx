"use client";

import { useEffect, useState } from "react";
import { MetricCard, MicroBadge } from "@/components/metric-card";
import { cn } from "@/lib/utils";
import type { MarketQuote } from "@/lib/market";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { BuyDialog, type PortfolioOption } from "./buy-dialog";
import { useRecentSymbols } from "@/lib/use-recent-symbols";

const REFRESH_MS = 20_000;

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function formatNum(n: number | undefined) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function QuoteCard({
  symbol,
  portfolios,
}: {
  symbol: string;
  portfolios: PortfolioOption[];
}) {
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { push: pushRecent } = useRecentSymbols();

  // Record the view once per symbol load so it shows up in ⌘K + search page
  useEffect(() => {
    if (!quote) return;
    pushRecent({
      symbol: quote.symbol,
      name: quote.shortName,
      exchange: quote.exchange,
    });
    // pushRecent is stable (useCallback), quote is the trigger
  }, [quote, pushRecent]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/quote?symbol=${encodeURIComponent(symbol)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as MarketQuote;
        if (!cancelled) {
          setQuote(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  if (loading && !quote) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 md:p-6 flex items-center gap-3 text-[14px] md:text-[15px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading {symbol}…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <MicroBadge tone="negative">Error</MicroBadge>
          <span className="font-medium text-[14px] md:text-[15px]">Couldn&apos;t load {symbol}</span>
        </div>
        <p className="text-[12px] md:text-[13px] text-muted-foreground break-words">{error}</p>
      </div>
    );
  }

  if (!quote) return null;

  const positive = quote.change >= 0;

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[12px] tracking-wider font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
                {quote.symbol}
              </span>
              <MicroBadge tone={marketBadgeTone(quote.marketState)}>
                {marketBadgeLabel(quote.marketState)}
              </MicroBadge>
              {quote.exchange && (
                <span className="text-[12px] text-muted-foreground">
                  {quote.exchange}
                </span>
              )}
            </div>
            <div className="text-[16px] md:text-[20px] font-medium break-words">{quote.shortName}</div>
          </div>
          <div className="md:text-right">
            <div className="num text-[30px] md:text-[44px] font-semibold tracking-tight leading-none break-all">
              {formatMoney(quote.price, quote.currency)}
            </div>
            <div
              className={cn(
                "num text-[13px] md:text-[15px] mt-2 flex items-center md:justify-end gap-1.5",
                positive ? "text-positive" : "text-destructive",
              )}
            >
              {positive ? (
                <TrendingUp className="h-4 w-4 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0" />
              )}
              <span className="break-all">
                {positive ? "+" : ""}
                {formatMoney(quote.change, quote.currency)} (
                {positive ? "+" : ""}
                {quote.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Day High"
          value={
            quote.dayHigh !== undefined
              ? formatMoney(quote.dayHigh, quote.currency)
              : "—"
          }
          sub="Session high"
        />
        <MetricCard
          label="Day Low"
          value={
            quote.dayLow !== undefined
              ? formatMoney(quote.dayLow, quote.currency)
              : "—"
          }
          sub="Session low"
        />
        <MetricCard
          label="52W High"
          value={
            quote.fiftyTwoWeekHigh !== undefined
              ? formatMoney(quote.fiftyTwoWeekHigh, quote.currency)
              : "—"
          }
          sub="52-week high"
        />
        <MetricCard
          label="52W Low"
          value={
            quote.fiftyTwoWeekLow !== undefined
              ? formatMoney(quote.fiftyTwoWeekLow, quote.currency)
              : "—"
          }
          sub="52-week low"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[11px] md:text-[12px] text-muted-foreground">
          <span>
            Volume{" "}
            <span className="text-foreground num ml-1">
              {formatNum(quote.volume)}
            </span>
          </span>
          <span>
            Updated{" "}
            <span className="text-foreground num ml-1">
              {new Date(quote.fetchedAt).toLocaleTimeString()}
            </span>{" "}
            · refreshing every 20s
          </span>
        </div>
        <BuyDialog quote={quote} portfolios={portfolios} />
      </div>
    </div>
  );
}

function marketBadgeTone(
  state: MarketQuote["marketState"],
): "primary" | "muted" | "warning" | "negative" {
  if (state === "REGULAR") return "primary";
  if (state === "PRE" || state === "POST") return "warning";
  if (state === "CLOSED") return "muted";
  return "muted";
}

function marketBadgeLabel(state: MarketQuote["marketState"]): string {
  switch (state) {
    case "REGULAR":
      return "● Open";
    case "PRE":
      return "Pre-market";
    case "POST":
      return "After-hours";
    case "CLOSED":
      return "Closed";
    default:
      return "Unknown";
  }
}
