"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Briefcase, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { openStockPosition } from "../portfolios/trade-actions";
import type { MarketQuote } from "@/lib/market";
import { InlinePortfolioCreate } from "./inline-portfolio-create";
import { MarketClosedBanner, useMarketOpen } from "@/components/market-gate";
import type { MarketCode } from "@/lib/market-hours";

export type PortfolioOption = {
  id: string;
  name: string;
  currency: string;
  cashBalance: number;
};

const NEW_PORTFOLIO_SENTINEL = "__new__";

export function BuyDialog({
  quote,
  portfolios,
}: {
  quote: MarketQuote;
  portfolios: PortfolioOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [pending, startTransition] = useTransition();

  const [extraPortfolios, setExtraPortfolios] = useState<PortfolioOption[]>([]);
  const matching = useMemo(
    () =>
      [...portfolios, ...extraPortfolios].filter(
        (p) => p.currency === quote.currency,
      ),
    [portfolios, extraPortfolios, quote.currency],
  );
  const [portfolioId, setPortfolioId] = useState<string>(
    matching[0]?.id ?? "",
  );
  const [creating, setCreating] = useState(false);

  const selected = matching.find((p) => p.id === portfolioId);
  const qtyNum = Number(quantity);
  const validQty = Number.isFinite(qtyNum) && qtyNum > 0;
  const cost = validQty ? qtyNum * quote.price : 0;
  const cashAfter = selected ? selected.cashBalance - cost : 0;
  const canAfford = selected ? cashAfter >= 0 : false;

  const market = useMarketOpen(quote.currency as MarketCode, quote.marketState);

  const symbolFmt = new Intl.NumberFormat(
    quote.currency === "INR" ? "en-IN" : "en-US",
    { style: "currency", currency: quote.currency, maximumFractionDigits: 2 },
  );

  if (portfolios.length === 0) {
    return (
      <Link
        href="/portfolios"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-[14px] font-medium transition-colors"
      >
        <Briefcase className="h-4 w-4" />
        Create a portfolio to trade
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-[14px] font-semibold transition-colors shadow-[0_0_20px_-4px_var(--primary)]">
          <ShoppingCart className="h-4 w-4" />
          Buy {quote.symbol}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buy {quote.symbol}</DialogTitle>
          <DialogDescription>
            {quote.shortName} · {symbolFmt.format(quote.price)}{" "}
            <span className="text-muted-foreground">per share (live)</span>
          </DialogDescription>
        </DialogHeader>

        {matching.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-[13px] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                No portfolio in <b>{quote.currency}</b>. Create one below to
                trade this symbol.
              </div>
            </div>
            <InlinePortfolioCreate
              currency={quote.currency}
              onCancel={() => setOpen(false)}
              onCreated={(p) => {
                setExtraPortfolios((xs) => [...xs, p]);
                setPortfolioId(p.id);
                router.refresh();
              }}
            />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selected || !validQty || !canAfford) return;
              startTransition(async () => {
                try {
                  const res = await openStockPosition({
                    portfolioId,
                    symbol: quote.symbol,
                    quantity: qtyNum,
                  });
                  toast.success(
                    `Bought ${res.quantity} × ${res.symbol} @ ${symbolFmt.format(res.price)}`,
                  );
                  setOpen(false);
                  setQuantity("1");
                  router.refresh();
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Trade failed",
                  );
                }
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="portfolio">Portfolio</Label>
              <select
                id="portfolio"
                value={creating ? NEW_PORTFOLIO_SENTINEL : portfolioId}
                onChange={(e) => {
                  if (e.target.value === NEW_PORTFOLIO_SENTINEL) {
                    setCreating(true);
                  } else {
                    setPortfolioId(e.target.value);
                  }
                }}
                className="w-full h-10 px-3 rounded-md bg-background border border-white/10 text-[14px] outline-none focus:border-primary/40"
              >
                {matching.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {symbolFmt.format(p.cashBalance)} available
                  </option>
                ))}
                <option value={NEW_PORTFOLIO_SENTINEL}>
                  + New {quote.currency} portfolio…
                </option>
              </select>

              {creating && (
                <InlinePortfolioCreate
                  currency={quote.currency}
                  onCancel={() => setCreating(false)}
                  onCreated={(p) => {
                    setExtraPortfolios((xs) => [...xs, p]);
                    setPortfolioId(p.id);
                    setCreating(false);
                    router.refresh();
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value.replace(/[^0-9.]/g, ""))
                }
                autoFocus
              />
            </div>

            {/* Summary */}
            <div className="rounded-md border border-white/[0.06] bg-background/40 p-3 space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price × Qty</span>
                <span className="num">
                  {symbolFmt.format(quote.price)} × {validQty ? qtyNum : 0}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                <span className="text-muted-foreground">Total cost</span>
                <span className="num font-medium">
                  {symbolFmt.format(cost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cash after</span>
                <span
                  className={`num ${canAfford ? "text-foreground" : "text-destructive"}`}
                >
                  {selected ? symbolFmt.format(cashAfter) : "—"}
                </span>
              </div>
            </div>

            {!canAfford && selected && validQty && (
              <div className="text-[12px] text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Insufficient cash in this portfolio
              </div>
            )}

            <MarketClosedBanner reason={market.reason} />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !validQty || !canAfford || !market.open}
              >
                {pending
                  ? "Executing…"
                  : !market.open
                    ? "Market closed"
                    : `Buy ${validQty ? qtyNum : ""} × ${quote.symbol}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
