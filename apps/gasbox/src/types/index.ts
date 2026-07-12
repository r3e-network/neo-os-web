export interface MachineItem {
  /** Contract item index. MiniAppGasBoxV2 stores items at 1..itemCount. */
  index: number;
  name: string;
  probability: number;
  displayProbability: number;
  rarity: string;
  assetType: number;
  assetHash: string;
  amountRaw: number;
  /** Exact prize amount in base units. Use this for comparisons and writes. */
  amountBaseUnits: string;
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
  /** Exact GAS pull price in base units. */
  priceBaseUnits: string;
  itemCount: number;
  totalWeight: number;
  availableWeight: number;
  plays: number;
  revenue: string;
  revenueRaw: number;
  /** Exact accrued GAS revenue in base units. */
  revenueBaseUnits: string;
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
  /** Exact total pool balance in prize-asset base units. */
  poolBalanceBaseUnits: string;
  /** Pool balance reserved for unsettled pulls (display). */
  reservedPool: string;
  /** Exact reserved pool amount in prize-asset base units. */
  reservedPoolBaseUnits: string;
  /** Pool balance available to new pulls or creator withdrawal (display). */
  freePool: string;
  /** Exact free pool amount in prize-asset base units. */
  freePoolBaseUnits: string;
  /** Largest single item prize the pool must cover before activation (display). */
  maxPrize: string;
  /** Largest single item prize (base units). */
  maxPrizeRaw: number;
  /** Exact largest-prize amount in prize-asset base units. */
  maxPrizeBaseUnits: string;
  /** Whether the pool covers the max prize (the contract's activation gate). */
  poolReady: boolean;
}
