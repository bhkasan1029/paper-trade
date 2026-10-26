import Link from "next/link";
import { db } from "@/lib/db";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MetricCard, MicroBadge } from "@/components/metric-card";
import { TimeRangeSwitcher } from "@/components/time-range-switcher";
import { Briefcase, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const portfolios = await db.portfolio.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trades: true, notes: true } } },
  });

  const totalCashINR = portfolios
    .filter((p) => p.currency === "INR")
    .reduce((sum, p) => sum + Number(p.cashBalance), 0);
  const totalCashUSD = portfolios
    .filter((p) => p.currency === "USD")
    .reduce((sum, p) => sum + Number(p.cashBalance), 0);

  const totalNotes = portfolios.reduce((s, p) => s + p._count.notes, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 pt-1 md:pt-2">
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight">
            Trading Overview
          </h1>
          <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
            Live portfolio valuation, risk exposure, and paper execution records.
          </p>
        </div>
        <TimeRangeSwitcher />
      </div>

      {/* 4-card metrics grid */}
      <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Paper Capital"
          badge={<MicroBadge>{portfolios.length > 0 ? "Live" : "Empty"}</MicroBadge>}
          value={
            portfolios.length > 0
              ? formatCurrency(totalCashINR, "INR")
              : <span className="text-muted-foreground">₹—</span>
          }
          accent="primary"
          sub={
            totalCashUSD > 0
              ? `+ ${formatCurrency(totalCashUSD, "USD")}`
              : "Cash across all portfolios"
          }
          footer={
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                <span className="label-caps mr-1">Portfolios</span>
                <span className="text-foreground num">{portfolios.length}</span>
              </span>
              <span>
                <span className="label-caps mr-1">Notes</span>
                <span className="text-foreground num">{totalNotes}</span>
              </span>
            </div>
          }
        />

        <MetricCard
          label="Unrealized Net P&L"
          badge={<MicroBadge>Neutral</MicroBadge>}
          value={<span className="text-muted-foreground">—</span>}
          sub="Coming in Part 3"
        />

        <MetricCard
          label="Buying Power"
          badge={<MicroBadge>1.0×</MicroBadge>}
          value={<span className="text-muted-foreground">—</span>}
          sub="Coming in Part 3"
        />

        <MetricCard
          label="Exposure Telemetry"
          badge={<MicroBadge>0 Positions</MicroBadge>}
          value={<span className="text-muted-foreground">—</span>}
          accent="warning"
          sub="Coming in Part 3"
        />
      </div>

      {/* Portfolios strip */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[16px] font-medium">Your Portfolios</h2>
            <MicroBadge tone="muted">
              {portfolios.length}
            </MicroBadge>
          </div>
          <Link
            href="/portfolios"
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>

        {portfolios.length === 0 ? (
          <Link
            href="/portfolios"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] py-10 text-[14px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first portfolio
          </Link>
        ) : (
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {portfolios.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/portfolios/${p.id}`}
                className="rounded-lg border border-white/[0.06] bg-background/40 p-4 hover:border-primary/30 active:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-3 min-w-0">
                  <div className="h-7 w-7 shrink-0 rounded bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-[14px] font-medium truncate min-w-0">
                    {p.name}
                  </div>
                </div>
                <div className="num text-[20px] md:text-[22px] font-semibold tracking-tight leading-none break-all">
                  {formatCurrency(
                    Number(p.cashBalance),
                    p.currency as Currency,
                  )}
                </div>
                <div className="mt-2 text-[11px] tracking-wider uppercase text-muted-foreground truncate">
                  {p.currency} · {p._count.notes} notes · {p._count.trades}{" "}
                  trades
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
