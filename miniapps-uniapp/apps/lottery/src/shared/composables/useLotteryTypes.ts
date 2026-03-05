/**
 * Lottery Types configuration for NeoLucky MiniApp
 * Defines the different tiers of scratch lottery games available
 */
import { computed } from "vue";

export type LotteryType = "neo-bronze" | "neo-silver" | "neo-gold" | "neo-platinum" | "neo-diamond";

export interface LotteryTypeInfo {
    key: string;
    type: LotteryType;
    name: string;
    price: number;
    priceDisplay: string;
    maxJackpot: number;
    maxJackpotDisplay: string;
    winRate: number; // percentage chance of winning something
    description: string;
    color: string;
}

export interface PrizeTier {
    name: string;
    multiplier: number; // multiplier of ticket price
    chance: number; // percentage chance
}

export const PRIZE_TIERS: Record<LotteryType, PrizeTier[]> = {
    "neo-bronze": [
        { name: "Mini", multiplier: 1.5, chance: 20 },
        { name: "Small", multiplier: 3, chance: 10 },
        { name: "Medium", multiplier: 5, chance: 3 },
        { name: "Large", multiplier: 10, chance: 0.5 },
        { name: "Jackpot", multiplier: 50, chance: 0.05 },
    ],
    "neo-silver": [
        { name: "Mini", multiplier: 1.5, chance: 18 },
        { name: "Small", multiplier: 3, chance: 9 },
        { name: "Medium", multiplier: 7, chance: 3 },
        { name: "Large", multiplier: 15, chance: 0.5 },
        { name: "Jackpot", multiplier: 100, chance: 0.03 },
    ],
    "neo-gold": [
        { name: "Mini", multiplier: 1.5, chance: 15 },
        { name: "Small", multiplier: 3, chance: 8 },
        { name: "Medium", multiplier: 10, chance: 2.5 },
        { name: "Large", multiplier: 25, chance: 0.4 },
        { name: "Jackpot", multiplier: 200, chance: 0.02 },
    ],
    "neo-platinum": [
        { name: "Mini", multiplier: 1.5, chance: 12 },
        { name: "Small", multiplier: 4, chance: 7 },
        { name: "Medium", multiplier: 15, chance: 2 },
        { name: "Large", multiplier: 50, chance: 0.3 },
        { name: "Jackpot", multiplier: 400, chance: 0.01 },
    ],
    "neo-diamond": [
        { name: "Mini", multiplier: 2, chance: 10 },
        { name: "Small", multiplier: 5, chance: 6 },
        { name: "Medium", multiplier: 20, chance: 1.5 },
        { name: "Large", multiplier: 100, chance: 0.2 },
        { name: "Jackpot", multiplier: 1000, chance: 0.005 },
    ],
};

// Static lottery type data - no i18n dependency for the type definitions
const LOTTERY_TYPES: LotteryTypeInfo[] = [
    {
        key: "neo-bronze",
        type: "neo-bronze",
        name: "Bronze",
        price: 1,
        priceDisplay: "1 GAS",
        maxJackpot: 50,
        maxJackpotDisplay: "50 GAS",
        winRate: 33.55,
        description: "Entry level - Best odds!",
        color: "#CD7F32",
    },
    {
        key: "neo-silver",
        type: "neo-silver",
        name: "Silver",
        price: 2,
        priceDisplay: "2 GAS",
        maxJackpot: 200,
        maxJackpotDisplay: "200 GAS",
        winRate: 30.53,
        description: "Better prizes, good odds",
        color: "#C0C0C0",
    },
    {
        key: "neo-gold",
        type: "neo-gold",
        name: "Gold",
        price: 3,
        priceDisplay: "3 GAS",
        maxJackpot: 600,
        maxJackpotDisplay: "600 GAS",
        winRate: 25.92,
        description: "Premium tier rewards",
        color: "#FFD700",
    },
    {
        key: "neo-platinum",
        type: "neo-platinum",
        name: "Platinum",
        price: 4,
        priceDisplay: "4 GAS",
        maxJackpot: 1600,
        maxJackpotDisplay: "1,600 GAS",
        winRate: 21.31,
        description: "High stakes, huge payouts",
        color: "#E5E4E2",
    },
    {
        key: "neo-diamond",
        type: "neo-diamond",
        name: "Diamond",
        price: 5,
        priceDisplay: "5 GAS",
        maxJackpot: 5000,
        maxJackpotDisplay: "5,000 GAS",
        winRate: 17.705,
        description: "Ultimate jackpot potential!",
        color: "#B9F2FF",
    },
];

export function useLotteryTypes() {
    const instantTypes = computed<LotteryTypeInfo[]>(() => LOTTERY_TYPES);

    const getLotteryType = (type: LotteryType): LotteryTypeInfo | undefined => {
        return LOTTERY_TYPES.find((t) => t.type === type);
    };

    const getPrizeTiers = (type: LotteryType): PrizeTier[] => {
        return PRIZE_TIERS[type] || [];
    };

    return {
        instantTypes,
        getLotteryType,
        getPrizeTiers,
        PRIZE_TIERS,
    };
}
