export type MarketState = "REGULAR" | "CLOSED" | "PRE" | "POST" | "UNKNOWN";

export interface MarketQuote {
  symbol: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: MarketState;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  exchange?: string;
  /** epoch millis when we fetched this quote */
  fetchedAt: number;
}

export class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Symbol not found: ${symbol}`);
    this.name = "SymbolNotFoundError";
  }
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export type HistoryRange =
  | "1D"
  | "5D"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "3Y"
  | "5Y"
  | "MAX";

export interface PriceBar {
  /** seconds since epoch (lightweight-charts uses seconds) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HistoryResult {
  symbol: string;
  currency: string;
  range: HistoryRange;
  interval: string;
  bars: PriceBar[];
}

export type OptionType = "call" | "put";

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney: boolean;
  /** epoch millis */
  expiration: number;
  optionType: OptionType;
  currency: string;
}

export interface OptionsExpiry {
  /** epoch millis */
  expiration: number;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionsChain {
  underlyingSymbol: string;
  underlyingPrice: number;
  currency: string;
  /** epoch millis, sorted ascending */
  expirations: number[];
  /** contracts for the selected expiration only */
  selected: OptionsExpiry;
  fetchedAt: number;
}

export interface OptionQuote {
  contractSymbol: string;
  underlyingSymbol: string;
  strike: number;
  optionType: OptionType;
  /** epoch millis */
  expiration: number;
  lastPrice: number;
  bid?: number;
  ask?: number;
  currency: string;
  fetchedAt: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  publisher: string;
  link: string;
  /** epoch millis */
  publishedAt: number;
  type?: string;
  thumbnail?: string;
  relatedTickers?: string[];
}

export interface MarketDataProvider {
  quote(symbol: string): Promise<MarketQuote>;
  search(query: string): Promise<SearchResult[]>;
  history(symbol: string, range: HistoryRange): Promise<HistoryResult>;
  optionsChain(symbol: string, expiration?: number): Promise<OptionsChain>;
  optionQuote(contractSymbol: string): Promise<OptionQuote>;
  news(symbol: string, count?: number): Promise<NewsArticle[]>;
}
