"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, TrendingUp, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/market";
import { useRecentSymbols } from "@/lib/use-recent-symbols";

export function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { items: recents, remove: removeRecent, clear: clearRecents } =
    useRecentSymbols();

  const trimmed = q.trim();
  const showRecents = !trimmed && recents.length > 0;
  // The list currently rendered — either search results or recents — so that
  // ↑/↓/↵ can drive both without duplicating logic
  const activeList = useMemo<SearchResult[]>(
    () =>
      showRecents
        ? recents.map((r) => ({
            symbol: r.symbol,
            name: r.name ?? r.symbol,
            exchange: r.exchange,
          }))
        : results,
    [showRecents, recents, results],
  );

  // ⌘K / ctrl+K focuses the input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // click-outside closes dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  // debounced search
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(`/search?symbol=${encodeURIComponent(symbol)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(activeList.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = activeList[active];
      if (chosen) go(chosen.symbol);
      else if (q.trim()) go(q.trim().toUpperCase());
    }
  };

  const showDropdown =
    open && (loading || results.length > 0 || q.trim() || showRecents);

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl min-w-0">
      <Search className="absolute left-3 md:left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-black/40 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search ticker…"
        className="w-full h-9 md:h-10 pl-9 md:pl-10 pr-9 md:pr-16 rounded-md bg-black/5 border border-black/10 text-black text-[14px] md:text-[15px] placeholder:text-black/40 outline-none focus:border-black/30"
      />
      {loading ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-black/40" />
      ) : (
        <kbd className="hidden md:inline-block absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] rounded bg-black/5 border border-black/10 text-black/50">
          ⌘K
        </kbd>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] rounded-lg border border-black/10 bg-card/60 backdrop-blur-md overflow-hidden z-50 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.15)]">
          {showRecents ? (
            <>
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                <span className="text-[10px] tracking-[0.14em] uppercase text-black/50 font-medium flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recently viewed
                </span>
                <button
                  type="button"
                  onClick={() => clearRecents()}
                  className="text-[10px] text-black/50 hover:text-black transition-colors"
                >
                  Clear
                </button>
              </div>
              <ul className="max-h-80 overflow-y-auto py-1">
                {recents.map((r, i) => (
                  <li key={r.symbol} className="group relative">
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.symbol)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        i === active
                          ? "bg-black/10"
                          : "hover:bg-black/5",
                      )}
                    >
                      <div className="h-7 w-7 shrink-0 rounded bg-black/5 flex items-center justify-center">
                        <Clock className="h-3.5 w-3.5 text-black/50" />
                      </div>
                      <div className="min-w-0 flex-1 pr-7">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate text-[15px]">
                            {r.symbol}
                          </span>
                        </div>
                        <div className="text-[12px] text-black/50 truncate mt-0.5">
                          {r.name ?? r.symbol}
                          {r.exchange && (
                            <span className="ml-1.5 text-black/40">
                              · {r.exchange}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(r.symbol);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-black/50 opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-black hover:bg-black/10 transition-all"
                      aria-label={`Remove ${r.symbol}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-5 text-[13px] text-black/50 text-center">
              {q.trim() ? "No matches." : "Start typing…"}
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {results.map((r, i) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.symbol)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      i === active
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <div className="h-7 w-7 shrink-0 rounded bg-black/5 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-black/50" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-[15px]">
                          {r.symbol}
                        </span>
                        {r.type && (
                          <span className="px-1.5 py-0.5 text-[10px] tracking-wider rounded bg-black/5 text-black/50 border border-black/10">
                            {r.type}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-black/50 truncate mt-0.5">
                        {r.name}
                        {r.exchange && (
                          <span className="ml-1.5 text-black/40">
                            · {r.exchange}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length > 0 && (
            <div className="border-t border-black/10 bg-black/[0.03] px-3.5 py-2 text-[11px] text-black/50 flex items-center justify-between">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-black/5 text-[10px] border border-black/10 mr-0.5">↑↓</kbd>{" "}
                navigate ·{" "}
                <kbd className="px-1 py-0.5 rounded bg-black/5 text-[10px] border border-black/10 mx-0.5">↵</kbd>{" "}
                open ·{" "}
                <kbd className="px-1 py-0.5 rounded bg-black/5 text-[10px] border border-black/10 mx-0.5">esc</kbd>{" "}
                close
              </span>
              <span className="tracking-wider">{results.length} matches</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
