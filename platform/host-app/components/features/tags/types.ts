/**
 * Tag System Types
 * Steam-inspired multi-dimensional tagging
 */

export interface AppTag {
  id: string;
  name: string;
  name_zh?: string;
  type: "genre" | "feature" | "theme";
  count?: number;
}

export interface TagFilter {
  tags: string[];
  matchAll?: boolean; // AND vs OR
}

// Predefined tags for MiniApps
export const PREDEFINED_TAGS: AppTag[] = [
  // Genre tags
  { id: "casual", name: "Casual", name_zh: "休闲", type: "genre" },
  { id: "strategy", name: "Strategy", name_zh: "策略", type: "genre" },
  { id: "simulation", name: "Simulation", name_zh: "模拟", type: "genre" },
  { id: "puzzle", name: "Puzzle", name_zh: "益智", type: "genre" },

  // Feature tags
  { id: "multiplayer", name: "Multiplayer", name_zh: "多人", type: "feature" },
  { id: "pvp", name: "PvP", name_zh: "对战", type: "feature" },
  { id: "rewards", name: "Rewards", name_zh: "奖励", type: "feature" },
  { id: "staking", name: "Staking", name_zh: "质押", type: "feature" },
  { id: "trading", name: "Trading", name_zh: "交易", type: "feature" },
  { id: "voting", name: "Voting", name_zh: "投票", type: "feature" },

  // Theme tags
  { id: "crypto", name: "Crypto", name_zh: "加密", type: "theme" },
  { id: "finance", name: "Finance", name_zh: "金融", type: "theme" },
  { id: "community", name: "Community", name_zh: "社区", type: "theme" },
  { id: "art", name: "Art", name_zh: "艺术", type: "theme" },
];

// Map app_id to tags
export const APP_TAGS: Record<string, string[]> = {
  lottery: ["casual", "rewards", "crypto"],
  dice: ["casual", "pvp", "rewards"],
  "coin-flip": ["casual", "pvp", "crypto"],
  "neo-swap": ["trading", "finance", "crypto"],
  neoburger: ["staking", "rewards", "finance"],
  "candidate-vote": ["voting", "community", "strategy"],
  "council-governance": ["voting", "community", "strategy"],
  "garden-of-neo": ["simulation", "rewards", "community"],
  "time-capsule": ["crypto", "community"],
  "red-envelope": ["casual", "rewards", "community"],
};
