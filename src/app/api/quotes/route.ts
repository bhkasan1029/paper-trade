import { NextResponse } from "next/server";
import { marketData, SymbolNotFoundError } from "@/lib/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {}, errors: {} });
  }

  const results = await Promise.allSettled(
    symbols.map((s) => marketData.quote(s)),
  );

  const quotes: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  results.forEach((r, i) => {
    const sym = symbols[i];
    if (r.status === "fulfilled") {
      quotes[sym] = r.value;
    } else {
      errors[sym] =
        r.reason instanceof SymbolNotFoundError
          ? "not_found"
          : r.reason instanceof Error
            ? r.reason.message
            : String(r.reason);
    }
  });

  return NextResponse.json({ quotes, errors });
}
