export interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

export interface SearchResult {
  available: boolean;
  price?: number;
  owner?: string;
}
