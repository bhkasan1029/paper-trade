"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  CandlestickSeries,
  AreaSeries,
  CrosshairMode,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import type { HistoryRange, HistoryResult, PriceBar } from "@/lib/market";
import { Loader2, CandlestickChart, LineChart } from "lucide-react";

const RANGES: HistoryRange[] = [
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

type ChartType = "AREA" | "CANDLES";

export function PriceChart({ symbol }: { symbol: string }) {
  const [currency, setCurrency] = useState<string>("USD");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const [range, setRange] = useState<HistoryRange>("1M");
  const [type, setType] = useState<ChartType>("AREA");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ first?: PriceBar; last?: PriceBar } | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.55)",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(129,255,178,0.4)", width: 1, style: 2 },
        horzLine: { color: "rgba(129,255,178,0.4)", width: 1, style: 2 },
      },
      autoSize: true,
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ autoSize: true });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch and render series when symbol / range / type changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as HistoryResult;
        if (cancelled || !chartRef.current) return;
        setCurrency(data.currency);

        // remove previous series if type or data changed
        if (seriesRef.current) {
          chartRef.current.removeSeries(seriesRef.current);
          seriesRef.current = null;
        }

        const rising =
          data.bars.length > 1 &&
          data.bars[data.bars.length - 1].close >= data.bars[0].close;
        const lineColor = rising ? "#22c98a" : "#e5484d";

        if (type === "CANDLES") {
          const series = chartRef.current.addSeries(CandlestickSeries, {
            upColor: "#22c98a",
            downColor: "#e5484d",
            wickUpColor: "#22c98a",
            wickDownColor: "#e5484d",
            borderVisible: false,
          });
          series.setData(
            data.bars.map((b) => ({
              time: b.time as never,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
            })),
          );
          seriesRef.current = series;
        } else {
          const series = chartRef.current.addSeries(AreaSeries, {
            lineColor,
            topColor: rising
              ? "rgba(34,201,138,0.28)"
              : "rgba(229,72,77,0.28)",
            bottomColor: "rgba(255,255,255,0)",
            lineWidth: 2,
            priceLineVisible: false,
          });
          series.setData(
            data.bars.map((b) => ({ time: b.time as never, value: b.close })),
          );
          seriesRef.current = series;
        }

        chartRef.current.timeScale().fitContent();
        setMeta({
          first: data.bars[0],
          last: data.bars[data.bars.length - 1],
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, type]);

  const first = meta?.first?.close;
  const last = meta?.last?.close;
  const rangeChange = first && last ? last - first : undefined;
  const rangeChangePct =
    first && last && first !== 0 ? ((last - first) / first) * 100 : undefined;
  const positive = (rangeChange ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card p-3 md:p-5 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 min-w-0">
          <h2 className="text-base md:text-lg font-semibold tracking-tight">Price History</h2>
          {rangeChange !== undefined && rangeChangePct !== undefined && (
            <span
              className={cn(
                "num text-[11px] md:text-xs px-2 py-0.5 rounded border break-all",
                positive
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-destructive/10 text-destructive border-destructive/20",
              )}
            >
              {positive ? "+" : ""}
              {formatMoney(rangeChange, currency)} (
              {positive ? "+" : ""}
              {rangeChangePct.toFixed(2)}%) · {range}
            </span>
          )}
        </div>

        <div className="flex self-start md:self-auto items-center gap-1 p-0.5 rounded-md border border-white/[0.06] bg-background/40">
          <button
            type="button"
            onClick={() => setType("AREA")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
              type === "AREA"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LineChart className="h-3 w-3" />
            Area
          </button>
          <button
            type="button"
            onClick={() => setType("CANDLES")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
              type === "CANDLES"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CandlestickChart className="h-3 w-3" />
            Candles
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[260px] sm:h-[320px] md:h-[380px] w-full rounded-md overflow-hidden"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/40 backdrop-blur-[1px]">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-xs text-destructive text-center break-words">
              Couldn&apos;t load chart: {error}
            </div>
          </div>
        )}
      </div>

      {/* Range toggle — scrollable on mobile so all 10 ranges are reachable */}
      <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-md border border-white/[0.06] bg-background/40">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1.5 md:py-1 rounded text-xs transition-colors num shrink-0",
                range === r
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
