import Link from "next/link";
import { db } from "@/lib/db";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MicroBadge } from "@/components/metric-card";
import { NewPortfolioDialog } from "./new-portfolio-dialog";
import { Briefcase } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const portfolios = await db.portfolio.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { trades: true, notes: true } },
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight">
            Portfolios
          </h1>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
            Track separate investment strategies side by side.
          </p>
        </div>
        <NewPortfolioDialog />
      </div>

      {portfolios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-8 md:p-14 flex flex-col items-center justify-center text-center">
          <MicroBadge tone="muted">Empty</MicroBadge>
          <h2 className="text-[18px] md:text-[20px] font-medium mt-4">No portfolios yet</h2>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-2 max-w-md">
            Create your first paper portfolio to start tracking a strategy.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {portfolios.map((p) => (
            <Link
              key={p.id}
              href={`/portfolios/${p.id}`}
              className="group rounded-xl border border-white/[0.06] bg-card p-4 md:p-6 hover:border-primary/30 active:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-[15px] truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground tracking-wider uppercase mt-0.5">
                      {p.currency} · Paper
                    </div>
                  </div>
                </div>
                <MicroBadge tone="muted">Open</MicroBadge>
              </div>

              <div className="mt-5 md:mt-6">
                <div className="label-caps mb-2">Cash Balance</div>
                <div className="num text-[24px] md:text-[28px] font-semibold tracking-tight leading-none break-all">
                  {formatCurrency(
                    Number(p.cashBalance),
                    p.currency as Currency,
                  )}
                </div>
              </div>

              <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-white/[0.04] flex items-center justify-between gap-2 text-[11px] md:text-[12px] text-muted-foreground">
                <span className="truncate">
                  <span className="label-caps mr-1">Trades</span>
                  <span className="text-foreground num">{p._count.trades}</span>
                </span>
                <span className="truncate">
                  <span className="label-caps mr-1">Notes</span>
                  <span className="text-foreground num">{p._count.notes}</span>
                </span>
                <span className="truncate">
                  <span className="label-caps mr-1">Started</span>
                  <span className="text-foreground num">
                    {formatCurrency(
                      Number(p.startingCash),
                      p.currency as Currency,
                      { compact: true },
                    )}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
