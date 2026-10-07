import { TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, type Currency } from "@/lib/currency";
import { SidebarNav } from "./sidebar-nav";

export async function Sidebar() {
  const [portfolios, watchlistCount] = await Promise.all([
    db.portfolio.findMany({
      select: { currency: true, cashBalance: true },
    }),
    db.watchlistItem.count(),
  ]);

  const totals = portfolios.reduce<Record<Currency, number>>(
    (acc, p) => {
      const c = (p.currency as Currency) || "INR";
      acc[c] = (acc[c] ?? 0) + Number(p.cashBalance);
      return acc;
    },
    { INR: 0, USD: 0 } as Record<Currency, number>,
  );

  const hasPortfolios = portfolios.length > 0;

  return (
    <aside className="w-[85vw] max-w-72 lg:w-72 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="relative">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        </div>
        <span className="font-semibold tracking-tight text-[17px]">
          PaperTrade
        </span>
        <span className="ml-auto px-1.5 py-0.5 text-[10px] tracking-wider rounded bg-white/5 text-muted-foreground border border-white/5">
          v0.1
        </span>
      </div>

      {/* Paper Capital summary */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
            <span className="label-caps">Paper Capital</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {portfolios.length} portfolio{portfolios.length === 1 ? "" : "s"}
          </span>
        </div>
        {hasPortfolios ? (
          <>
            <div className="num text-[26px] font-semibold tracking-tight leading-none">
              {formatCurrency(totals.INR, "INR")}
            </div>
            {totals.USD > 0 && (
              <div className="num text-sm text-muted-foreground mt-1.5">
                + {formatCurrency(totals.USD, "USD")}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="num text-[26px] font-semibold tracking-tight text-muted-foreground leading-none">
              ₹—
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              Create a portfolio to begin
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="label-caps px-5 mb-2">Terminal Nav</div>
        <SidebarNav
          portfolioCount={portfolios.length}
          watchlistCount={watchlistCount}
        />
      </div>

      {/* Bottom status */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-white/[0.02]">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
          <span className="text-[12px] text-muted-foreground">
            Local Mode · Phase 1
          </span>
        </div>
      </div>
    </aside>
  );
}
