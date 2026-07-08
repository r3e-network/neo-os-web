/**
 * Neo Multisig — on-chain vault service.
 *
 * Thin wrapper around the framework chain surface (app.chain) that talks to
 * the deployed MiniAppMultisig custody-vault contract (resolved from the app
 * manifest).
 * Every method is a direct contract read or invoke — there is no off-chain
 * store. State (vault balances, request status, approval counts) is read back
 * from the contract via getVault / getRequest / balanceOf.
 *
 *   write: createVault, deposit, createRequest, approve, cancel
 *   read:  getVault, getRequest, balanceOf, hasApproved, lastVaultId,
 *          lastRequestId, requestUnfunded (RequestUnfunded event lookup)
 */

import type { MiniAppFramework } from "@shared/react";
import {
  assetHash,
  buildApproveArgs,
  buildCancelArgs,
  buildCreateRequestArgs,
  buildCreateVaultArgs,
  buildDepositArgs,
  parseRequest,
  parseRequestUnfundedEvent,
  parseVault,
  validateSignerSet,
  type RequestUnfundedEvent,
  type RequestView,
  type VaultAsset,
  type VaultView,
} from "../utils/vault";

export interface CreateVaultInput {
  creator: string;
  signers: string[];
  threshold: number;
}

export interface DepositInput {
  from: string;
  vaultId: number;
  amount: string;
  asset: VaultAsset;
}

export interface CreateRequestInput {
  vaultId: number;
  creator: string;
  recipient: string;
  asset: VaultAsset;
  amount: string;
  memo: string;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function createVaultApi(app: MiniAppFramework) {
  /** Resolve the deployed custody-vault contract hash from the chain layer. */
  function contractHash(): string {
    const hash = app.chain.contractAddress.get();
    if (!hash) {
      throw new Error("Vault contract is not configured for this network.");
    }
    return hash;
  }

  return {
    // -- Writes -------------------------------------------------------------

    /**
     * createVault(creator, signers[], threshold) — connected wallet witnesses.
     * The signer list is a nested Array arg (the shape `app.chain.arg.array`
     * builds), which `FrameworkContractArg` now types first-class — no
     * widened-cast boundary needed.
     */
    async createVault(input: CreateVaultInput) {
      const set = validateSignerSet(input.signers, input.threshold);
      return app.chain.invoke("createVault", buildCreateVaultArgs(input.creator, set));
    },

    /**
     * Deposit GAS/NEO into a vault via a NEP-17 transfer to the contract with
     * the vaultId as the transfer `data`. Targets the TOKEN contract.
     */
    async deposit(input: DepositInput) {
      const args = buildDepositArgs({
        from: input.from,
        contractHash: contractHash(),
        vaultId: input.vaultId,
        amount: input.amount,
        asset: input.asset,
      });
      // Wait for the contract's Deposited event so the success toast and the
      // refreshVault read reflect a CONFIRMED, in-block balance change — a
      // fire-and-forget transfer otherwise reports success while balances are
      // still stale (the user has to reload to see the deposit).
      return app.chain.invoke("transfer", args, {
        scriptHash: assetHash(input.asset),
        waitForEvent: "Deposited",
      });
    },

    /** createRequest(vaultId, creator, recipient, asset, amount, memo). */
    async createRequest(input: CreateRequestInput) {
      return app.chain.invoke("createRequest", buildCreateRequestArgs(input));
    },

    /** approve(reqId, signer) — releases funds at threshold. */
    async approve(reqId: number, signer: string) {
      return app.chain.invoke("approve", buildApproveArgs(reqId, signer));
    },

    /** cancel(reqId, caller) — ANY vault signer (v2), pending requests only. */
    async cancel(reqId: number, caller: string) {
      return app.chain.invoke("cancel", buildCancelArgs(reqId, caller));
    },

    // -- Reads --------------------------------------------------------------

    async getVault(vaultId: number): Promise<VaultView | null> {
      const raw = await app.chain.readRaw("getVault", [
        app.chain.arg.integer(vaultId),
      ]);
      return parseVault(raw);
    },

    async getRequest(reqId: number): Promise<RequestView | null> {
      const raw = await app.chain.readRaw("getRequest", [
        app.chain.arg.integer(reqId),
      ]);
      return parseRequest(raw);
    },

    async balanceOf(vaultId: number, asset: VaultAsset): Promise<number> {
      const raw = await app.chain.readRaw("balanceOf", [
        app.chain.arg.integer(vaultId),
        app.chain.arg.hash160(assetHash(asset)),
      ]);
      return toNumber(raw);
    },

    async hasApproved(reqId: number, signer: string): Promise<boolean> {
      const raw = await app.chain.readRaw("hasApproved", [
        app.chain.arg.integer(reqId),
        app.chain.arg.hash160(signer),
      ]);
      return Boolean(raw);
    },

    async lastVaultId(): Promise<number> {
      return toNumber(await app.chain.readRaw("lastVaultId"));
    },

    async lastRequestId(): Promise<number> {
      return toNumber(await app.chain.readRaw("lastRequestId"));
    },

    /**
     * Look up the RequestUnfunded(requestId, required, available) event for a
     * request (v2 contract): a threshold approval that found the vault balance
     * below the request amount auto-cancelled it. Returns the parsed amounts
     * (BASE UNITS) or null when no event exists / events are unavailable —
     * callers fall back to a generic auto-cancel notice.
     */
    async requestUnfunded(reqId: number): Promise<RequestUnfundedEvent | null> {
      try {
        const events = await app.chain.events("RequestUnfunded", { limit: 50 });
        for (const entry of events ?? []) {
          const parsed = parseRequestUnfundedEvent(entry);
          if (parsed && parsed.requestId === reqId) return parsed;
        }
      } catch {
        // Event indexing is best-effort; the caller shows a generic notice.
      }
      return null;
    },
  };
}

export type VaultApi = ReturnType<typeof createVaultApi>;
