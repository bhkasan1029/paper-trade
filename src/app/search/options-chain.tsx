"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MicroBadge } from "@/components/metric-card";
import { Loader2, Layers, TrendingUp, TrendingDown } from "lucide-react";
import type { OptionContract, OptionsChain } from "@/lib/market";
import { OptionBuyDialog } from "./option-buy-dialog";
import type { PortfolioOption } from "./buy-dialog";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function daysUntil(ms: number): number {
  return Math.max(0, Math.round((ms - Date.now()) / 86_400_000));
}

export function OptionsChain({
  symbol,
  portfolios,
}: {
  symbol: string;
  portfolios: PortfolioOption[];
}) {
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExp, setSelectedExp] = useState<number | null>(null);
  const [side, setSide] = useState<"calls" | "puts">("calls");
  const [buyTarget, setBuyTarget] = useState<OptionContract | null>(null);
  const requestedExpRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChain(null);
    setSelectedExp(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/options/chain?symbol=${encodeURIComponent(symbol)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as OptionsChain;
        if (!cancelled) {
          setChain(data);
          setSelectedExp(data.selected.expiration);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Refetch when expiry changes
  useEffect(() => {
    if (!chain || selectedExp == null) return;
    if (chain.selected.expiration === selectedExp) return;
    if (requestedExpRef.current === selectedExp) return;
    requestedExpRef.current = selectedExp;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiration=${selectedExp}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as OptionsChain;
        if (!cancelled) {
          setChain(data);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExp, chain, symbol]);

  const fmt = useMemo(() => {
    const currency = chain?.currency ?? "USD";
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
  }, [chain?.currency]);

  const rows = useMemo(() => {
    if (!chain) return [];
    return side === "calls" ? chain.selected.calls : chain.selected.puts;
  }, [chain, side]);

  // Sort by strike; find row closest to spot for ATM highlight + scroll
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.strike - b.strike),
    [rows],
  );

  const atmIndex = useMemo(() => {
    if (!chain || sortedRows.length === 0) return -1;
    let best = 0;
    let diff = Infinity;
    sortedRows.forEach((r, i) => {
      const d = Math.abs(r.strike - chain.underlyingPrice);
      if (d < diff) {
        diff = d;
        best = i;
      }
    });
    return best;
  }, [sortedRows, chain]);

  // Silent for symbols with no chain (e.g. Indian tickers via Yahoo)
  if (error) {
    if (
      /no options|not found|not_found/i.test(error) ||
      error.includes("HTTP 404")
    ) {
      return null;
    }
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <MicroBadge tone="negative">Error</MicroBadge>
          <span className="font-medium text-[14px]">
            Couldn&apos;t load options
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground break-words">{error}</p>
      </div>
    );
  }

  if (loading && !chain) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 md:p-6 flex items-center gap-3 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading options chain…
      </div>
    );
  }

  if (!chain) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[15px] font-medium">Options chain</h3>
          <MicroBadge tone="muted">
            spot {fmt.format(chain.underlyingPrice)}
          </MicroBadge>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Calls / Puts toggle */}
        <div className="inline-flex rounded-md border border-white/[0.06] overflow-hidden self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSide("calls")}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium transition-colors",
              side === "calls"
                ? "bg-black/10 text-black font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]",
            )}
          >
            <TrendingUp className="h-3 w-3 inline mr-1" />
            Calls
          </button>
          <button
            type="button"
            onClick={() => setSide("puts")}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium border-l border-white/[0.06] transition-colors",
              side === "puts"
                ? "bg-destructive/15 text-destructive"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]",
            )}
          >
            <TrendingDown className="h-3 w-3 inline mr-1" />
            Puts
          </button>
        </div>
      </div>

      {/* Expiry picker */}
      <div className="px-4 md:px-6 py-3 border-b border-white/[0.06] flex gap-1.5 overflow-x-auto scrollbar-thin">
        {chain.expirations.map((exp) => {
          const active = exp === selectedExp;
          const days = daysUntil(exp);
          return (
            <button
              key={exp}
              type="button"
              onClick={() => setSelectedExp(exp)}
              className={cn(
                "shrink-0 px-2.5 py-1.5 rounded text-[12px] border transition-colors flex items-baseline gap-1.5",
                active
                  ? "bg-black/10 text-black font-semibold border-black/20"
                  : "bg-white/[0.02] text-muted-foreground border-white/[0.06] hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              <span>{fmtDate(exp)}</span>
              <span
                className={cn(
                  "text-[10px]",
                  active ? "opacity-70" : "opacity-60",
                )}
              >
                {days}d
              </span>
            </button>
          );
        })}
      </div>

      {/* Strike table */}
      {sortedRows.length === 0 ? (
        <div className="p-6 md:p-8 text-center text-[13px] text-muted-foreground">
          No {side} available for this expiry.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="w-full text-[12px] md:text-[13px]">
            <thead className="text-left text-[10px] tracking-wider uppercase text-muted-foreground sticky top-0 bg-card z-10">
              <tr className="border-b border-white/[0.04]">
                <th className="pl-4 md:pl-6 pr-3 py-2 font-medium">Strike</th>
                <th className="px-2 py-2 font-medium text-right">Bid</th>
                <th className="px-2 py-2 font-medium text-right">Ask</th>
                <th className="px-2 py-2 font-medium text-right">Last</th>
                <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">
                  Vol
                </th>
                <th className="px-2 py-2 font-medium text-right hidden md:table-cell">
                  OI
                </th>
                <th className="px-2 py-2 font-medium text-right hidden md:table-cell">
                  IV
                </th>
                <th className="pl-2 pr-4 md:pr-6 py-2 font-medium text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((c, i) => {
                const isAtm = i === atmIndex;
                const inTheMoney = c.inTheMoney;
                return (
                  <tr
                    key={c.contractSymbol}
                    className={cn(
                      "border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]",
                      isAtm && "bg-primary/[0.04]",
                    )}
                  >
                    <td
                      className={cn(
                        "pl-4 md:pl-6 pr-3 py-2 num font-medium",
                        inTheMoney && "text-positive",
                        !inTheMoney && "text-muted-foreground",
                      )}
                    >
                      {fmt.format(c.strike)}
                      {isAtm && (
                        <span className="ml-1.5 text-[9px] tracking-wider uppercase text-primary/80">
                          ATM
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right num text-muted-foreground">
                      {c.bid != null ? fmt.format(c.bid) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right num text-muted-foreground">
                      {c.ask != null ? fmt.format(c.ask) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right num">
                      {c.lastPrice > 0 ? (
                        fmt.format(c.lastPrice)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right num text-muted-foreground hidden sm:table-cell">
                      {c.volume != null
                        ? c.volume.toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right num text-muted-foreground hidden md:table-cell">
                      {c.openInterest != null
                        ? c.openInterest.toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right num text-muted-foreground hidden md:table-cell">
                      {c.impliedVolatility != null
                        ? `${(c.impliedVolatility * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="pl-2 pr-4 md:pr-6 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setBuyTarget(c)}
                        disabled={c.lastPrice <= 0}
                        className={cn(
                          "px-2 py-1 rounded text-[11px] font-medium border transition-colors",
                          c.lastPrice <= 0
                            ? "bg-white/[0.02] text-muted-foreground border-white/[0.04] cursor-not-allowed"
                            : side === "calls"
                              ? "bg-black/10 text-black border-black/20 hover:bg-black/15"
                              : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20",
                        )}
                      >
                        Buy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OptionBuyDialog
        contract={buyTarget}
        underlyingSymbol={chain.underlyingSymbol}
        portfolios={portfolios}
        currency={chain.currency}
        open={!!buyTarget}
        onOpenChange={(o) => {
          if (!o) setBuyTarget(null);
        }}
      />
    </div>
  );
}
