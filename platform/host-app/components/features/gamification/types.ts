export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "achievement" | "activity" | "special";
  rarity: "common" | "rare" | "epic" | "legendary";
  requirement: string;
  points: number;
}

export interface UserLevel {
  level: number;
  name: string;
  minXP: number;
  maxXP: number;
  color: string;
  perks: string[];
}

export interface UserStats {
  wallet: string;
  xp: number;
  level: number;
  badges: string[];
  rank: number;
  streak: number;
  totalTx: number;
  totalVotes: number;
  appsUsed: number;
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  name?: string;
  xp: number;
  level: number;
  badges: number;
}
