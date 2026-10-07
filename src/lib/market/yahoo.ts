import YahooFinance from "yahoo-finance2";
import type {
  MarketDataProvider,
  MarketQuote,
  MarketState,
  SearchResult,
  HistoryRange,
  HistoryResult,
  PriceBar,
  OptionContract,
  OptionsChain,
  OptionQuote,
  OptionType,
  NewsArticle,
} from "./provider";
import { SymbolNotFoundError } from "./provider";
import { getCached, setCached } from "./cache";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const searchCache = new Map<string, { at: number; results: SearchResult[] }>();
const SEARCH_TTL_MS = 60_000;

type YahooMarketState =
  | "REGULAR"
  | "CLOSED"
  | "PRE"
  | "POST"
  | "PREPRE"
  | "POSTPOST"
  | "PREPRE_MARKET"
  | "POSTPOST_MARKET"
  | string;

function normalizeMarketState(raw: YahooMarketState | undefined): MarketState {
  if (!raw) return "UNKNOWN";
  if (raw === "REGULAR") return "REGULAR";
  if (raw === "CLOSED") return "CLOSED";
  if (raw.startsWith("PRE")) return "PRE";
  if (raw.startsWith("POST")) return "POST";
  return "UNKNOWN";
}

export class YahooProvider implements MarketDataProvider {
  async quote(symbol: string): Promise<MarketQuote> {
    const key = symbol.trim().toUpperCase();
    if (!key) throw new SymbolNotFoundError(symbol);

    const cached = getCached(key);
    if (cached) return cached;

    let raw;
    try {
      raw = await yahooFinance.quote(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Distinguish "unknown symbol" (404-worthy) from real failures
      if (/not.?found|no.?data|invalid|unknown symbol/i.test(msg)) {
        throw new SymbolNotFoundError(key);
      }
      throw new Error(`Yahoo fetch failed for ${key}: ${msg}`);
    }

    if (!raw || raw.regularMarketPrice == null) {
      throw new SymbolNotFoundError(key);
    }

    const quote: MarketQuote = {
      symbol: raw.symbol ?? key,
      shortName: raw.shortName ?? raw.longName ?? key,
      price: Number(raw.regularMarketPrice),
      change: Number(raw.regularMarketChange ?? 0),
      changePercent: Number(raw.regularMarketChangePercent ?? 0),
      currency: raw.currency ?? "USD",
      marketState: normalizeMarketState(raw.marketState),
      dayHigh: raw.regularMarketDayHigh ?? undefined,
      dayLow: raw.regularMarketDayLow ?? undefined,
      volume: raw.regularMarketVolume ?? undefined,
      fiftyTwoWeekHigh: raw.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: raw.fiftyTwoWeekLow ?? undefined,
      exchange: raw.fullExchangeName ?? raw.exchange ?? undefined,
      fetchedAt: Date.now(),
    };

    setCached(quote);
    return quote;
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const key = q.toLowerCase();
    const cached = searchCache.get(key);
    if (cached && cached.at + SEARCH_TTL_MS > Date.now()) return cached.results;

    let raw;
    try {
      raw = await yahooFinance.search(q, { quotesCount: 10, newsCount: 0 });
    } catch {
      return [];
    }

    const quotes = (raw?.quotes ?? []) as Array<Record<string, unknown>>;
    const results: SearchResult[] = quotes
      .filter((r) => typeof r.symbol === "string")
      .map((r) => ({
        symbol: String(r.symbol),
        name: String(r.shortname ?? r.longname ?? r.symbol),
        exchange: r.exchDisp ? String(r.exchDisp) : undefined,
        type: r.quoteType ? String(r.quoteType) : undefined,
      }));

    searchCache.set(key, { at: Date.now(), results });
    return results;
  }

  async news(symbol: string, count = 10): Promise<NewsArticle[]> {
    const key = symbol.trim().toUpperCase();
    if (!key) return [];

    const cacheKey = `${key}::${count}`;
    const cached = newsCache.get(cacheKey);
    if (cached && cached.at + NEWS_TTL_MS > Date.now()) return cached.result;

    // 1) Primary: search().news — rich results (thumbnail, link, publisher).
    //    Great for US tickers, empty for most Indian .NS tickers.
    let searchNews: Array<{
      uuid?: string;
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: Date | string | number;
      type?: string;
      thumbnail?: { resolutions?: Array<{ url: string }> };
      relatedTickers?: string[];
    }> = [];
    try {
      const raw = await yahooFinance.search(key, {
        quotesCount: 0,
        newsCount: count,
      });
      searchNews = (raw?.news ?? []) as typeof searchNews;
    } catch {
      // fall through to insights
    }

    const articles: NewsArticle[] = searchNews
      .filter((n) => n.title && n.link)
      .map((n) => ({
        id: n.uuid ?? `${n.link}`,
        title: String(n.title),
        publisher: n.publisher ?? "Unknown",
        link: String(n.link),
        publishedAt: n.providerPublishTime
          ? new Date(
              n.providerPublishTime as string | number | Date,
            ).getTime()
          : 0,
        type: n.type,
        thumbnail: n.thumbnail?.resolutions?.[0]?.url,
        relatedTickers: n.relatedTickers,
      }));

    // 2) Fallback: insights().sigDevs — headline+date only, works for Indian
    //    tickers. We synthesize a Google News search URL so items are clickable.
    if (articles.length === 0) {
      try {
        const insights = (await yahooFinance.insights(key)) as {
          sigDevs?: Array<{ headline?: string; date?: Date | string }>;
        };
        const sigDevs = insights?.sigDevs ?? [];
        for (const s of sigDevs) {
          if (!s.headline) continue;
          const publisher = extractPublisher(s.headline) ?? "Yahoo Insights";
          const cleanHeadline = stripPublisherSuffix(s.headline);
          articles.push({
            id: `sigdev:${key}:${s.date}:${cleanHeadline.slice(0, 40)}`,
            title: cleanHeadline,
            publisher,
            link: `https://news.google.com/search?q=${encodeURIComponent(
              `${key.replace(/\.[A-Z]+$/, "")} ${cleanHeadline}`,
            )}`,
            publishedAt: s.date ? new Date(s.date).getTime() : 0,
            type: "SIG_DEV",
          });
        }
      } catch {
        // no insights either — return whatever we have (possibly empty)
      }
    }

    newsCache.set(cacheKey, { at: Date.now(), result: articles });
    return articles;
  }

  async optionsChain(symbol: string, expiration?: number): Promise<OptionsChain> {
    const key = symbol.trim().toUpperCase();
    if (!key) throw new SymbolNotFoundError(symbol);

    const cacheKey = `${key}::${expiration ?? "nearest"}`;
    const cached = chainCache.get(cacheKey);
    if (cached && cached.at + CHAIN_TTL_MS > Date.now()) return cached.result;

    let raw;
    try {
      raw = await yahooFinance.options(
        key,
        expiration ? { date: new Date(expiration) } : undefined,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not.?found|no.?data|invalid|unknown symbol/i.test(msg)) {
        throw new SymbolNotFoundError(key);
      }
      throw new Error(`Yahoo options failed for ${key}: ${msg}`);
    }

    if (!raw || !raw.options || raw.options.length === 0) {
      throw new SymbolNotFoundError(key);
    }

    const currency = (raw.quote?.currency as string) ?? "USD";
    const underlyingPrice = Number(raw.quote?.regularMarketPrice ?? 0);
    const expirations = (raw.expirationDates ?? []).map((d) =>
      new Date(d).getTime(),
    );
    expirations.sort((a, b) => a - b);

    const first = raw.options[0];
    const expMs = new Date(first.expirationDate).getTime();

    const mapContract =
      (optionType: OptionType) =>
      (c: (typeof first.calls)[number]): OptionContract => ({
        contractSymbol: c.contractSymbol,
        strike: Number(c.strike),
        lastPrice: Number(c.lastPrice ?? 0),
        bid: c.bid != null ? Number(c.bid) : undefined,
        ask: c.ask != null ? Number(c.ask) : undefined,
        volume: c.volume != null ? Number(c.volume) : undefined,
        openInterest: c.openInterest != null ? Number(c.openInterest) : undefined,
        impliedVolatility:
          c.impliedVolatility != null ? Number(c.impliedVolatility) : undefined,
        inTheMoney: Boolean(c.inTheMoney),
        expiration: new Date(c.expiration).getTime(),
        optionType,
        currency: (c.currency as string) ?? currency,
      });

    const result: OptionsChain = {
      underlyingSymbol: raw.underlyingSymbol ?? key,
      underlyingPrice,
      currency,
      expirations,
      selected: {
        expiration: expMs,
        calls: (first.calls ?? []).map(mapContract("call")),
        puts: (first.puts ?? []).map(mapContract("put")),
      },
      fetchedAt: Date.now(),
    };

    chainCache.set(cacheKey, { at: Date.now(), result });
    return result;
  }

  async optionQuote(contractSymbol: string): Promise<OptionQuote> {
    const key = contractSymbol.trim().toUpperCase();
    if (!key) throw new SymbolNotFoundError(contractSymbol);

    const cached = optionQuoteCache.get(key);
    if (cached && cached.at + OPTION_QUOTE_TTL_MS > Date.now()) return cached.value;

    let raw;
    try {
      raw = await yahooFinance.quote(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not.?found|no.?data|invalid|unknown symbol/i.test(msg)) {
        throw new SymbolNotFoundError(key);
      }
      throw new Error(`Yahoo option quote failed for ${key}: ${msg}`);
    }

    if (!raw || raw.regularMarketPrice == null) {
      throw new SymbolNotFoundError(key);
    }

    const parsed = parseOccContractSymbol(key);

    const quote: OptionQuote = {
      contractSymbol: raw.symbol ?? key,
      underlyingSymbol:
        (raw.underlyingSymbol as string | undefined) ?? parsed.underlyingSymbol,
      strike:
        raw.strike != null ? Number(raw.strike) : parsed.strike,
      optionType:
        (raw.quoteType as string | undefined) === "CALL"
          ? "call"
          : (raw.quoteType as string | undefined) === "PUT"
            ? "put"
            : parsed.optionType,
      expiration: raw.expireDate
        ? new Date(raw.expireDate as string | number | Date).getTime()
        : parsed.expiration,
      lastPrice: Number(raw.regularMarketPrice),
      bid: raw.bid != null ? Number(raw.bid) : undefined,
      ask: raw.ask != null ? Number(raw.ask) : undefined,
      currency: (raw.currency as string) ?? "USD",
      fetchedAt: Date.now(),
    };

    optionQuoteCache.set(key, { at: Date.now(), value: quote });
    return quote;
  }

  async history(symbol: string, range: HistoryRange): Promise<HistoryResult> {
    const key = symbol.trim().toUpperCase();
    if (!key) throw new SymbolNotFoundError(symbol);

    const cacheKey = `${key}::${range}`;
    const cached = historyCache.get(cacheKey);
    if (cached && cached.at + historyTtl(range) > Date.now()) return cached.result;

    const { interval, period1 } = rangeToParams(range);

    let raw;
    try {
      raw = await yahooFinance.chart(key, {
        period1,
        interval,
        includePrePost: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not.?found|no.?data|invalid|unknown symbol/i.test(msg)) {
        throw new SymbolNotFoundError(key);
      }
      throw new Error(`Yahoo chart failed for ${key}: ${msg}`);
    }

    const rows = (raw?.quotes ?? []) as Array<{
      date: Date | string;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      volume: number | null;
    }>;

    const bars: PriceBar[] = rows
      .filter((r) => r.close != null && r.open != null && r.high != null && r.low != null)
      .map((r) => ({
        time: Math.floor(new Date(r.date).getTime() / 1000),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: r.volume != null ? Number(r.volume) : undefined,
      }))
      .sort((a, b) => a.time - b.time);

    if (bars.length === 0) throw new SymbolNotFoundError(key);

    const result: HistoryResult = {
      symbol: raw?.meta?.symbol ?? key,
      currency: raw?.meta?.currency ?? "USD",
      range,
      interval,
      bars,
    };

    historyCache.set(cacheKey, { at: Date.now(), result });
    return result;
  }
}

const historyCache = new Map<string, { at: number; result: HistoryResult }>();

const chainCache = new Map<string, { at: number; result: OptionsChain }>();
const CHAIN_TTL_MS = 60_000;

const newsCache = new Map<string, { at: number; result: NewsArticle[] }>();
const NEWS_TTL_MS = 5 * 60_000;

// Yahoo sigDev headlines sometimes look like "Foo Bar Happened - Bloomberg News".
// Pull the source out of the suffix when present.
function extractPublisher(headline: string): string | null {
  const m = headline.match(/\s[-–—]\s([A-Z][A-Za-z0-9 .&']{2,40})$/);
  return m ? m[1].trim() : null;
}
function stripPublisherSuffix(headline: string): string {
  return headline.replace(/\s[-–—]\s([A-Z][A-Za-z0-9 .&']{2,40})$/, "").trim();
}

const optionQuoteCache = new Map<string, { at: number; value: OptionQuote }>();
const OPTION_QUOTE_TTL_MS = 20_000;

// OCC 21-char format: root(≤6) + YYMMDD + C|P + strike*1000 zero-padded to 8
// Example: AAPL240119C00150000 → AAPL, 2024-01-19, Call, $150.00
function parseOccContractSymbol(sym: string): {
  underlyingSymbol: string;
  expiration: number;
  optionType: OptionType;
  strike: number;
} {
  const m = sym.match(/^([A-Z.]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!m) {
    return { underlyingSymbol: sym, expiration: 0, optionType: "call", strike: 0 };
  }
  const [, root, yymmdd, cp, strikeRaw] = m;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  const year = yy + (yy >= 70 ? 1900 : 2000);
  return {
    underlyingSymbol: root,
    expiration: Date.UTC(year, mm - 1, dd),
    optionType: cp === "C" ? "call" : "put",
    strike: Number(strikeRaw) / 1000,
  };
}

function historyTtl(range: HistoryRange): number {
  // Intraday data changes fast; long ranges rarely
  if (range === "1D") return 30_000;
  if (range === "5D") return 60_000;
  if (range === "1M" || range === "3M" || range === "6M" || range === "YTD" || range === "1Y") return 5 * 60_000;
  return 30 * 60_000; // 3Y / 5Y / MAX
}

function rangeToParams(range: HistoryRange): {
  interval: "5m" | "15m" | "30m" | "60m" | "1d" | "1wk" | "1mo";
  period1: Date;
} {
  const now = new Date();
  const d = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const ytd = new Date(now.getFullYear(), 0, 1);

  switch (range) {
    case "1D":
      return { interval: "5m", period1: d(2) };
    case "5D":
      return { interval: "30m", period1: d(7) };
    case "1M":
      return { interval: "1d", period1: d(31) };
    case "3M":
      return { interval: "1d", period1: d(93) };
    case "6M":
      return { interval: "1d", period1: d(186) };
    case "YTD":
      return { interval: "1d", period1: ytd };
    case "1Y":
      return { interval: "1d", period1: d(365) };
    case "3Y":
      return { interval: "1wk", period1: d(365 * 3) };
    case "5Y":
      return { interval: "1wk", period1: d(365 * 5) };
    case "MAX":
      return { interval: "1mo", period1: new Date("1970-01-01") };
  }
}
