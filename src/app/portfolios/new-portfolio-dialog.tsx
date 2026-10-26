"use client";

import { useState, useTransition } from "react";
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
import { createPortfolio } from "./actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function NewPortfolioDialog() {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-primary/15 text-[#E37383] border border-primary/30 hover:bg-primary/25"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create portfolio</DialogTitle>
          <DialogDescription>
            Give it a name and set your starting paper cash.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("currency", currency);
            startTransition(async () => {
              try {
                await createPortfolio(fd);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (!msg.includes("NEXT_REDIRECT")) toast.error(msg);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Growth Bets, Learning Dividend, Options Sandbox"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <div className="flex gap-2">
              {(["INR", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-md border text-sm transition-colors ${
                    currency === c
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingCash">Starting cash</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currency === "INR" ? "₹" : "$"}
              </span>
              <Input
                id="startingCash"
                name="startingCash"
                type="text"
                inputMode="decimal"
                defaultValue={currency === "INR" ? "1000000" : "100000"}
                className="pl-7"
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {currency === "INR"
                ? "Suggested: ₹10,00,000 (10 lakh)"
                : "Suggested: $100,000"}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create portfolio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
