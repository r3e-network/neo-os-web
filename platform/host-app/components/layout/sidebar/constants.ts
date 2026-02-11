import type { ChainId } from "../../../lib/chains/types";

// Platform master accounts (Neo N3 only)
export const CHAIN_MASTER_ACCOUNTS: Partial<Record<ChainId, string>> = {
  "neo-n3-mainnet": "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
  "neo-n3-testnet": "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
};

// Platform Core Contracts by chain (Neo N3 only)
export const CORE_CONTRACTS: Partial<
  Record<
    ChainId,
    Record<
      string,
      {
        address: string;
        name: string;
        description: string;
      }
    >
  >
> = {
  "neo-n3-testnet": {
    ServiceGateway: {
      address: "NTWh6auSz3nvBZSbXHbZz4ShwPhmpkC5Ad",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NLRGStjsRpN3bk71KNoKe74fNxUT72gfpe",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
  "neo-n3-mainnet": {
    ServiceGateway: {
      address: "NfaEbVnKnUQSd4MhNXz9pY4Uire7EiZtai",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NMhpz6kT77SKaYwNHrkTv8QXpoPuSd3VJn",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
};

// Platform Service Contracts by chain (Neo N3 only)
export const PLATFORM_SERVICES: Partial<
  Record<
    ChainId,
    Record<
      string,
      {
        address: string;
        name: string;
        description: string;
      }
    >
  >
> = {
  "neo-n3-testnet": {
    PaymentHub: {
      address: "NZLGNdQUa5jQ2VC1r3MGoJFGm3BW8Kv81q",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    RandomnessOracle: {
      address: "NR9urKR3FZqAfvowx2fyWjtWHBpqLqrEPP",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "NTdJ7XHZtYXSRXnWGxV6TcyxiSRCcjP4X1",
      name: "Price Feed",
      description: "Real-time price oracle",
    },
  },
  "neo-n3-mainnet": {
    PaymentHub: {
      address: "NaqDPjXnYsm8W5V3xXuDUZe5W1HRLsMsx2",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    RandomnessOracle: {
      address: "NPJXDzwaU8UDct7247oq3YhLxJKkJsmhaa",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "NPW7dXnqBUoQ3aoxg86wMsKbgt8VD2HhWQ",
      name: "Price Feed",
      description: "Real-time price oracle",
    },
  },
};

// Map permissions to platform service keys
export const PERMISSION_TO_SERVICE: Record<string, string> = {
  payments: "PaymentHub",
  rng: "RandomnessOracle",
  datafeed: "PriceFeed",
};
