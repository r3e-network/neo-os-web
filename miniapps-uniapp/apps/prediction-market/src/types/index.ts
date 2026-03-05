export interface PredictionMarket {
  id: number;
  question: string;
  description: string;
  category: string;
  endTime: number;
  resolutionTime?: number;
  oracle: string;
  creator: string;
  status: "open" | "closed" | "resolved" | "cancelled";
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  resolution?: boolean;
}

export interface Category {
  id: string;
  label: string;
}

export interface MarketOrder {
  id: number;
  marketId: number;
  orderType: "buy" | "sell";
  outcome: "yes" | "no";
  price: number;
  shares: number;
  filled?: number;
  status?: string;
}

export interface MarketPosition {
  marketId: number;
  outcome: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentValue?: number;
  pnl?: number;
}

export interface MarketFilters {
  category: string;
  sortBy: "volume" | "newest" | "ending";
}

export interface TradeParams {
  outcome: "yes" | "no";
  shares: number;
  price: number;
}
