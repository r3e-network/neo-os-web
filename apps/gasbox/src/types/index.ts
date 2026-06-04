export interface MachineItem {
  name: string;
  probability: number;
  displayProbability: number;
  rarity: string;
  assetType: number;
  assetHash: string;
  amountRaw: number;
  amountDisplay: string;
  tokenId: string;
  stockRaw: number;
  stockDisplay: string;
  tokenCount: number;
  decimals: number;
  available: boolean;
  icon?: string;
}

export interface Machine {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  tagsList: string[];
  creator: string;
  creatorHash: string;
  owner: string;
  ownerHash: string;
  price: string;
  priceRaw: number;
  itemCount: number;
  totalWeight: number;
  availableWeight: number;
  plays: number;
  revenue: string;
  revenueRaw: number;
  sales: number;
  salesVolume: string;
  salesVolumeRaw: number;
  createdAt: number;
  lastPlayedAt: number;
  active: boolean;
  listed: boolean;
  banned: boolean;
  locked: boolean;
  forSale: boolean;
  salePrice: string;
  salePriceRaw: number;
  inventoryReady: boolean;
  items: MachineItem[];
  topPrize?: string;
  winRate?: number;
  /** Prize asset paid out by every item on the machine (GAS or NEO). */
  prizeAsset: "NEO" | "GAS";
  /** On-chain prize pool balance (display, in prizeAsset units). */
  poolBalance: string;
  /** On-chain prize pool balance (base units). */
  poolBalanceRaw: number;
  /** Largest single item prize the pool must cover before activation (display). */
  maxPrize: string;
  /** Largest single item prize (base units). */
  maxPrizeRaw: number;
  /** Whether the pool covers the max prize (the contract's activation gate). */
  poolReady: boolean;
}
