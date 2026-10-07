import { NextResponse } from "next/server";
import { marketData, SymbolNotFoundError } from "@/lib/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim();

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required query param: symbol" },
      { status: 400 },
    );
  }

  try {
    const quote = await marketData.quote(symbol);
    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof SymbolNotFoundError) {
      return NextResponse.json(
        { error: err.message, symbol },
        { status: 404 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
