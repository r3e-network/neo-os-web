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
}
