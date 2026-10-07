"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

type AddInput = {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
};

export async function addToWatchlist(input: AddInput) {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol required");

  await db.watchlistItem.upsert({
    where: { symbol },
    create: {
      symbol,
      name: input.name?.trim() || null,
      exchange: input.exchange?.trim() || null,
    },
    update: {
      name: input.name?.trim() || null,
      exchange: input.exchange?.trim() || null,
    },
  });

  revalidatePath("/watchlist");
  revalidatePath("/", "layout");
}

export async function removeFromWatchlist(symbol: string) {
  const key = symbol.trim().toUpperCase();
  if (!key) return;
  await db.watchlistItem.deleteMany({ where: { symbol: key } });
  revalidatePath("/watchlist");
  revalidatePath("/", "layout");
}

export async function isWatched(symbol: string): Promise<boolean> {
  const key = symbol.trim().toUpperCase();
  if (!key) return false;
  const found = await db.watchlistItem.findUnique({ where: { symbol: key } });
  return !!found;
}
