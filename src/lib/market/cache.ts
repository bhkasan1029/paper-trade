import type { MarketQuote } from "./provider";

const QUOTE_TTL_MS = 20_000;

type Entry = { value: MarketQuote; expiresAt: number };

const store = new Map<string, Entry>();

export function getCached(symbol: string): MarketQuote | null {
  const key = symbol.toUpperCase();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(quote: MarketQuote): void {
  store.set(quote.symbol.toUpperCase(), {
    value: quote,
    expiresAt: Date.now() + QUOTE_TTL_MS,
  });
}

export function clearCache(): void {
  store.clear();
}
