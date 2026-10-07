import Link from "next/link";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { MicroBadge } from "@/components/metric-card";
import { WatchlistTable, type WatchlistRow } from "./watchlist-table";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const items = await db.watchlistItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows: WatchlistRow[] = items.map((it) => ({
    symbol: it.symbol,
    name: it.name,
    exchange: it.exchange,
    addedAt: it.createdAt.toISOString(),
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight">
            Watchlist
          </h1>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
            Tickers you&apos;re tracking. Live prices refresh every 20s.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MicroBadge tone="primary">{rows.length} tracked</MicroBadge>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-8 md:p-14 flex flex-col items-center justify-center text-center">
          <Star className="h-6 w-6 md:h-7 md:w-7 text-muted-foreground mb-3" />
          <MicroBadge tone="muted">Empty</MicroBadge>
          <h2 className="text-[18px] md:text-[20px] font-medium mt-4">
            Nothing on the watchlist yet
          </h2>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-2 max-w-md">
            Head to{" "}
            <Link href="/search" className="text-primary hover:underline">
              Search
            </Link>
            , pull up a ticker, and tap the star to start tracking it.
          </p>
        </div>
      ) : (
        <WatchlistTable rows={rows} />
      )}
    </div>
  );
}
