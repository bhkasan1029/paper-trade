"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard, MicroBadge } from "@/components/metric-card";
import { cn } from "@/lib/utils";
import { sellShares } from "../trade-actions";
import type { MarketQuote } from "@/lib/market";
import { MarketClosedBanner, useMarketOpen } from "@/components/market-gate";
import type { MarketCode } from "@/lib/market-hours";
import {
  OptionsPositions,
  type OpenOptionLot,
  type ClosedOptionLot,
} from "./options-positions";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const REFRESH_MS = 20_000;

export type OpenPosition = {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  openedAt: string;
};

export type ClosedPosition = OpenPosition & {
  closePrice: number;
  closedAt: string;
};

type AggregateRow = {
  symbol: string;
  totalQty: number;
  avgCost: number;
  totalEntryValue: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  lots: OpenPosition[];
};

export function PositionsPanel({
  portfolioId,
  currency,
  open,
  closed,
  openOptions,
  closedOptions,
}: {
  portfolioId: string;
  currency: string;
  open: OpenPosition[];
  closed: ClosedPosition[];
  openOptions: OpenOptionLot[];
  closedOptions: ClosedOptionLot[];
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(open.length > 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sellTarget, setSellTarget] = useState<AggregateRow | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [pending, startTransition] = useTransition();

  const symbols = useMemo(
    () => Array.from(new Set(open.map((p) => p.symbol))),
    [open],
  );

  useEffect(() => {
    if (symbols.length === 0) {
      setQuotes({});
      setLoadingQuotes(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`,
        );
        const data = (await res.json()) as {
          quotes: Record<string, MarketQuote>;
        };
        if (!cancelled) setQuotes(data.quotes ?? {});
      } catch {
        // best effort
      } finally {
        if (!cancelled) setLoadingQuotes(false);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols]);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  // Aggregate open lots by symbol
  const aggregateRows = useMemo<AggregateRow[]>(() => {
    const bySymbol = new Map<string, OpenPosition[]>();
    for (const p of open) {
      if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
      bySymbol.get(p.symbol)!.push(p);
    }
    return Array.from(bySymbol.entries()).map(([symbol, lots]) => {
      const sortedLots = [...lots].sort(
        (a, b) =>
          new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
      );
      const totalQty = sortedLots.reduce((s, l) => s + l.quantity, 0);
      const totalEntryValue = sortedLots.reduce(
        (s, l) => s + l.entryPrice * l.quantity,
        0,
      );
      const avgCost = totalQty !== 0 ? totalEntryValue / totalQty : 0;
      const currentPrice = quotes[symbol]?.price ?? null;
      const marketValue =
        currentPrice !== null ? currentPrice * totalQty : null;
      const unrealized =
        marketValue !== null ? marketValue - totalEntryValue : null;
      const unrealizedPct =
        unrealized !== null && totalEntryValue !== 0
          ? (unrealized / totalEntryValue) * 100
          : null;
      return {
        symbol,
        totalQty,
        avgCost,
        totalEntryValue,
        currentPrice,
        marketValue,
        unrealized,
        unrealizedPct,
        lots: sortedLots,
      };
    });
  }, [open, quotes]);

  const totalUnrealized = aggregateRows.reduce(
    (s, r) => s + (r.unrealized ?? 0),
    0,
  );
  const totalMarketValue = aggregateRows.reduce(
    (s, r) => s + (r.marketValue ?? r.totalEntryValue),
    0,
  );
  const totalRealized = closed.reduce(
    (s, c) => s + (c.closePrice - c.entryPrice) * c.quantity,
    0,
  );

  // FIFO preview for sell dialog
  const sellPreview = useMemo(() => {
    if (!sellTarget) return null;
    const qty = Number(sellQty);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    if (qty > sellTarget.totalQty) return null;
    const currentPrice = quotes[sellTarget.symbol]?.price;
    if (currentPrice === undefined) return null;

    let remaining = qty;
    let proceeds = 0;
    let realized = 0;
    const affected: {
      lotId: string;
      soldQty: number;
      entryPrice: number;
      realized: number;
      partial: boolean;
    }[] = [];

    for (const lot of sellTarget.lots) {
      if (remaining <= 0) break;
      const soldFromLot = Math.min(remaining, lot.quantity);
      const partial = soldFromLot < lot.quantity;
      const lotRealized = (currentPrice - lot.entryPrice) * soldFromLot;
      proceeds += currentPrice * soldFromLot;
      realized += lotRealized;
      remaining -= soldFromLot;
      affected.push({
        lotId: lot.id,
        soldQty: soldFromLot,
        entryPrice: lot.entryPrice,
        realized: lotRealized,
        partial,
      });
    }

    return { proceeds, realized, affected, currentPrice };
  }, [sellTarget, sellQty, quotes]);

  const sellQuoteState = sellTarget
    ? quotes[sellTarget.symbol]?.marketState
    : undefined;
  const market = useMarketOpen(currency as MarketCode, sellQuoteState);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 md:gap-4 sm:grid-cols-3">
        <MetricCard
          label="Market Value"
          value={fmt.format(totalMarketValue)}
          accent="primary"
          sub={`${aggregateRows.length} position${aggregateRows.length === 1 ? "" : "s"} · ${open.length} lot${open.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Unrealized P&L"
          value={
            <span
              className={
                totalUnrealized === 0
                  ? ""
                  : totalUnrealized > 0
                    ? "text-primary"
                    : "text-destructive"
              }
            >
              {totalUnrealized >= 0 ? "+" : ""}
              {fmt.format(totalUnrealized)}
            </span>
          }
          sub="Live across all open positions"
        />
        <MetricCard
          label="Realized P&L"
          value={
            <span
              className={
                totalRealized === 0
                  ? ""
                  : totalRealized > 0
                    ? "text-primary"
                    : "text-destructive"
              }
            >
              {totalRealized >= 0 ? "+" : ""}
              {fmt.format(totalRealized)}
            </span>
          }
          sub={`${closed.length} closed lot${closed.length === 1 ? "" : "s"}`}
        />
      </div>

      {/* Open positions — aggregated */}
      <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-medium">Open Positions</h3>
            <MicroBadge tone="muted">{aggregateRows.length}</MicroBadge>
          </div>
          {loadingQuotes && aggregateRows.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing prices
            </span>
          )}
        </div>

        {aggregateRows.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <p className="text-[14px] text-muted-foreground">
              No open positions.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 mt-4 px-3 py-2 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-[13px] font-medium transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Find something to buy
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] md:text-[14px]">
              <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <th className="pl-4 md:pl-6 pr-3 py-2.5 font-medium">
                    Symbol
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Avg Cost
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">LTP</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Mkt Value
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Unrealized
                  </th>
                  <th className="pl-3 pr-4 md:pr-6 py-2.5 font-medium text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregateRows.map((r) => {
                  const positive = (r.unrealized ?? 0) >= 0;
                  const isOpen = expanded[r.symbol] ?? false;
                  return (
                    <Fragment key={r.symbol}>
                      <tr
                        className={cn(
                          "border-b border-white/[0.03] transition-colors cursor-pointer",
                          isOpen ? "bg-white/[0.02]" : "hover:bg-white/[0.015]",
                        )}
                        onClick={() =>
                          setExpanded((s) => ({
                            ...s,
                            [r.symbol]: !isOpen,
                          }))
                        }
                      >
                        <td className="pl-4 md:pl-6 pr-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpanded((s) => ({
                                  ...s,
                                  [r.symbol]: !isOpen,
                                }));
                              }}
                              className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <div>
                              <Link
                                href={`/search?symbol=${encodeURIComponent(r.symbol)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold text-primary hover:underline underline-offset-2 decoration-primary/40"
                              >
                                {r.symbol}
                              </Link>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {r.lots.length} lot{r.lots.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right num font-medium">
                          {r.totalQty}
                        </td>
                        <td className="px-3 py-3.5 text-right num">
                          {fmt.format(r.avgCost)}
                        </td>
                        <td className="px-3 py-3.5 text-right num">
                          {r.currentPrice !== null ? (
                            fmt.format(r.currentPrice)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right num">
                          {r.marketValue !== null ? (
                            fmt.format(r.marketValue)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3.5 text-right num font-medium",
                            r.unrealized === null
                              ? ""
                              : positive
                                ? "text-primary"
                                : "text-destructive",
                          )}
                        >
                          {r.unrealized === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {positive ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              <span>
                                {positive ? "+" : ""}
                                {fmt.format(r.unrealized)}
                                {r.unrealizedPct !== null && (
                                  <span className="text-[11px] ml-1 opacity-70">
                                    ({positive ? "+" : ""}
                                    {r.unrealizedPct.toFixed(2)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="pl-3 pr-4 md:pr-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSellTarget(r);
                              setSellQty(String(r.totalQty));
                            }}
                            className="px-2.5 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-[12px] font-medium transition-colors"
                          >
                            Sell
                          </button>
                        </td>
                      </tr>

                      {/* Expanded: individual lots */}
                      {isOpen && (
                        <tr className="bg-background/40 border-b border-white/[0.04]">
                          <td colSpan={7} className="px-0 py-0">
                            <div className="px-4 md:px-6 py-3">
                              <div className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-2 font-medium">
                                Lot breakdown · oldest first (FIFO on sell)
                              </div>
                              <table className="w-full text-[12px] md:text-[13px]">
                                <thead>
                                  <tr className="text-left text-[10px] tracking-wider uppercase text-muted-foreground/70">
                                    <th className="py-1.5 pr-3 font-medium">
                                      Opened
                                    </th>
                                    <th className="py-1.5 px-3 font-medium text-right">
                                      Qty
                                    </th>
                                    <th className="py-1.5 px-3 font-medium text-right">
                                      Entry
                                    </th>
                                    <th className="py-1.5 px-3 font-medium text-right">
                                      Cost
                                    </th>
                                    <th className="py-1.5 pl-3 font-medium text-right">
                                      Unrealized
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.lots.map((lot) => {
                                    const cost = lot.entryPrice * lot.quantity;
                                    const lotUnreal =
                                      r.currentPrice !== null
                                        ? (r.currentPrice - lot.entryPrice) *
                                          lot.quantity
                                        : null;
                                    const positive = (lotUnreal ?? 0) >= 0;
                                    return (
                                      <tr
                                        key={lot.id}
                                        className="border-t border-white/[0.03]"
                                      >
                                        <td className="py-1.5 pr-3 text-muted-foreground">
                                          {new Date(
                                            lot.openedAt,
                                          ).toLocaleDateString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "2-digit",
                                          })}
                                        </td>
                                        <td className="py-1.5 px-3 text-right num">
                                          {lot.quantity}
                                        </td>
                                        <td className="py-1.5 px-3 text-right num">
                                          {fmt.format(lot.entryPrice)}
                                        </td>
                                        <td className="py-1.5 px-3 text-right num text-muted-foreground">
                                          {fmt.format(cost)}
                                        </td>
                                        <td
                                          className={cn(
                                            "py-1.5 pl-3 text-right num",
                                            lotUnreal === null
                                              ? "text-muted-foreground"
                                              : positive
                                                ? "text-primary"
                                                : "text-destructive",
                                          )}
                                        >
                                          {lotUnreal === null ? (
                                            "—"
                                          ) : (
                                            <>
                                              {positive ? "+" : ""}
                                              {fmt.format(lotUnreal)}
                                            </>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed positions */}
      {closed.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-medium">Closed Positions</h3>
              <MicroBadge tone="muted">{closed.length}</MicroBadge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] md:text-[14px]">
              <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <th className="px-4 md:px-6 py-2.5 font-medium">Symbol</th>
                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-3 py-2.5 font-medium text-right">Entry</th>
                  <th className="px-3 py-2.5 font-medium text-right">Exit</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Realized
                  </th>
                  <th className="px-4 md:px-6 py-2.5 font-medium text-right">
                    Held
                  </th>
                </tr>
              </thead>
              <tbody>
                {closed.map((c) => {
                  const realized = (c.closePrice - c.entryPrice) * c.quantity;
                  const realizedPct =
                    c.entryPrice !== 0
                      ? ((c.closePrice - c.entryPrice) / c.entryPrice) * 100
                      : 0;
                  const positive = realized >= 0;
                  const days = Math.max(
                    1,
                    Math.round(
                      (new Date(c.closedAt).getTime() -
                        new Date(c.openedAt).getTime()) /
                        86_400_000,
                    ),
                  );
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/[0.03] last:border-b-0"
                    >
                      <td className="px-4 md:px-6 py-3 font-semibold text-muted-foreground">
                        {c.symbol}
                      </td>
                      <td className="px-3 py-3 text-right num">{c.quantity}</td>
                      <td className="px-3 py-3 text-right num">
                        {fmt.format(c.entryPrice)}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {fmt.format(c.closePrice)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right num",
                          positive ? "text-primary" : "text-destructive",
                        )}
                      >
                        {positive ? "+" : ""}
                        {fmt.format(realized)}
                        <span className="text-[11px] ml-1 opacity-70">
                          ({positive ? "+" : ""}
                          {realizedPct.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right text-muted-foreground text-[12px]">
                        {days}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options */}
      <OptionsPositions
        portfolioId={portfolioId}
        currency={currency}
        open={openOptions}
        closed={closedOptions}
      />

      {/* Sell dialog */}
      <AlertDialog
        open={!!sellTarget}
        onOpenChange={(o) => {
          if (!o) {
            setSellTarget(null);
            setSellQty("");
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Sell {sellTarget?.symbol}</AlertDialogTitle>
          </AlertDialogHeader>
          {sellTarget && (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sell-qty" className="text-[13px]">
                    Quantity to sell (holding {sellTarget.totalQty})
                  </Label>
                  <Input
                    id="sell-qty"
                    type="text"
                    inputMode="decimal"
                    value={sellQty}
                    onChange={(e) =>
                      setSellQty(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    autoFocus
                  />
                </div>
                <div className="flex gap-1">
                  {[0.25, 0.5, 0.75, 1].map((frac) => (
                    <button
                      key={frac}
                      type="button"
                      onClick={() =>
                        setSellQty(
                          String(
                            frac === 1
                              ? sellTarget.totalQty
                              : Math.floor(sellTarget.totalQty * frac) || 1,
                          ),
                        )
                      }
                      className="px-2 py-1.5 rounded text-[11px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                    >
                      {frac === 1 ? "MAX" : `${frac * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              {sellPreview && (
                <>
                  <div className="rounded-md border border-white/[0.06] bg-background/40 p-3 space-y-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Current price
                      </span>
                      <span className="num">
                        {fmt.format(sellPreview.currentPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Proceeds</span>
                      <span className="num font-medium">
                        {fmt.format(sellPreview.proceeds)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-1.5">
                      <span className="text-muted-foreground">
                        Realized P&L
                      </span>
                      <span
                        className={cn(
                          "num font-medium",
                          sellPreview.realized >= 0
                            ? "text-primary"
                            : "text-destructive",
                        )}
                      >
                        {sellPreview.realized >= 0 ? "+" : ""}
                        {fmt.format(sellPreview.realized)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-2 font-medium">
                      FIFO breakdown
                    </div>
                    <div className="rounded-md border border-white/[0.06] bg-background/40 divide-y divide-white/[0.05]">
                      {sellPreview.affected.map((a, i) => {
                        const lot = sellTarget.lots.find(
                          (l) => l.id === a.lotId,
                        );
                        const positive = a.realized >= 0;
                        return (
                          <div
                            key={a.lotId + i}
                            className="flex items-center justify-between px-3 py-2 text-[12px]"
                          >
                            <div>
                              <span className="text-muted-foreground">
                                Lot #{i + 1}
                              </span>{" "}
                              <span className="text-foreground">
                                {a.soldQty} × {fmt.format(a.entryPrice)}
                              </span>
                              {a.partial && (
                                <span className="ml-1.5 text-[10px] text-warning">
                                  (partial · {lot?.quantity} held)
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "num",
                                positive ? "text-primary" : "text-destructive",
                              )}
                            >
                              {positive ? "+" : ""}
                              {fmt.format(a.realized)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {!sellPreview && sellQty && Number(sellQty) > sellTarget.totalQty && (
                <div className="text-[12px] text-destructive">
                  Cannot sell more than {sellTarget.totalQty} shares.
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                India defaults to FIFO — oldest lots close first. Final price is
                fetched fresh at execution.
              </p>

              <MarketClosedBanner reason={market.reason} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                pending ||
                !sellPreview ||
                !sellTarget ||
                !market.open ||
                Number(sellQty) <= 0 ||
                Number(sellQty) > (sellTarget?.totalQty ?? 0)
              }
              onClick={(e) => {
                e.preventDefault();
                if (!sellTarget) return;
                const qty = Number(sellQty);
                startTransition(async () => {
                  try {
                    const res = await sellShares({
                      portfolioId,
                      symbol: sellTarget.symbol,
                      quantity: qty,
                    });
                    toast.success(
                      `Sold ${res.quantity} × ${res.symbol} @ ${fmt.format(res.sellPrice)} · ${res.realizedPnl >= 0 ? "+" : ""}${fmt.format(res.realizedPnl)}`,
                    );
                    setSellTarget(null);
                    setSellQty("");
                    router.refresh();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Sell failed",
                    );
                  }
                });
              }}
            >
              {pending
                ? "Selling…"
                : !market.open
                  ? "Market closed"
                  : "Confirm Sell"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
