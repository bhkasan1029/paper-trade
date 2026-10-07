"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { deletePortfolio, renamePortfolio, updatePortfolioCash } from "../actions";
import { toast } from "sonner";
import { ChevronLeft, MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";

export function PortfolioHeader({
  id,
  name,
  startingCash,
  currency,
}: {
  id: string;
  name: string;
  startingCash: number;
  currency: string;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-3 md:gap-4">
      <div className="min-w-0">
        <Link
          href="/portfolios"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-2 md:mb-2.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All portfolios
        </Link>
        <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight leading-tight break-words">
          {name}
        </h1>
        <p className="text-[13px] md:text-[15px] text-muted-foreground mt-1 md:mt-1.5">
          {currency} paper portfolio
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCashOpen(true)}>
            <Wallet className="h-4 w-4 mr-2" />
            Reset starting cash
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete portfolio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename portfolio</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              const next = String(fd.get("name") || "");
              startTransition(async () => {
                try {
                  await renamePortfolio(id, next);
                  toast.success("Renamed");
                  setRenameOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                name="name"
                defaultValue={name}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset cash dialog */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset starting cash</DialogTitle>
            <DialogDescription>
              This resets both the starting cash and current cash balance. Use
              before you have real trades — resetting after trading is skewed.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) => {
              const raw = String(fd.get("startingCash") || "0").replace(
                /[^0-9.]/g,
                "",
              );
              const val = Number(raw);
              startTransition(async () => {
                try {
                  await updatePortfolioCash(id, val);
                  toast.success("Cash updated");
                  setCashOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cash">Starting cash</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currency === "INR" ? "₹" : "$"}
                </span>
                <Input
                  id="cash"
                  name="startingCash"
                  type="text"
                  inputMode="decimal"
                  defaultValue={startingCash}
                  className="pl-7"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCashOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the portfolio and all its trades and
              notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    await deletePortfolio(id);
                  } catch (err) {
                    const msg =
                      err instanceof Error ? err.message : String(err);
                    if (!msg.includes("NEXT_REDIRECT")) toast.error(msg);
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
