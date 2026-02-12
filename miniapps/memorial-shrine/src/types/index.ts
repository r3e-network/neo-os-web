export interface Memorial {
  id: number;
  name: string;
  photoHash: string;
  birthYear: number;
  deathYear: number;
  relationship: string;
  biography: string;
  obituary: string;
  hasRecentTribute: boolean;
  offerings: {
    incense: number;
    candle: number;
    flower: number;
    fruit: number;
    wine: number;
    feast: number;
  };
}
