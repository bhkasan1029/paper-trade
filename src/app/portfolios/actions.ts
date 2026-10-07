"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

export async function createPortfolio(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const currency = (String(formData.get("currency") || "INR").toUpperCase() ===
  "USD"
    ? "USD"
    : "INR") as "INR" | "USD";
  const rawCash = String(formData.get("startingCash") || "0").replace(
    /[^0-9.]/g,
    "",
  );
  const startingCash = new Prisma.Decimal(rawCash || "0");

  if (!name) throw new Error("Name is required");
  if (startingCash.lessThanOrEqualTo(0))
    throw new Error("Starting cash must be greater than 0");

  const created = await db.portfolio.create({
    data: {
      name,
      currency,
      startingCash,
      cashBalance: startingCash,
    },
  });

  revalidatePath("/portfolios");
  revalidatePath("/");
  redirect(`/portfolios/${created.id}`);
}

// Same as createPortfolio, but returns the row instead of redirecting.
// Used by the inline "+ New portfolio" option inside the buy dialogs.
export async function createPortfolioForTrade(input: {
  name: string;
  currency: "INR" | "USD";
  startingCash: number;
}): Promise<{
  id: string;
  name: string;
  currency: string;
  cashBalance: number;
}> {
  const name = input.name.trim();
  const currency: "INR" | "USD" = input.currency === "USD" ? "USD" : "INR";
  const startingCash = new Prisma.Decimal(input.startingCash || 0);

  if (!name) throw new Error("Name is required");
  if (startingCash.lessThanOrEqualTo(0))
    throw new Error("Starting cash must be greater than 0");

  const created = await db.portfolio.create({
    data: {
      name,
      currency,
      startingCash,
      cashBalance: startingCash,
    },
  });

  revalidatePath("/portfolios");
  revalidatePath("/");

  return {
    id: created.id,
    name: created.name,
    currency: created.currency,
    cashBalance: Number(created.cashBalance),
  };
}

export async function renamePortfolio(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  await db.portfolio.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${id}`);
}

export async function updatePortfolioCash(id: string, startingCash: number) {
  if (startingCash <= 0) throw new Error("Cash must be > 0");
  const decimal = new Prisma.Decimal(startingCash);
  await db.portfolio.update({
    where: { id },
    data: { startingCash: decimal, cashBalance: decimal },
  });
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${id}`);
  revalidatePath("/");
}

export async function deletePortfolio(id: string) {
  await db.portfolio.delete({ where: { id } });
  revalidatePath("/portfolios");
  revalidatePath("/");
  redirect("/portfolios");
}
