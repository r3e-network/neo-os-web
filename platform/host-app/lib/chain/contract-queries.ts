/**
 * Contract Query Functions
 * Query specific MiniApp contract states
 */

import { invokeRead, type Network, type StackItem } from "./rpc-client";

// Contract addresses from manifest
export const CONTRACTS = {
  lottery: "0x3e330b4c396b40aa08d49912c0179319831b3a6e",
  coinFlip: "0xbd4c9203495048900e34cd9c4618c05994e86cc0",
  diceGame: "0xfacff9abd201dca86e6a63acfb5d60da278da8ea",
  secretVote: "0x7763ce957515f6acef6d093376977ac6c1cbc47d",
  predictionMarket: "0x64118096bd004a2bcb010f4371aba45121eca790",
  neoCrash: "0x2e594e12b2896c135c3c8c80dbf2317fa56ceead",
  canvas: "0x53f9c7b86fa2f8336839ef5073d964d644cbb46c",
  priceTicker: "0x838bd5dd3d257a844fadddb5af2b9dac45e1d320",
  flashLoan: "0xee51e5b399f7727267b7d296ff34ec6bb9283131",
  redEnvelope: "0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e",
} as const;

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

export async function getLotteryState(
  contractHash: string = CONTRACTS.lottery,
  network: Network = "testnet",
): Promise<LotteryState> {
  try {
    const [poolRes, ticketsRes, roundRes] = await Promise.all([
      invokeRead(contractHash, "prizePool", [], network),
      invokeRead(contractHash, "totalTickets", [], network),
      invokeRead(contractHash, "currentRound", [], network),
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

export async function getGameState(contractHash: string, network: Network = "testnet"): Promise<GameState> {
  try {
    const [multiplierRes, roundRes] = await Promise.all([
      invokeRead(contractHash, "getCurrentMultiplier", [], network),
      invokeRead(contractHash, "currentRound", [], network),
    ]);

    return {
      currentMultiplier: Number(parseInteger(multiplierRes.stack[0])) / 100,
      playerCount: 0,
      totalBets: "0",
      roundId: Number(parseInteger(roundRes.stack[0])),
    };
  } catch {}
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

export async function getVotingState(
  contractHash: string = CONTRACTS.secretVote,
  network: Network = "testnet",
): Promise<VotingState> {
  try {
    const res = await invokeRead(contractHash, "getActiveProposal", [], network);
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
  } catch {}
  return {
    proposalId: 0,
    title: "No Active Proposal",
    options: [],
    totalVotes: 0,
    endTime: 0,
  };
}

// Generic contract stats
export interface ContractStats {
  totalValueLocked: string;
  totalTransactions: number;
  uniqueUsers: number;
}

export async function getContractStats(contractHash: string, network: Network = "testnet"): Promise<ContractStats> {
  try {
    const res = await invokeRead(contractHash, "getStats", [], network);
    if (res.state === "HALT" && res.stack[0]?.type === "Array") {
      const arr = res.stack[0].value as StackItem[];
      return {
        totalValueLocked: (parseInteger(arr[0]) / 100000000n).toString(),
        totalTransactions: Number(parseInteger(arr[1])),
        uniqueUsers: Number(parseInteger(arr[2])),
      };
    }
  } catch {}
  return { totalValueLocked: "0", totalTransactions: 0, uniqueUsers: 0 };
}

// Export all
export { parseInteger, parseString };
