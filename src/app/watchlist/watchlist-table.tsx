"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketQuote } from "@/lib/market";
import { removeFromWatchlist } from "./actions";

const REFRESH_MS = 20_000;

export type WatchlistRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  addedAt: string;
};

export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(rows.length > 0);
  const [pending, startTransition] = useTransition();

  const symbols = useMemo(() => rows.map((r) => r.symbol), [rows]);

  useEffect(() => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`,
        );
        const data = (await res.json()) as { quotes: Record<string, MarketQuote> };
        if (!cancelled) setQuotes(data.quotes ?? {});
      } catch {
        // best effort
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
  }, [symbols]);

  function fmtPrice(q: MarketQuote) {
    try {
      return new Intl.NumberFormat(
        q.currency === "INR" ? "en-IN" : "en-US",
        { style: "currency", currency: q.currency ?? "USD", maximumFractionDigits: 2 },
      ).format(q.price);
    } catch {
      return q.price.toFixed(2);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
        <h3 className="text-[15px] font-medium">Tracked tickers</h3>
        {loading && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Fetching prices
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] md:text-[14px]">
          <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
            <tr className="border-b border-white/[0.04]">
              <th className="pl-4 md:pl-6 pr-3 py-2.5 font-medium">Symbol</th>
              <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Exchange</th>
              <th className="px-3 py-2.5 font-medium text-right">Price</th>
              <th className="px-3 py-2.5 font-medium text-right">Change</th>
              <th className="px-3 py-2.5 font-medium text-right hidden md:table-cell">Day Range</th>
              <th className="pl-3 pr-4 md:pr-6 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const q = quotes[row.symbol];
              const changePos = q ? q.change >= 0 : true;
              return (
                <tr
                  key={row.symbol}
                  className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015] transition-colors"
                >
                  <td className="pl-4 md:pl-6 pr-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <Link
                          href={`/search?symbol=${encodeURIComponent(row.symbol)}`}
                          className="font-semibold text-primary hover:underline underline-offset-2 decoration-primary/40 inline-flex items-center gap-1"
                        >
                          {row.symbol}
                          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </Link>
                        {row.name && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[140px] truncate">
                            {row.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-muted-foreground text-[12px] hidden sm:table-cell">
                    {row.exchange ?? q?.exchange ?? "—"}
                  </td>
                  <td className="px-3 py-3.5 text-right num font-medium">
                    {q ? fmtPrice(q) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3.5 text-right num",
                      !q
                        ? "text-muted-foreground"
                        : changePos
                          ? "text-positive"
                          : "text-destructive",
                    )}
                  >
                    {q ? (
                      <div className="flex items-center justify-end gap-1">
                        {changePos ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>
                          {changePos ? "+" : ""}
                          {q.change.toFixed(2)}{" "}
                          <span className="opacity-70">
                            ({changePos ? "+" : ""}
                            {q.changePercent.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right num text-muted-foreground text-[12px] hidden md:table-cell">
                    {q?.dayLow !== undefined && q?.dayHigh !== undefined ? (
                      `${q.dayLow.toFixed(2)} – ${q.dayHigh.toFixed(2)}`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pl-3 pr-4 md:pr-6 py-3.5 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await removeFromWatchlist(row.symbol);
                            toast.success(`Removed ${row.symbol} from watchlist`);
                            router.refresh();
                          } catch {
                            toast.error("Failed to remove");
                          }
                        });
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
