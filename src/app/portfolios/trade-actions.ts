"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { marketData } from "@/lib/market";
import { canTradeNow, marketHoursStatus, type MarketCode } from "@/lib/market-hours";

// Standard US equity option multiplier
const CONTRACT_MULT = 100;

export async function openStockPosition(input: {
  portfolioId: string;
  symbol: string;
  quantity: number;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  const qty = Number(input.quantity);

  if (!symbol) throw new Error("Symbol required");
  if (!Number.isFinite(qty) || qty <= 0)
    throw new Error("Quantity must be greater than 0");

  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
  });
  if (!portfolio) throw new Error("Portfolio not found");

  const quote = await marketData.quote(symbol);

  if (
    quote.currency &&
    portfolio.currency &&
    quote.currency !== portfolio.currency
  ) {
    throw new Error(
      `Currency mismatch: ${symbol} trades in ${quote.currency} but this portfolio is ${portfolio.currency}`,
    );
  }

  const gate = canTradeNow(quote.currency as MarketCode, quote.marketState);
  if (!gate.allowed) throw new Error(gate.reason);

  const price = new Prisma.Decimal(quote.price);
  const cost = price.mul(qty);

  if (new Prisma.Decimal(portfolio.cashBalance).lessThan(cost)) {
    throw new Error(
      `Not enough cash. Need ${cost.toFixed(2)}, have ${portfolio.cashBalance}`,
    );
  }

  const [trade] = await db.$transaction([
    db.trade.create({
      data: {
        portfolioId: portfolio.id,
        symbol,
        assetType: "STOCK",
        side: "BUY",
        quantity: new Prisma.Decimal(qty),
        price,
      },
    }),
    db.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { decrement: cost } },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${portfolio.id}`);
  revalidatePath("/history");

  return {
    tradeId: trade.id,
    symbol,
    quantity: qty,
    price: Number(price),
    totalCost: Number(cost),
  };
}

/**
 * FIFO sell — sells `quantity` shares of `symbol` from `portfolioId`.
 * Walks open lots oldest-first, fully-closing each until the requested qty is filled.
 * If the last lot required only partially fills, splits it: the sold portion becomes a
 * new closed Trade row, and the original lot's quantity is reduced by the sold amount.
 */
export async function sellShares(input: {
  portfolioId: string;
  symbol: string;
  quantity: number;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  const sellQtyNum = Number(input.quantity);

  if (!Number.isFinite(sellQtyNum) || sellQtyNum <= 0)
    throw new Error("Quantity must be greater than 0");

  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
  });
  if (!portfolio) throw new Error("Portfolio not found");

  const openLots = await db.trade.findMany({
    where: {
      portfolioId: input.portfolioId,
      symbol,
      assetType: "STOCK",
      closedAt: null,
    },
    orderBy: { openedAt: "asc" },
  });

  const totalHeld = openLots.reduce(
    (s, t) => s.plus(t.quantity),
    new Prisma.Decimal(0),
  );

  if (totalHeld.lessThan(sellQtyNum))
    throw new Error(
      `You only hold ${totalHeld} ${symbol}, cannot sell ${sellQtyNum}`,
    );

  const quote = await marketData.quote(symbol);

  const gate = canTradeNow(quote.currency as MarketCode, quote.marketState);
  if (!gate.allowed) throw new Error(gate.reason);

  const sellPrice = new Prisma.Decimal(quote.price);

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  let remaining = new Prisma.Decimal(sellQtyNum);
  let totalProceeds = new Prisma.Decimal(0);
  let realizedPnl = new Prisma.Decimal(0);
  const closedBreakdown: Array<{
    lotId: string;
    quantity: number;
    entryPrice: number;
    realized: number;
  }> = [];

  for (const lot of openLots) {
    if (remaining.lessThanOrEqualTo(0)) break;

    const lotQty = new Prisma.Decimal(lot.quantity);
    const entryPrice = new Prisma.Decimal(lot.price);

    if (lotQty.lessThanOrEqualTo(remaining)) {
      // Fully close this lot
      const lotProceeds = sellPrice.mul(lotQty);
      const lotRealized = sellPrice.minus(entryPrice).mul(lotQty);
      totalProceeds = totalProceeds.plus(lotProceeds);
      realizedPnl = realizedPnl.plus(lotRealized);
      remaining = remaining.minus(lotQty);

      ops.push(
        db.trade.update({
          where: { id: lot.id },
          data: { closedAt: now, closePrice: sellPrice },
        }),
      );
      closedBreakdown.push({
        lotId: lot.id,
        quantity: Number(lotQty),
        entryPrice: Number(entryPrice),
        realized: Number(lotRealized),
      });
    } else {
      // Partial close — split the lot
      const soldQty = remaining;
      const remainingQty = lotQty.minus(soldQty);
      const lotProceeds = sellPrice.mul(soldQty);
      const lotRealized = sellPrice.minus(entryPrice).mul(soldQty);
      totalProceeds = totalProceeds.plus(lotProceeds);
      realizedPnl = realizedPnl.plus(lotRealized);
      remaining = new Prisma.Decimal(0);

      // Reduce original lot's quantity
      ops.push(
        db.trade.update({
          where: { id: lot.id },
          data: { quantity: remainingQty },
        }),
      );
      // Create a new closed trade for the sold portion
      ops.push(
        db.trade.create({
          data: {
            portfolioId: lot.portfolioId,
            symbol: lot.symbol,
            assetType: "STOCK",
            side: "BUY",
            quantity: soldQty,
            price: entryPrice,
            openedAt: lot.openedAt,
            closedAt: now,
            closePrice: sellPrice,
          },
        }),
      );
      closedBreakdown.push({
        lotId: lot.id,
        quantity: Number(soldQty),
        entryPrice: Number(entryPrice),
        realized: Number(lotRealized),
      });
    }
  }

  ops.push(
    db.portfolio.update({
      where: { id: input.portfolioId },
      data: { cashBalance: { increment: totalProceeds } },
    }),
  );

  await db.$transaction(ops);

  revalidatePath("/");
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${input.portfolioId}`);
  revalidatePath("/history");

  return {
    symbol,
    quantity: sellQtyNum,
    sellPrice: Number(sellPrice),
    proceeds: Number(totalProceeds),
    realizedPnl: Number(realizedPnl),
    lots: closedBreakdown,
  };
}

