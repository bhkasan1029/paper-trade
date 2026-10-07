import { MicroBadge } from "@/components/metric-card";
import { Search as SearchIcon } from "lucide-react";
import { QuoteCard } from "./quote-card";
import { PriceChart } from "./price-chart";
import { OptionsChain } from "./options-chain";
import { NewsFeed } from "./news-feed";
import { RecentViewed } from "./recent-viewed";
import { db } from "@/lib/db";
import type { PortfolioOption } from "./buy-dialog";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const raw = params?.symbol;
  const symbol = Array.isArray(raw) ? raw[0] : raw;

  const portfoliosRaw = await db.portfolio.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, currency: true, cashBalance: true },
  });
  const portfolios: PortfolioOption[] = portfoliosRaw.map((p) => ({
    id: p.id,
    name: p.name,
    currency: p.currency,
    cashBalance: Number(p.cashBalance),
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight">
          Search
        </h1>
        <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
          Look up any US or Indian ticker. Use the ⌘K bar above to search.
        </p>
      </div>

      {symbol ? (
        <>
          <QuoteCard
            symbol={symbol.trim().toUpperCase()}
            portfolios={portfolios}
          />
          <PriceChart symbol={symbol.trim().toUpperCase()} />
          <NewsFeed symbol={symbol.trim().toUpperCase()} />
          <OptionsChain
            symbol={symbol.trim().toUpperCase()}
            portfolios={portfolios}
          />
        </>
      ) : (
        <>
          <RecentViewed />
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-8 md:p-14 flex flex-col items-center justify-center text-center">
            <SearchIcon className="h-6 w-6 md:h-7 md:w-7 text-muted-foreground mb-3" />
            <MicroBadge tone="muted">Ready</MicroBadge>
            <h2 className="text-[18px] md:text-[20px] font-medium mt-4">
              Search a ticker
            </h2>
            <p className="text-[13px] md:text-[15px] text-muted-foreground mt-2 max-w-md">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] md:text-[12px]">
                ⌘K
              </kbd>{" "}
              or click the search bar. Try{" "}
              <code className="text-primary text-[13px] md:text-[14px]">
                RELIANCE.NS
              </code>
              ,{" "}
              <code className="text-primary text-[13px] md:text-[14px]">
                TCS.NS
              </code>
              , or{" "}
              <code className="text-primary text-[13px] md:text-[14px]">
                NVDA
              </code>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}
