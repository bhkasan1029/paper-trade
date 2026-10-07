"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { openOptionPosition } from "../portfolios/trade-actions";
import type { OptionContract } from "@/lib/market";
import type { PortfolioOption } from "./buy-dialog";
import { InlinePortfolioCreate } from "./inline-portfolio-create";
import { MarketClosedBanner, useMarketOpen } from "@/components/market-gate";

const NEW_PORTFOLIO_SENTINEL = "__new__";

const CONTRACT_MULT = 100;

export function OptionBuyDialog({
  contract,
  underlyingSymbol,
  portfolios,
  currency,
  open,
  onOpenChange,
}: {
  contract: OptionContract | null;
  underlyingSymbol: string;
  portfolios: PortfolioOption[];
  currency: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [contracts, setContracts] = useState("1");
  const [pending, startTransition] = useTransition();

  const [extraPortfolios, setExtraPortfolios] = useState<PortfolioOption[]>([]);
  const matching = useMemo(
    () =>
      [...portfolios, ...extraPortfolios].filter((p) => p.currency === currency),
    [portfolios, extraPortfolios, currency],
  );
  const [portfolioId, setPortfolioId] = useState<string>(matching[0]?.id ?? "");
  const [creating, setCreating] = useState(false);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const selected = matching.find((p) => p.id === portfolioId);
  const contractsNum = Number(contracts);
  const validQty =
    Number.isFinite(contractsNum) &&
    contractsNum > 0 &&
    Number.isInteger(contractsNum);
  const premium = contract?.lastPrice ?? 0;
  const cost = validQty && contract ? contractsNum * premium * CONTRACT_MULT : 0;
  const cashAfter = selected ? selected.cashBalance - cost : 0;
  const canAfford = selected ? cashAfter >= 0 && cost > 0 : false;
  const noPremium = !!contract && (!premium || premium <= 0);

  const market = useMarketOpen("USD");

  const expDateLabel = contract
    ? new Date(contract.expiration).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Buy {underlyingSymbol}</span>
            {contract && (
              <span
                className={
                  contract.optionType === "call"
                    ? "text-[12px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30"
                    : "text-[12px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30"
                }
              >
                {contract.optionType.toUpperCase()}
              </span>
            )}
          </DialogTitle>
          {contract && (
            <DialogDescription>
              {fmt.format(contract.strike)} strike · exp {expDateLabel} ·{" "}
              <span className="text-foreground num">
                {fmt.format(premium)}
              </span>{" "}
              <span className="text-muted-foreground">
                premium / share (× 100)
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {matching.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-[13px] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                {portfolios.length === 0 ? (
                  <>You don&apos;t have a portfolio yet — create one below.</>
                ) : (
                  <>
                    No portfolio in <b>{currency}</b>. US options settle in
                    USD — create one below.
                  </>
                )}
              </div>
            </div>
            <InlinePortfolioCreate
              currency={currency}
              onCancel={() => onOpenChange(false)}
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
              if (!contract || !selected || !validQty || !canAfford) return;
              startTransition(async () => {
                try {
                  const res = await openOptionPosition({
                    portfolioId,
                    contractSymbol: contract.contractSymbol,
                    contracts: contractsNum,
                  });
                  toast.success(
                    `Bought ${res.contracts} × ${underlyingSymbol} ${contract.optionType.toUpperCase()} ${fmt.format(contract.strike)} @ ${fmt.format(res.premium)}`,
                  );
                  onOpenChange(false);
                  setContracts("1");
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
              <Label htmlFor="opt-portfolio">Portfolio</Label>
              <select
                id="opt-portfolio"
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
                    {p.name} · {fmt.format(p.cashBalance)} available
                  </option>
                ))}
                <option value={NEW_PORTFOLIO_SENTINEL}>
                  + New {currency} portfolio…
                </option>
              </select>

              {creating && (
                <InlinePortfolioCreate
                  currency={currency}
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
              <Label htmlFor="opt-qty">Contracts (100 shares each)</Label>
              <Input
                id="opt-qty"
                type="text"
                inputMode="numeric"
                value={contracts}
                onChange={(e) =>
                  setContracts(e.target.value.replace(/[^0-9]/g, ""))
                }
                autoFocus
              />
            </div>

            <div className="rounded-md border border-white/[0.06] bg-background/40 p-3 space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Premium × 100 × N</span>
                <span className="num">
                  {fmt.format(premium)} × 100 × {validQty ? contractsNum : 0}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                <span className="text-muted-foreground">Total cost</span>
                <span className="num font-medium">{fmt.format(cost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cash after</span>
                <span
                  className={`num ${canAfford ? "text-foreground" : "text-destructive"}`}
                >
                  {selected ? fmt.format(cashAfter) : "—"}
                </span>
              </div>
            </div>

            {noPremium && (
              <div className="text-[12px] text-warning flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                No live premium for this strike — pick a more liquid one.
              </div>
            )}
            {!canAfford && selected && validQty && !noPremium && (
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
                onClick={() => onOpenChange(false)}
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
                    : `Buy ${validQty ? contractsNum : ""}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
