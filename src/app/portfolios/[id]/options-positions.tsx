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
import { MicroBadge } from "@/components/metric-card";
import { cn } from "@/lib/utils";
import { sellOptionContracts } from "../trade-actions";
import type { OptionQuote } from "@/lib/market";
import { MarketClosedBanner, useMarketOpen } from "@/components/market-gate";
import {
  Loader2,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Layers,
} from "lucide-react";

const REFRESH_MS = 30_000;
const CONTRACT_MULT = 100;

export type OpenOptionLot = {
  id: string;
  symbol: string;
  contracts: number;
  entryPremium: number;
  openedAt: string;
  contractSymbol: string;
  strike: number;
  expiration: string;
  optionType: "call" | "put";
};

export type ClosedOptionLot = OpenOptionLot & {
  closePremium: number;
  closedAt: string;
};

type AggregateOptionRow = {
  contractSymbol: string;
  underlyingSymbol: string;
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  totalContracts: number;
  avgPremium: number;
  totalEntryCost: number;
  currentPremium: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  lots: OpenOptionLot[];
};

export function OptionsPositions({
  portfolioId,
  currency,
  open,
  closed,
}: {
  portfolioId: string;
  currency: string;
  open: OpenOptionLot[];
  closed: ClosedOptionLot[];
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Record<string, OptionQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(open.length > 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sellTarget, setSellTarget] = useState<AggregateOptionRow | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [pending, startTransition] = useTransition();

  const contracts = useMemo(
    () => Array.from(new Set(open.map((p) => p.contractSymbol))),
    [open],
  );

  const market = useMarketOpen("USD");

  useEffect(() => {
    if (contracts.length === 0) {
      setQuotes({});
      setLoadingQuotes(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/options/quotes?contracts=${encodeURIComponent(contracts.join(","))}`,
        );
        const data = (await res.json()) as {
          quotes: Record<string, OptionQuote>;
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
  }, [contracts]);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const aggregateRows = useMemo<AggregateOptionRow[]>(() => {
    const byContract = new Map<string, OpenOptionLot[]>();
    for (const p of open) {
      if (!byContract.has(p.contractSymbol))
        byContract.set(p.contractSymbol, []);
      byContract.get(p.contractSymbol)!.push(p);
    }
    return Array.from(byContract.entries()).map(([contractSymbol, lots]) => {
      const sortedLots = [...lots].sort(
        (a, b) =>
          new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
      );
      const totalContracts = sortedLots.reduce((s, l) => s + l.contracts, 0);
      const totalEntryCost = sortedLots.reduce(
        (s, l) => s + l.entryPremium * l.contracts * CONTRACT_MULT,
        0,
      );
      const avgPremium =
        totalContracts !== 0
          ? totalEntryCost / (totalContracts * CONTRACT_MULT)
          : 0;
      const currentPremium = quotes[contractSymbol]?.lastPrice ?? null;
      const marketValue =
        currentPremium !== null
          ? currentPremium * totalContracts * CONTRACT_MULT
          : null;
      const unrealized =
        marketValue !== null ? marketValue - totalEntryCost : null;
      const unrealizedPct =
        unrealized !== null && totalEntryCost !== 0
          ? (unrealized / totalEntryCost) * 100
          : null;
      const first = sortedLots[0];
      return {
        contractSymbol,
        underlyingSymbol: first.symbol,
        optionType: first.optionType,
        strike: first.strike,
        expiration: first.expiration,
        totalContracts,
        avgPremium,
        totalEntryCost,
        currentPremium,
        marketValue,
        unrealized,
        unrealizedPct,
        lots: sortedLots,
      };
    });
  }, [open, quotes]);

  const sellPreview = useMemo(() => {
    if (!sellTarget) return null;
    const qty = Number(sellQty);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty))
      return null;
    if (qty > sellTarget.totalContracts) return null;
    const currentPremium = quotes[sellTarget.contractSymbol]?.lastPrice;
    if (currentPremium === undefined) return null;

    let remaining = qty;
    let proceeds = 0;
    let realized = 0;
    const affected: {
      lotId: string;
      soldContracts: number;
      entryPremium: number;
      realized: number;
      partial: boolean;
    }[] = [];

    for (const lot of sellTarget.lots) {
      if (remaining <= 0) break;
      const soldFromLot = Math.min(remaining, lot.contracts);
      const partial = soldFromLot < lot.contracts;
      const lotRealized =
        (currentPremium - lot.entryPremium) * soldFromLot * CONTRACT_MULT;
      proceeds += currentPremium * soldFromLot * CONTRACT_MULT;
      realized += lotRealized;
      remaining -= soldFromLot;
      affected.push({
        lotId: lot.id,
        soldContracts: soldFromLot,
        entryPremium: lot.entryPremium,
        realized: lotRealized,
        partial,
      });
    }

    return { proceeds, realized, affected, currentPremium };
  }, [sellTarget, sellQty, quotes]);

  if (open.length === 0 && closed.length === 0) return null;

  return (
    <>
      {/* Open options */}
      <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[15px] font-medium">Open Options</h3>
            <MicroBadge tone="muted">{aggregateRows.length}</MicroBadge>
          </div>
          {loadingQuotes && aggregateRows.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing premiums
            </span>
          )}
        </div>

        {aggregateRows.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <p className="text-[14px] text-muted-foreground">
              No open option contracts.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 mt-4 px-3 py-2 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-[13px] font-medium transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Find a contract to buy
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] md:text-[14px]">
              <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <th className="pl-4 md:pl-6 pr-3 py-2.5 font-medium">
                    Contract
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Avg Prem
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
                  const isOpen = expanded[r.contractSymbol] ?? false;
                  const expMs = new Date(r.expiration).getTime();
                  const expired = expMs < Date.now();
                  const daysToExp = Math.max(
                    0,
                    Math.round((expMs - Date.now()) / 86_400_000),
                  );
                  return (
                    <Fragment key={r.contractSymbol}>
                      <tr
                        className={cn(
                          "border-b border-white/[0.03] transition-colors cursor-pointer",
                          isOpen
                            ? "bg-white/[0.02]"
                            : "hover:bg-white/[0.015]",
                        )}
                        onClick={() =>
                          setExpanded((s) => ({
                            ...s,
                            [r.contractSymbol]: !isOpen,
                          }))
                        }
                      >
                        <td className="pl-4 md:pl-6 pr-3 py-3.5">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpanded((s) => ({
                                  ...s,
                                  [r.contractSymbol]: !isOpen,
                                }));
                              }}
                              className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-primary">
                                  {r.underlyingSymbol}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border",
                                    r.optionType === "call"
                                      ? "bg-primary/15 text-primary border-primary/30"
                                      : "bg-destructive/15 text-destructive border-destructive/30",
                                  )}
                                >
                                  {r.optionType}
                                </span>
                                <span className="text-[12px] num text-foreground">
                                  {fmt.format(r.strike)}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>
                                  exp{" "}
                                  {new Date(r.expiration).toLocaleDateString(
                                    "en-US",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                    },
                                  )}
                                </span>
                                {expired ? (
                                  <span className="text-warning inline-flex items-center gap-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Expired
                                  </span>
                                ) : daysToExp <= 3 ? (
                                  <span className="text-warning">
                                    {daysToExp}d left
                                  </span>
                                ) : (
                                  <span>{daysToExp}d left</span>
                                )}
                                <span>·</span>
                                <span>
                                  {r.lots.length} lot
                                  {r.lots.length === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right num font-medium">
                          {r.totalContracts}
                        </td>
                        <td className="px-3 py-3.5 text-right num">
                          {fmt.format(r.avgPremium)}
                        </td>
                        <td className="px-3 py-3.5 text-right num">
                          {r.currentPremium !== null ? (
                            fmt.format(r.currentPremium)
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
                          )}
                        </td>
                        <td className="pl-3 pr-4 md:pr-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSellTarget(r);
                              setSellQty(String(r.totalContracts));
                            }}
                            className="px-2.5 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-[12px] font-medium transition-colors"
                          >
                            Sell
                          </button>
                        </td>
                      </tr>

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
                                      Contracts
                                    </th>
                                    <th className="py-1.5 px-3 font-medium text-right">
                                      Entry Prem
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
                                    const cost =
                                      lot.entryPremium *
                                      lot.contracts *
                                      CONTRACT_MULT;
                                    const lotUnreal =
                                      r.currentPremium !== null
                                        ? (r.currentPremium - lot.entryPremium) *
                                          lot.contracts *
                                          CONTRACT_MULT
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
                                          {lot.contracts}
                                        </td>
                                        <td className="py-1.5 px-3 text-right num">
                                          {fmt.format(lot.entryPremium)}
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

      {/* Closed options */}
      {closed.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[15px] font-medium">Closed Options</h3>
              <MicroBadge tone="muted">{closed.length}</MicroBadge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] md:text-[14px]">
              <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <th className="px-4 md:px-6 py-2.5 font-medium">Contract</th>
                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Entry Prem
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Exit Prem
                  </th>
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
                  const realized =
                    (c.closePremium - c.entryPremium) *
                    c.contracts *
                    CONTRACT_MULT;
                  const realizedPct =
                    c.entryPremium !== 0
                      ? ((c.closePremium - c.entryPremium) / c.entryPremium) *
                        100
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
                      <td className="px-4 md:px-6 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-muted-foreground">
                            {c.symbol}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border",
                              c.optionType === "call"
                                ? "bg-primary/10 text-primary/80 border-primary/20"
                                : "bg-destructive/10 text-destructive/80 border-destructive/20",
                            )}
                          >
                            {c.optionType}
                          </span>
                          <span className="text-[12px] num text-muted-foreground">
                            {fmt.format(c.strike)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          exp{" "}
                          {new Date(c.expiration).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {c.contracts}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {fmt.format(c.entryPremium)}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {fmt.format(c.closePremium)}
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
            <AlertDialogTitle className="flex flex-wrap items-center gap-2">
              <span>Sell {sellTarget?.underlyingSymbol}</span>
              {sellTarget && (
                <>
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border",
                      sellTarget.optionType === "call"
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-destructive/15 text-destructive border-destructive/30",
                    )}
                  >
                    {sellTarget.optionType}
                  </span>
                  <span className="text-[13px] num">
                    {fmt.format(sellTarget.strike)}
                  </span>
                </>
              )}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {sellTarget && (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="opt-sell-qty" className="text-[13px]">
                    Contracts to sell (holding {sellTarget.totalContracts})
                  </Label>
                  <Input
                    id="opt-sell-qty"
                    type="text"
                    inputMode="numeric"
                    value={sellQty}
                    onChange={(e) =>
                      setSellQty(e.target.value.replace(/[^0-9]/g, ""))
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
                              ? sellTarget.totalContracts
                              : Math.max(
                                  1,
                                  Math.floor(
                                    sellTarget.totalContracts * frac,
                                  ),
                                ),
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
                        Current premium
                      </span>
                      <span className="num">
                        {fmt.format(sellPreview.currentPremium)}
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
                                {a.soldContracts} × {fmt.format(a.entryPremium)}
                              </span>
                              {a.partial && (
                                <span className="ml-1.5 text-[10px] text-warning">
                                  (partial · {lot?.contracts} held)
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "num",
                                positive
                                  ? "text-primary"
                                  : "text-destructive",
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

              {!sellPreview &&
                sellQty &&
                Number(sellQty) > sellTarget.totalContracts && (
                  <div className="text-[12px] text-destructive">
                    Cannot sell more than {sellTarget.totalContracts} contracts.
                  </div>
                )}

              <p className="text-[11px] text-muted-foreground">
                Each contract = 100 shares. FIFO — oldest lots close first.
                Final premium is fetched fresh at execution.
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
                Number(sellQty) > (sellTarget?.totalContracts ?? 0)
              }
              onClick={(e) => {
                e.preventDefault();
                if (!sellTarget) return;
                const qty = Number(sellQty);
                startTransition(async () => {
                  try {
                    const res = await sellOptionContracts({
                      portfolioId,
                      contractSymbol: sellTarget.contractSymbol,
                      contracts: qty,
                    });
                    toast.success(
                      `Sold ${res.contracts} × ${sellTarget.underlyingSymbol} ${sellTarget.optionType.toUpperCase()} ${fmt.format(sellTarget.strike)} @ ${fmt.format(res.sellPremium)} · ${res.realizedPnl >= 0 ? "+" : ""}${fmt.format(res.realizedPnl)}`,
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
    </>
  );
}
