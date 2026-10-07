"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { createPortfolioForTrade } from "../portfolios/actions";
import type { PortfolioOption } from "./buy-dialog";

export function InlinePortfolioCreate({
  currency,
  onCreated,
  onCancel,
}: {
  currency: "INR" | "USD" | string;
  onCreated: (p: PortfolioOption) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [cash, setCash] = useState(currency === "INR" ? "1000000" : "100000");
  const [pending, startTransition] = useTransition();

  const symbol = currency === "INR" ? "₹" : "$";
  const cashNum = Number(cash);
  const validName = name.trim().length > 0;
  const validCash = Number.isFinite(cashNum) && cashNum > 0;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-primary tracking-wide">
          New {currency} portfolio
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-name" className="text-[12px]">
          Name
        </Label>
        <Input
          id="np-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Options Sandbox"
          autoFocus
          className="h-9 text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-cash" className="text-[12px]">
          Starting cash
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">
            {symbol}
          </span>
          <Input
            id="np-cash"
            type="text"
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-9 pl-7 text-[13px]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || !validName || !validCash}
          onClick={() => {
            startTransition(async () => {
              try {
                const created = await createPortfolioForTrade({
                  name: name.trim(),
                  currency: currency === "USD" ? "USD" : "INR",
                  startingCash: cashNum,
                });
                toast.success(`Created ${created.name}`);
                onCreated(created);
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Create failed",
                );
              }
            });
          }}
        >
          {pending ? "Creating…" : "Create + use"}
        </Button>
      </div>
    </div>
  );
}
