import { NextResponse } from "next/server";
import { marketData } from "@/lib/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const countRaw = searchParams.get("count");
  const count = countRaw ? Math.min(30, Math.max(1, Number(countRaw))) : 10;

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const articles = await marketData.news(symbol, count);
    return NextResponse.json({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
