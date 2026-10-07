export type Currency = "INR" | "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

/**
 * Format a number as INR using Indian lakh/crore grouping.
 * 1000000 -> ₹10,00,000
 */
export function formatCurrency(
  amount: number | string,
  currency: Currency = "INR",
  opts: { compact?: boolean } = {},
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return `${CURRENCY_SYMBOL[currency]}—`;

  if (opts.compact) {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
  }

  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  return Number(cleaned || "0");
}
