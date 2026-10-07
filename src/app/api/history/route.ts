import { NextResponse } from "next/server";
import { marketData, SymbolNotFoundError } from "@/lib/market";
import type { HistoryRange } from "@/lib/market";

const VALID_RANGES: HistoryRange[] = [
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y",
  "5Y",
  "MAX",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim();
  const rangeParam = (searchParams.get("range") ?? "1M").toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required query param: symbol" },
      { status: 400 },
    );
  }

  if (!VALID_RANGES.includes(rangeParam as HistoryRange)) {
    return NextResponse.json(
      {
        error: `Invalid range: ${rangeParam}. Must be one of ${VALID_RANGES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await marketData.history(symbol, rangeParam as HistoryRange);
    return NextResponse.json(result);
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
