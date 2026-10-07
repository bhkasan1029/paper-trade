"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "papertrade:recent-symbols";
const MAX_ITEMS = 10;

export type RecentSymbol = {
  symbol: string;
  name?: string;
  exchange?: string;
  viewedAt: number;
};

function read(): RecentSymbol[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSymbol[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentSymbol =>
        !!r && typeof r.symbol === "string" && typeof r.viewedAt === "number",
    );
  } catch {
    return [];
  }
}

function write(items: RecentSymbol[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota / private mode — silent
  }
  window.dispatchEvent(new CustomEvent("papertrade:recents-updated"));
}

export function useRecentSymbols() {
  const [items, setItems] = useState<RecentSymbol[]>([]);

  useEffect(() => {
    setItems(read());
    const sync = () => setItems(read());
    window.addEventListener("papertrade:recents-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("papertrade:recents-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const push = useCallback((entry: Omit<RecentSymbol, "viewedAt">) => {
    const symbol = entry.symbol.trim().toUpperCase();
    if (!symbol) return;
    const current = read();
    const withoutDup = current.filter((r) => r.symbol !== symbol);
    const next: RecentSymbol[] = [
      { ...entry, symbol, viewedAt: Date.now() },
      ...withoutDup,
    ].slice(0, MAX_ITEMS);
    write(next);
  }, []);

  const remove = useCallback((symbol: string) => {
    const key = symbol.trim().toUpperCase();
    write(read().filter((r) => r.symbol !== key));
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  return { items, push, remove, clear };
}
