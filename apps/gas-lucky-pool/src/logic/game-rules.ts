export const GAS_LUCKY_REWARD_PLANS = [
  {
    key: "small",
    titleKey: "vaultPackStarter",
    sceneTitleKey: "packStarter",
    fallbackTitle: "Starter",
    amount: "20",
    minClaim: "1",
    maxClaim: "3",
    maxClaims: "10",
    expiryHours: "24",
  },
  {
    key: "balanced",
    titleKey: "vaultPackParty",
    sceneTitleKey: "packParty",
    fallbackTitle: "Party",
    amount: "50",
    minClaim: "1",
    maxClaim: "5",
    maxClaims: "25",
    expiryHours: "72",
  },
  {
    key: "jackpot",
    titleKey: "vaultPackJackpot",
    sceneTitleKey: "packJackpot",
    fallbackTitle: "Jackpot",
    amount: "100",
    minClaim: "5",
    maxClaim: "20",
    maxClaims: "10",
    expiryHours: "168",
  },
] as const;

export type GasLuckyRewardPlan = (typeof GAS_LUCKY_REWARD_PLANS)[number];

