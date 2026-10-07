import { YahooProvider } from "./yahoo";
import type { MarketDataProvider } from "./provider";

export type {
  MarketDataProvider,
  MarketQuote,
  MarketState,
  SearchResult,
  HistoryRange,
  HistoryResult,
  PriceBar,
  OptionType,
  OptionContract,
  OptionsExpiry,
  OptionsChain,
  OptionQuote,
  NewsArticle,
} from "./provider";
export { SymbolNotFoundError } from "./provider";

export const marketData: MarketDataProvider = new YahooProvider();
