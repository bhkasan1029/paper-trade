import Link from "next/link";
import { db } from "@/lib/db";
import { MicroBadge } from "@/components/metric-card";
import { cn } from "@/lib/utils";
import { formatCurrency, type Currency } from "@/lib/currency";

export const dynamic = "force-dynamic";

const OPTION_MULT = 100;

type OptionDetails = {
  contractSymbol?: string;
  strike?: number;
  expiration?: string;
  type?: "call" | "put";
};

function realizedFor(t: {
  assetType: string;
  price: unknown;
  quantity: unknown;
  closePrice: unknown;
}): number | null {
  if (t.closePrice == null) return null;
  const diff = Number(t.closePrice) - Number(t.price);
  const mult = t.assetType === "OPTION" ? OPTION_MULT : 1;
  return diff * Number(t.quantity) * mult;
}

export default async function HistoryPage() {
  const trades = await db.trade.findMany({
    orderBy: [{ closedAt: "desc" }, { openedAt: "desc" }],
    include: {
      portfolio: { select: { id: true, name: true, currency: true } },
    },
  });

  const open = trades.filter((t) => t.closedAt === null);
  const closed = trades.filter((t) => t.closedAt !== null);

  const totalRealized = closed.reduce((sum, t) => {
    const r = realizedFor(t);
    return r === null ? sum : sum + r;
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight">
            Order History
          </h1>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
            Every paper trade you place — buys, sells — recorded here.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MicroBadge tone="muted">{open.length} open</MicroBadge>
          <MicroBadge tone="muted">{closed.length} closed</MicroBadge>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-8 md:p-14 flex flex-col items-center justify-center text-center">
          <MicroBadge tone="muted">Empty</MicroBadge>
          <h2 className="text-[18px] md:text-[20px] font-medium mt-4">
            No trades yet
          </h2>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-2 max-w-md">
            Head to{" "}
            <Link href="/search" className="text-primary hover:underline">
              Search
            </Link>{" "}
            to find a ticker and place your first paper trade.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-medium">All Trades</h3>
              <MicroBadge tone="muted">{trades.length}</MicroBadge>
            </div>
            <span className="text-[12px] text-muted-foreground">
              Realized P&L (closed):{" "}
              <span
                className={cn(
                  "num ml-1",
                  totalRealized === 0
                    ? "text-foreground"
                    : totalRealized > 0
                      ? "text-positive"
                      : "text-destructive",
                )}
              >
                {totalRealized >= 0 ? "+" : ""}
                {totalRealized === 0
                  ? "—"
                  : totalRealized.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px] md:text-[14px]">
              <thead className="text-left text-[11px] tracking-wider uppercase text-muted-foreground">
                <tr className="border-b border-white/[0.04]">
                  <th className="px-4 md:px-6 py-2.5 font-medium">Symbol</th>
                  <th className="px-3 py-2.5 font-medium">Portfolio</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-3 py-2.5 font-medium text-right">Entry</th>
                  <th className="px-3 py-2.5 font-medium text-right">Exit</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Realized
                  </th>
                  <th className="px-4 md:px-6 py-2.5 font-medium text-right">
                    Opened
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const currency = (t.portfolio.currency as Currency) ?? "INR";
                  const closedRealized = realizedFor(t);
                  const positive = (closedRealized ?? 0) >= 0;
                  const isOption = t.assetType === "OPTION";
                  const details = (t.optionDetails ?? {}) as OptionDetails;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="px-4 md:px-6 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-primary">
                            {t.symbol}
                          </span>
                          {isOption && details.type && (
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border",
                                details.type === "call"
                                  ? "bg-primary/10 text-primary/90 border-primary/25"
                                  : "bg-destructive/10 text-destructive/90 border-destructive/25",
                              )}
                            >
                              {details.type}
                            </span>
                          )}
                          {isOption && details.strike != null && (
                            <span className="text-[12px] num text-foreground">
                              {formatCurrency(Number(details.strike), currency)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider flex items-center gap-1.5">
                          <span>{t.assetType}</span>
                          {isOption && details.expiration && (
                            <span className="normal-case tracking-normal">
                              · exp{" "}
                              {new Date(details.expiration).toLocaleDateString(
                                "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "2-digit",
                                },
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/portfolios/${t.portfolio.id}`}
                          className="text-[13px] hover:text-primary transition-colors"
                        >
                          {t.portfolio.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {t.closedAt ? (
                          <MicroBadge tone="muted">Closed</MicroBadge>
                        ) : (
                          <MicroBadge tone="muted">Open</MicroBadge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {Number(t.quantity)}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {formatCurrency(Number(t.price), currency)}
                      </td>
                      <td className="px-3 py-3 text-right num">
                        {t.closePrice !== null ? (
                          formatCurrency(Number(t.closePrice), currency)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right num",
                          closedRealized === null
                            ? ""
                            : positive
                              ? "text-positive"
                              : "text-destructive",
                        )}
                      >
                        {closedRealized === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {positive ? "+" : ""}
                            {formatCurrency(closedRealized, currency)}
                          </>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right text-muted-foreground text-[12px] num">
                        {new Date(t.openedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
