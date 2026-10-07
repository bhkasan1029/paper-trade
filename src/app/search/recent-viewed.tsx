"use client";

import Link from "next/link";
import { Clock, X, ChevronRight } from "lucide-react";
import { useRecentSymbols } from "@/lib/use-recent-symbols";

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function RecentViewed() {
  const { items, remove, clear } = useRecentSymbols();

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[13px] tracking-wider uppercase text-muted-foreground font-medium">
            Recently viewed
          </h3>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {items.map((r) => (
          <li key={r.symbol} className="group relative">
            <Link
              href={`/search?symbol=${encodeURIComponent(r.symbol)}`}
              className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-white/[0.02] transition-colors pr-16"
            >
              <div className="h-8 w-8 shrink-0 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-[11px] font-semibold text-primary tracking-tight">
                  {r.symbol.slice(0, 4)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[14px] md:text-[15px] truncate">
                    {r.symbol}
                  </span>
                  {r.exchange && (
                    <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                      {r.exchange}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground truncate mt-0.5">
                  {r.name ?? r.symbol}
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                {timeAgo(r.viewedAt)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden md:block" />
            </Link>
            <button
              type="button"
              onClick={() => remove(r.symbol)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded flex items-center justify-center text-muted-foreground opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:text-foreground hover:bg-white/[0.05] transition-all"
              aria-label={`Remove ${r.symbol} from recents`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
