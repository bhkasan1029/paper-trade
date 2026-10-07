import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MetricCard, MicroBadge } from "@/components/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioHeader } from "./portfolio-header";
import { NotesPanel } from "./notes-panel";
import { PositionsPanel, type OpenPosition, type ClosedPosition } from "./positions-panel";
import type {
  OpenOptionLot,
  ClosedOptionLot,
} from "./options-positions";

export const dynamic = "force-dynamic";

export default async function PortfolioDetailPage({
  params,
}: PageProps<"/portfolios/[id]">) {
  const { id } = await params;

  const portfolio = await db.portfolio.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      trades: {
        orderBy: { openedAt: "desc" },
      },
      _count: { select: { trades: true, notes: true } },
    },
  });

  if (!portfolio) notFound();

  const stockTrades = portfolio.trades.filter((t) => t.assetType === "STOCK");
  const optionTrades = portfolio.trades.filter((t) => t.assetType === "OPTION");

  const openPositions: OpenPosition[] = stockTrades
    .filter((t) => t.closedAt === null)
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      quantity: Number(t.quantity),
      entryPrice: Number(t.price),
      openedAt: t.openedAt.toISOString(),
    }));

  const closedPositions: ClosedPosition[] = stockTrades
    .filter((t) => t.closedAt !== null && t.closePrice !== null)
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      quantity: Number(t.quantity),
      entryPrice: Number(t.price),
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt!.toISOString(),
      closePrice: Number(t.closePrice!),
    }));

  type OptionDetails = {
    contractSymbol?: string;
    strike?: number;
    expiration?: string;
    type?: "call" | "put";
  };

  const openOptions: OpenOptionLot[] = optionTrades
    .filter((t) => t.closedAt === null)
    .map((t) => {
      const d = (t.optionDetails ?? {}) as OptionDetails;
      return {
        id: t.id,
        symbol: t.symbol,
        contracts: Number(t.quantity),
        entryPremium: Number(t.price),
        openedAt: t.openedAt.toISOString(),
        contractSymbol: d.contractSymbol ?? "",
        strike: Number(d.strike ?? 0),
        expiration: d.expiration ?? "",
        optionType: d.type ?? "call",
      };
    })
    .filter((l) => l.contractSymbol);

  const closedOptions: ClosedOptionLot[] = optionTrades
    .filter((t) => t.closedAt !== null && t.closePrice !== null)
    .map((t) => {
      const d = (t.optionDetails ?? {}) as OptionDetails;
      return {
        id: t.id,
        symbol: t.symbol,
        contracts: Number(t.quantity),
        entryPremium: Number(t.price),
        openedAt: t.openedAt.toISOString(),
        closedAt: t.closedAt!.toISOString(),
        closePremium: Number(t.closePrice!),
        contractSymbol: d.contractSymbol ?? "",
        strike: Number(d.strike ?? 0),
        expiration: d.expiration ?? "",
        optionType: d.type ?? "call",
      };
    })
    .filter((l) => l.contractSymbol);

  const currency = portfolio.currency as Currency;
  const cash = Number(portfolio.cashBalance);
  const start = Number(portfolio.startingCash);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-[1400px] mx-auto">
      <PortfolioHeader
        id={portfolio.id}
        name={portfolio.name}
        startingCash={start}
        currency={currency}
      />

      {/* Summary cards */}
      <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Cash Balance"
          badge={<MicroBadge>{currency}</MicroBadge>}
          value={formatCurrency(cash, currency)}
          accent="primary"
          sub="Available for new trades"
        />
        <MetricCard
          label="Starting Cash"
          badge={<MicroBadge tone="muted">Seed</MicroBadge>}
          value={formatCurrency(start, currency)}
          sub="Reset with menu → Reset starting cash"
        />
        <MetricCard
          label="Activity"
          value={
            <span className="num">
              {portfolio._count.trades}{" "}
              <span className="text-base text-muted-foreground font-normal">
                trades
              </span>
            </span>
          }
          sub={`${portfolio._count.notes} notes recorded`}
        />
      </div>

      <Tabs
        defaultValue={
          openPositions.length + openOptions.length > 0 ? "overview" : "notes"
        }
      >
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="overview" className="text-[14px]">
            Positions{" "}
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              {openPositions.length + openOptions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-[14px]">
            Notes{" "}
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              {portfolio._count.notes}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 md:mt-6">
          <PositionsPanel
            portfolioId={portfolio.id}
            currency={currency}
            open={openPositions}
            closed={closedPositions}
            openOptions={openOptions}
            closedOptions={closedOptions}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-5 md:mt-6">
          <NotesPanel portfolioId={portfolio.id} notes={portfolio.notes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