export async function openOptionPosition(input: {
  portfolioId: string;
  contractSymbol: string;
  contracts: number;
}) {
  const contractSymbol = input.contractSymbol.trim().toUpperCase();
  const contracts = Number(input.contracts);

  if (!contractSymbol) throw new Error("Contract symbol required");
  if (!Number.isFinite(contracts) || contracts <= 0)
    throw new Error("Contracts must be greater than 0");
  if (!Number.isInteger(contracts))
    throw new Error("Contracts must be a whole number");

  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
  });
  if (!portfolio) throw new Error("Portfolio not found");

  const quote = await marketData.optionQuote(contractSymbol);

  if (
    quote.currency &&
    portfolio.currency &&
    quote.currency !== portfolio.currency
  ) {
    throw new Error(
      `Currency mismatch: ${contractSymbol} settles in ${quote.currency} but this portfolio is ${portfolio.currency}`,
    );
  }

  // Options are US-only via Yahoo → gate on US regular session.
  const optGate = marketHoursStatus("USD");
  if (!optGate.open) throw new Error(optGate.reason);

  if (quote.expiration && quote.expiration < Date.now()) {
    throw new Error("Contract already expired");
  }

  if (!Number.isFinite(quote.lastPrice) || quote.lastPrice <= 0) {
    throw new Error(
      `${contractSymbol} has no live premium — pick a more liquid strike`,
    );
  }

  const premium = new Prisma.Decimal(quote.lastPrice);
  const cost = premium.mul(contracts).mul(CONTRACT_MULT);

  if (new Prisma.Decimal(portfolio.cashBalance).lessThan(cost)) {
    throw new Error(
      `Not enough cash. Need ${cost.toFixed(2)}, have ${portfolio.cashBalance}`,
    );
  }

  const [trade] = await db.$transaction([
    db.trade.create({
      data: {
        portfolioId: portfolio.id,
        symbol: quote.underlyingSymbol,
        assetType: "OPTION",
        side: "BUY",
        quantity: new Prisma.Decimal(contracts),
        price: premium,
        optionDetails: {
          contractSymbol,
          strike: quote.strike,
          expiration: new Date(quote.expiration).toISOString(),
          type: quote.optionType,
        },
      },
    }),
    db.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { decrement: cost } },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${portfolio.id}`);
  revalidatePath("/history");

  return {
    tradeId: trade.id,
    contractSymbol,
    contracts,
    premium: Number(premium),
    totalCost: Number(cost),
  };
}

/**
 * FIFO sell for options — closes `contracts` lots of a specific contract.
 * Same split-lot behavior as sellShares: partial fills leave the remaining
 * quantity on the original row and record a new closed row for the sold portion.
 */
export async function sellOptionContracts(input: {
  portfolioId: string;
  contractSymbol: string;
  contracts: number;
}) {
  const contractSymbol = input.contractSymbol.trim().toUpperCase();
  const sellQtyNum = Number(input.contracts);

  if (!Number.isFinite(sellQtyNum) || sellQtyNum <= 0)
    throw new Error("Contracts must be greater than 0");
  if (!Number.isInteger(sellQtyNum))
    throw new Error("Contracts must be a whole number");

  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
  });
  if (!portfolio) throw new Error("Portfolio not found");

  const openLots = await db.trade.findMany({
    where: {
      portfolioId: input.portfolioId,
      assetType: "OPTION",
      closedAt: null,
    },
    orderBy: { openedAt: "asc" },
  });

  // Filter by contractSymbol from optionDetails JSON
  const matchingLots = openLots.filter((lot) => {
    const details = lot.optionDetails as Prisma.JsonObject | null;
    return details?.contractSymbol === contractSymbol;
  });

  const totalHeld = matchingLots.reduce(
    (s, t) => s.plus(t.quantity),
    new Prisma.Decimal(0),
  );

  if (totalHeld.lessThan(sellQtyNum))
    throw new Error(
      `You only hold ${totalHeld} contracts of ${contractSymbol}, cannot sell ${sellQtyNum}`,
    );

  const quote = await marketData.optionQuote(contractSymbol);

  const optGate = marketHoursStatus("USD");
  if (!optGate.open) throw new Error(optGate.reason);

  const sellPremium = new Prisma.Decimal(quote.lastPrice);

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  let remaining = new Prisma.Decimal(sellQtyNum);
  let totalProceeds = new Prisma.Decimal(0);
  let realizedPnl = new Prisma.Decimal(0);
  const closedBreakdown: Array<{
    lotId: string;
    contracts: number;
    entryPremium: number;
    realized: number;
  }> = [];

  for (const lot of matchingLots) {
    if (remaining.lessThanOrEqualTo(0)) break;

    const lotQty = new Prisma.Decimal(lot.quantity);
    const entryPremium = new Prisma.Decimal(lot.price);

    if (lotQty.lessThanOrEqualTo(remaining)) {
      const lotProceeds = sellPremium.mul(lotQty).mul(CONTRACT_MULT);
      const lotRealized = sellPremium
        .minus(entryPremium)
        .mul(lotQty)
        .mul(CONTRACT_MULT);
      totalProceeds = totalProceeds.plus(lotProceeds);
      realizedPnl = realizedPnl.plus(lotRealized);
      remaining = remaining.minus(lotQty);

      ops.push(
        db.trade.update({
          where: { id: lot.id },
          data: { closedAt: now, closePrice: sellPremium },
        }),
      );
      closedBreakdown.push({
        lotId: lot.id,
        contracts: Number(lotQty),
        entryPremium: Number(entryPremium),
        realized: Number(lotRealized),
      });
    } else {
      const soldQty = remaining;
      const remainingQty = lotQty.minus(soldQty);
      const lotProceeds = sellPremium.mul(soldQty).mul(CONTRACT_MULT);
      const lotRealized = sellPremium
        .minus(entryPremium)
        .mul(soldQty)
        .mul(CONTRACT_MULT);
      totalProceeds = totalProceeds.plus(lotProceeds);
      realizedPnl = realizedPnl.plus(lotRealized);
      remaining = new Prisma.Decimal(0);

      ops.push(
        db.trade.update({
          where: { id: lot.id },
          data: { quantity: remainingQty },
        }),
      );
      ops.push(
        db.trade.create({
          data: {
            portfolioId: lot.portfolioId,
            symbol: lot.symbol,
            assetType: "OPTION",
            side: "BUY",
            quantity: soldQty,
            price: entryPremium,
            optionDetails: lot.optionDetails ?? Prisma.JsonNull,
            openedAt: lot.openedAt,
            closedAt: now,
            closePrice: sellPremium,
          },
        }),
      );
      closedBreakdown.push({
        lotId: lot.id,
        contracts: Number(soldQty),
        entryPremium: Number(entryPremium),
        realized: Number(lotRealized),
      });
    }
  }

  ops.push(
    db.portfolio.update({
      where: { id: input.portfolioId },
      data: { cashBalance: { increment: totalProceeds } },
    }),
  );

  await db.$transaction(ops);

  revalidatePath("/");
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${input.portfolioId}`);
  revalidatePath("/history");

  return {
    contractSymbol,
    contracts: sellQtyNum,
    sellPremium: Number(sellPremium),
    proceeds: Number(totalProceeds),
    realizedPnl: Number(realizedPnl),
    lots: closedBreakdown,
  };
}
