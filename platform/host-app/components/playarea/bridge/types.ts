import type { WalletAdapter } from "@/lib/wallet/adapters";

export type BridgeRecord = Record<string, unknown>;

export type BridgeRequest = {
  type?: unknown;
  id?: unknown;
  method?: unknown;
  payload?: unknown;
  // Negotiated wallet-bridge protocol version. Absent on pre-negotiation
  // miniapps, which the host treats as the current baseline version.
  protocolVersion?: unknown;
};

export type EmbeddedWalletBridgeResultDetail = {
  appId: string;
  network: "mainnet" | "testnet";
  requestMethod: string;
  txid: string;
  operation: string;
  contractHash: string;
  memo: string;
  at: string;
};

export type EmbeddedWalletBridgeErrorDetail = {
  appId: string;
  network: "mainnet" | "testnet";
  requestMethod: string;
  message: string;
  rejected: boolean;
  at: string;
};

export type BridgeInvocation = {
  hash?: unknown;
  scriptHash?: unknown;
  contractHash?: unknown;
  operation?: unknown;
  method?: unknown;
  args?: unknown;
};

export type BridgeSigner = {
  account?: unknown;
  scopes?: unknown;
  allowedContracts?: unknown;
  allowedcontracts?: unknown;
  allowedGroups?: unknown;
  rules?: unknown;
};

export type SendCapableWalletAdapter = WalletAdapter & {
  send?: (
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ) => Promise<{ txid?: string; hash?: string; tx?: string }>;
};
