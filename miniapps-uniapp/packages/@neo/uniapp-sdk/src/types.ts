/**
 * Neo MiniApp SDK Types for uni-app
 */

export interface PayGASResponse {
  request_id: string;
  user_id: string;
  intent: "payments";
  constraints: { settlement: "GAS_ONLY" };
  invocation: InvocationIntent;
}

export interface VoteBNEOResponse {
  request_id: string;
  user_id: string;
  intent: "governance";
  constraints: { governance: "BNEO_ONLY" };
  invocation: InvocationIntent;
}

export interface RNGResponse {
  request_id: string;
  app_id: string;
  randomness: string;
  signature?: string;
  public_key?: string;
  attestation_hash?: string;
}

export interface PriceResponse {
  feed_id: string;
  pair: string;
  price: string;
  decimals: number;
  timestamp: string;
  sources: string[];
}

export interface InvocationIntent {
  contract: string;
  method: string;
  args: unknown[];
}

export interface MiniAppSDK {
  wallet: {
    getAddress(): Promise<string>;
    invokeIntent?(requestId: string): Promise<unknown>;
  };
  payments: {
    payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse>;
  };
  governance: {
    vote(appId: string, proposalId: string, amount: string, support?: boolean): Promise<VoteBNEOResponse>;
    getCandidates(): Promise<CandidatesResponse>;
  };
  rng: {
    requestRandom(appId: string): Promise<RNGResponse>;
  };
  datafeed: {
    getPrice(symbol: string): Promise<PriceResponse>;
  };
}

export interface NeoSDKConfig {
  appId: string;
  debug?: boolean;
}

export type NetworkType = "testnet" | "mainnet";

/** Neo Governance Candidate */
export interface Candidate {
  address: string;
  publicKey: string;
  name?: string;
  votes: string;
  active: boolean;
}

/** Candidates list response */
export interface CandidatesResponse {
  candidates: Candidate[];
  totalVotes: string;
  blockHeight: number;
}
