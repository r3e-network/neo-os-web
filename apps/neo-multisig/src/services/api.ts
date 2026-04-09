/**
 * Multisig request persistence via runtime cache.
 *
 * Requests are stored locally (no backend). Each request is keyed by a
 * random ID and contains the unsigned transaction hex, signer list,
 * threshold, and collected signatures.
 */

import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";

const STORAGE_KEY = "multisig_requests";

export interface MultisigRequest {
  id: string;
  chain_id: "neo-n3-mainnet" | "neo-n3-testnet";
  script_hash: string;
  threshold: number;
  signers: string[];
  transaction_hex: string;
  signatures: Record<string, string>;
  status: "pending" | "ready" | "broadcasted" | "cancelled" | "expired";
  memo?: string;
  broadcast_txid?: string;
  created_at: string;
}

function loadAll(): MultisigRequest[] {
  const saved = readCachedJSON<MultisigRequest[]>(STORAGE_KEY);
  return Array.isArray(saved) ? saved : [];
}

function saveAll(requests: MultisigRequest[]): void {
  writeCachedJSON(STORAGE_KEY, requests);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const api = {
  async get(id: string): Promise<MultisigRequest> {
    const all = loadAll();
    const found = all.find((r) => r.id === id);
    if (!found) throw new Error(`Request ${id} not found`);
    return found;
  },

  async create(params: {
    chainId: string;
    scriptHash: string;
    threshold: number;
    signers: string[];
    transactionHex: string;
    memo?: string;
  }): Promise<MultisigRequest> {
    const request: MultisigRequest = {
      id: generateId(),
      chain_id: params.chainId as MultisigRequest["chain_id"],
      script_hash: params.scriptHash,
      threshold: params.threshold,
      signers: params.signers,
      transaction_hex: params.transactionHex,
      signatures: {},
      status: "pending",
      memo: params.memo,
      created_at: new Date().toISOString(),
    };
    const all = loadAll();
    all.unshift(request);
    saveAll(all.slice(0, 50));
    return request;
  },

  async addSignature(
    id: string,
    publicKey: string,
    signature: string,
  ): Promise<MultisigRequest> {
    const all = loadAll();
    const index = all.findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`Request ${id} not found`);

    all[index].signatures[publicKey] = signature;

    const sigCount = Object.keys(all[index].signatures).length;
    if (sigCount >= all[index].threshold) {
      all[index].status = "ready";
    }

    saveAll(all);
    return all[index];
  },

  async updateStatus(
    id: string,
    status: MultisigRequest["status"],
    broadcastTxId?: string,
  ): Promise<MultisigRequest> {
    const all = loadAll();
    const index = all.findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`Request ${id} not found`);

    all[index].status = status;
    if (broadcastTxId) all[index].broadcast_txid = broadcastTxId;

    saveAll(all);
    return all[index];
  },
};
