import { NextResponse } from "next/server";
import { marketData, SymbolNotFoundError } from "@/lib/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const expRaw = searchParams.get("expiration");

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const expiration = expRaw ? Number(expRaw) : undefined;
  if (expiration !== undefined && !Number.isFinite(expiration)) {
    return NextResponse.json({ error: "invalid expiration" }, { status: 400 });
  }

  try {
    const chain = await marketData.optionsChain(symbol, expiration);
    return NextResponse.json(chain);
  } catch (err) {
    if (err instanceof SymbolNotFoundError) {
      return NextResponse.json(
        { error: "No options chain available for this symbol" },
        { status: 404 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
