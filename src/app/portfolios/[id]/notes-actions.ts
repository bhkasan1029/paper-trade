"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addNote(
  portfolioId: string,
  body: string,
  symbol?: string | null,
) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note is empty");
  await db.note.create({
    data: {
      portfolioId,
      body: trimmed,
      symbol: symbol?.trim() ? symbol.trim().toUpperCase() : null,
    },
  });
  revalidatePath(`/portfolios/${portfolioId}`);
}

export async function updateNote(
  id: string,
  portfolioId: string,
  body: string,
  symbol?: string | null,
) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note is empty");
  await db.note.update({
    where: { id },
    data: {
      body: trimmed,
      symbol: symbol?.trim() ? symbol.trim().toUpperCase() : null,
    },
  });
  revalidatePath(`/portfolios/${portfolioId}`);
}

export async function deleteNote(id: string, portfolioId: string) {
  await db.note.delete({ where: { id } });
  revalidatePath(`/portfolios/${portfolioId}`);
}
