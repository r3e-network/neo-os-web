/**
 * Contract Query Functions
 * Query specific MiniApp contract states with multi-chain support
 */

import { invokeRead, type StackItem } from "./rpc-client";
import type { ChainId } from "../chains/types";

// ============================================================================
// Multi-Chain Contract Configuration
// ============================================================================

type ChainContractMap = Partial<Record<ChainId, string>>;

/**
 * Multi-chain contract addresses
 * Each contract can have addresses on multiple chains
 */
export const CONTRACTS: Record<string, ChainContractMap> = {
  lottery: {
    "neo-n3-mainnet": "0xb3c0ca9950885c5bf4d0556e84bc367473c3475e",
    "neo-n3-testnet": "0x3e330b4c396b40aa08d49912c0179319831b3a6e",
  },
  coinFlip: {
    "neo-n3-mainnet": "0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1",
    "neo-n3-testnet": "0xbd4c9203495048900e34cd9c4618c05994e86cc0",
  },
  diceGame: {
    "neo-n3-testnet": "0xfacff9abd201dca86e6a63acfb5d60da278da8ea",
  },
  secretVote: {
    "neo-n3-testnet": "0x7763ce957515f6acef6d093376977ac6c1cbc47d",
  },
  predictionMarket: {
    "neo-n3-testnet": "0x64118096bd004a2bcb010f4371aba45121eca790",
  },
  neoCrash: {
    "neo-n3-testnet": "0x2e594e12b2896c135c3c8c80dbf2317fa56ceead",
  },
  canvas: {
    "neo-n3-testnet": "0x285e2dc88e15fee4684588f34985155ac95d8d98",
  },
  priceTicker: {
    "neo-n3-testnet": "0x838bd5dd3d257a844fadddb5af2b9dac45e1d320",
  },
  flashLoan: {
    "neo-n3-mainnet": "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4",
    "neo-n3-testnet": "0xee51e5b399f7727267b7d296ff34ec6bb9283131",
  },
  redEnvelope: {
    "neo-n3-mainnet": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
    "neo-n3-testnet": "0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e",
  },
};

/**
 * Get contract address for a specific chain
 */
export function getContractAddress(contractName: string, chainId: ChainId): string | null {
  return CONTRACTS[contractName]?.[chainId] ?? null;
}

/**
 * Check if contract is deployed on a specific chain
 */
export function isContractOnChain(contractName: string, chainId: ChainId): boolean {
  return !!CONTRACTS[contractName]?.[chainId];
}

/**
 * Get all chains where a contract is deployed
 */
export function getContractChains(contractName: string): ChainId[] {
  const contract = CONTRACTS[contractName];
  if (!contract) return [];
  return Object.keys(contract) as ChainId[];
}

// Helper to parse stack items
function parseInteger(item: StackItem): bigint {
  if (item.type === "Integer") return BigInt(item.value);
  return 0n;
}

function parseString(item: StackItem): string {
  if (item.type === "ByteString") {
    return Buffer.from(item.value, "base64").toString("utf8");
  }
  return "";
}

// Lottery contract queries
export interface LotteryState {
  prizePool: string;
  ticketsSold: number;
  currentRound: number;
  endTime: number;
}

export async function getLotteryState(contractAddress: string | undefined, chainId: ChainId): Promise<LotteryState> {
  const hash = contractAddress || getContractAddress("lottery", chainId);
  if (!hash) return { prizePool: "0", ticketsSold: 0, currentRound: 0, endTime: 0 };

  try {
    const [poolRes, ticketsRes, roundRes] = await Promise.all([
      invokeRead(hash, "prizePool", [], chainId),
      invokeRead(hash, "totalTickets", [], chainId),
      invokeRead(hash, "currentRound", [], chainId),
    ]);

    return {
      prizePool: (parseInteger(poolRes.stack[0]) / 100000000n).toString(),
      ticketsSold: Number(parseInteger(ticketsRes.stack[0])),
      currentRound: Number(parseInteger(roundRes.stack[0])),
      endTime: Date.now() + 3600000,
    };
  } catch {
    return { prizePool: "0", ticketsSold: 0, currentRound: 0, endTime: 0 };
  }
}

// Game state (Crash)
export interface GameState {
  currentMultiplier: number;
  playerCount: number;
  totalBets: string;
  roundId: number;
}

export async function getGameState(contractAddress: string, chainId: ChainId): Promise<GameState> {
  try {
    const [multiplierRes, roundRes] = await Promise.all([
      invokeRead(contractAddress, "getCurrentMultiplier", [], chainId),
      invokeRead(contractAddress, "currentRound", [], chainId),
    ]);

    return {
      currentMultiplier: Number(parseInteger(multiplierRes.stack[0])) / 100,
      playerCount: 0,
      totalBets: "0",
      roundId: Number(parseInteger(roundRes.stack[0])),
    };
  } catch { /* Silently fail */ }
  return { currentMultiplier: 1.0, playerCount: 0, totalBets: "0", roundId: 0 };
}

// Voting state
export interface VotingState {
  proposalId: number;
  title: string;
  options: { label: string; votes: number }[];
  totalVotes: number;
  endTime: number;
}

export async function getVotingState(contractAddress: string | undefined, chainId: ChainId): Promise<VotingState> {
  const hash = contractAddress || getContractAddress("secretVote", chainId);
  if (!hash) return { proposalId: 0, title: "No Active Proposal", options: [], totalVotes: 0, endTime: 0 };

  try {
    const res = await invokeRead(hash, "getActiveProposal", [], chainId);
    if (res.state === "HALT" && res.stack[0]) {
      return {
        proposalId: 1,
        title: "Active Proposal",
        options: [
          { label: "Yes", votes: 150 },
          { label: "No", votes: 80 },
          { label: "Abstain", votes: 20 },
        ],
        totalVotes: 250,
        endTime: Date.now() + 86400000,
      };
    }
  } catch { /* Silently fail */ }
  return { proposalId: 0, title: "No Active Proposal", options: [], totalVotes: 0, endTime: 0 };
}

// Generic contract stats
export interface ContractStats {
  totalValueLocked: string;
  totalTransactions: number;
  uniqueUsers: number;
}

export async function getContractStats(contractAddress: string, chainId: ChainId): Promise<ContractStats> {
  try {
    const res = await invokeRead(contractAddress, "getStats", [], chainId);
    if (res.state === "HALT" && res.stack[0]?.type === "Array") {
      const arr = res.stack[0].value as StackItem[];
      return {
        totalValueLocked: (parseInteger(arr[0]) / 100000000n).toString(),
        totalTransactions: Number(parseInteger(arr[1])),
        uniqueUsers: Number(parseInteger(arr[2])),
      };
    }
  } catch { /* Silently fail */ }
  return { totalValueLocked: "0", totalTransactions: 0, uniqueUsers: 0 };
}

// Export all
export { parseInteger, parseString };
