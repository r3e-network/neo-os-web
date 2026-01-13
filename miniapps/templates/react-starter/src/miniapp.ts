export type TxResult = unknown;

export type ContractParam =
  | { type: "String"; value: string }
  | { type: "Integer"; value: string }
  | { type: "Boolean"; value: boolean }
  | { type: "ByteArray"; value: string }
  | { type: "Hash160"; value: string }
  | { type: "Hash256"; value: string }
  | { type: "PublicKey"; value: string }
  | { type: "Any"; value: null }
  | { type: "Array"; value: ContractParam[] };

export type ChainType = "neo-n3" | "evm";
export type ChainId = string;

export type InvocationIntent =
  | {
      chain_id: ChainId;
      chain_type: "neo-n3";
      contract_address: string;
      method: string;
      params: ContractParam[];
    }
  | {
      chain_id: ChainId;
      chain_type: "evm";
      contract_address: string;
      data: string;
      value?: string;
      gas?: string;
      gas_price?: string;
      method?: string;
      args?: unknown[];
    };

export type PayGASResponse = {
  request_id: string;
  user_id: string;
  intent: "payments";
  constraints: { settlement: "GAS_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

export type VoteBNEOResponse = {
  request_id: string;
  user_id: string;
  intent: "governance";
  constraints: { governance: "BNEO_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

export type VoteNEOResponse = VoteBNEOResponse;

export type RNGResponse = {
  request_id: string;
  app_id: string;
  chain_id: ChainId;
  chain_type: ChainType;
  randomness: string;
  signature?: string;
  public_key?: string;
  attestation_hash?: string;
  anchored_tx?: unknown;
};

export type PriceResponse = {
  feed_id: string;
  pair: string;
  price: string;
  decimals: number;
  timestamp: string;
  sources: string[];
  signature?: string;
  public_key?: string;
};

export type MiniAppSDK = {
  wallet: {
    getAddress(): Promise<string>;
    invokeIntent?: (requestId: string) => Promise<TxResult>;
    invokeInvocation?: (invocation: InvocationIntent) => Promise<TxResult>;
  };
  payments: {
    payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse>;
    payGASAndInvoke?: (appId: string, amount: string, memo?: string) => Promise<{ intent: PayGASResponse; tx: TxResult }>;
  };
  governance: {
    vote(appId: string, proposalId: string, neoAmount: string, support?: boolean): Promise<VoteBNEOResponse>;
    voteAndInvoke?: (
      appId: string,
      proposalId: string,
      neoAmount: string,
      support?: boolean,
    ) => Promise<{ intent: VoteBNEOResponse; tx: TxResult }>;
  };
  rng: {
    requestRandom(appId: string): Promise<RNGResponse>;
  };
  datafeed: {
    getPrice(symbol: string): Promise<PriceResponse>;
  };
};

declare global {
  interface Window {
    MiniAppSDK?: MiniAppSDK;
  }
}

export function getMiniAppSDK(): MiniAppSDK {
  if (typeof window === "undefined") throw new Error("MiniAppSDK is browser-only");
  if (!window.MiniAppSDK) throw new Error("MiniAppSDK not available (host must inject it or provide a bridge)");
  return window.MiniAppSDK;
}
