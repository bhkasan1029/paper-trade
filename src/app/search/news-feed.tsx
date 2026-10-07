"use client";

import { useEffect, useState } from "react";
import { Loader2, Newspaper, ExternalLink } from "lucide-react";
import { MicroBadge } from "@/components/metric-card";
import type { NewsArticle } from "@/lib/market";

function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function NewsFeed({ symbol }: { symbol: string }) {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticles(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/news?symbol=${encodeURIComponent(symbol)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as { articles: NewsArticle[] };
        if (!cancelled) setArticles(data.articles ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 md:p-6 flex items-center gap-3 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading news…
      </div>
    );
  }

  if (error || !articles) return null;
  if (articles.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[15px] font-medium">News</h3>
          <MicroBadge tone="muted">{articles.length}</MicroBadge>
        </div>
        {articles.every((a) => a.type === "SIG_DEV") && (
          <span className="text-[11px] text-muted-foreground">
            latest headlines · via Yahoo
          </span>
        )}
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {articles.map((a) => (
          <li key={a.id}>
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 md:gap-4 px-4 md:px-6 py-3.5 hover:bg-white/[0.02] transition-colors group"
            >
              {a.thumbnail ? (
                <div className="relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-md overflow-hidden bg-white/[0.03] border border-white/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-md bg-primary/[0.06] border border-primary/[0.15] flex items-center justify-center">
                  <Newspaper className="h-5 w-5 text-primary/70" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] md:text-[14px] font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2 md:line-clamp-3">
                  {a.title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] md:text-[12px] text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground/80 truncate">
                    {a.publisher}
                  </span>
                  {a.publishedAt > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{timeAgo(a.publishedAt)}</span>
                    </>
                  )}
                  {a.type === "SIG_DEV" ? (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[10px] text-muted-foreground/80">
                        search on Google News →
                      </span>
                    </>
                  ) : (
                    a.type &&
                    a.type !== "STORY" && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="uppercase tracking-wider text-[10px] text-primary/80">
                          {a.type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </>
                    )
                  )}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center hidden md:block" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
