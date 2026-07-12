import type { MiniAppFramework } from "@shared/react";
import {
  MULTISIG_EVENT_WAIT_MS,
  requireCanonicalMultisigContext,
  type MultisigChainContext,
} from "../multisig-safety";
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

export interface MultisigWriteOptions {
  onTransactionSent?: (txid: string) => void;
}

function safeInteger(value: unknown, label: string): number {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new Error(`Malformed ${label} response.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Malformed ${label} response.`);
  return parsed;
}

function baseString(value: unknown, label: string): string {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new Error(`Malformed ${label} response.`);
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error(`Malformed ${label} response.`);
  }
}

function strictBoolean(value: unknown, label: string): boolean {
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
  if (value === false || value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
  throw new Error(`Malformed ${label} response.`);
}

export function createVaultApi(app: MiniAppFramework, contextErrorMessage = "multisigChainContextMismatch") {
  const context = () => requireCanonicalMultisigContext(app, contextErrorMessage);

  return {
    context,

    async createVault(input: CreateVaultInput, options: MultisigWriteOptions = {}) {
      const signerSet = validateSignerSet(input.signers, input.threshold);
      const chain = await context();
      return app.chain.invoke("createVault", buildCreateVaultArgs(input.creator, signerSet), {
        scriptHash: chain.contractHash,
        waitForEvent: "VaultCreated",
        waitTimeoutMs: MULTISIG_EVENT_WAIT_MS,
        onTransactionSent: options.onTransactionSent,
      });
    },

    async deposit(input: DepositInput, options: MultisigWriteOptions = {}) {
      const chain = await context();
      const args = buildDepositArgs({
        from: input.from,
        contractHash: chain.contractHash,
        vaultId: input.vaultId,
        amount: input.amount,
        asset: input.asset,
      });
      return app.chain.invoke("transfer", args, {
        scriptHash: assetHash(input.asset),
        waitForEvent: "Deposited",
        waitTimeoutMs: MULTISIG_EVENT_WAIT_MS,
        onTransactionSent: options.onTransactionSent,
      });
    },

    async createRequest(input: CreateRequestInput, options: MultisigWriteOptions = {}) {
      const chain = await context();
      return app.chain.invoke("createRequest", buildCreateRequestArgs(input), {
        scriptHash: chain.contractHash,
        waitForEvent: "RequestCreated",
        waitTimeoutMs: MULTISIG_EVENT_WAIT_MS,
        onTransactionSent: options.onTransactionSent,
      });
    },

    async approve(reqId: number, signer: string, options: MultisigWriteOptions = {}) {
      const chain = await context();
      return app.chain.invoke("approve", buildApproveArgs(reqId, signer), {
        scriptHash: chain.contractHash,
        waitForEvent: "Approved",
        waitTimeoutMs: MULTISIG_EVENT_WAIT_MS,
        onTransactionSent: options.onTransactionSent,
      });
    },

    async cancel(reqId: number, caller: string, options: MultisigWriteOptions = {}) {
      const chain = await context();
      return app.chain.invoke("cancel", buildCancelArgs(reqId, caller), {
        scriptHash: chain.contractHash,
        waitForEvent: "RequestCancelled",
        waitTimeoutMs: MULTISIG_EVENT_WAIT_MS,
        onTransactionSent: options.onTransactionSent,
      });
    },

    async getVault(vaultId: number, existing?: MultisigChainContext): Promise<VaultView | null> {
      const chain = existing ?? await context();
      const raw = await app.chain.readRaw("getVault", [app.chain.arg.integer(vaultId)], { scriptHash: chain.contractHash });
      if (raw === null || raw === undefined) return null;
      const parsed = parseVault(raw);
      if (!parsed) throw new Error("Malformed vault response.");
      return parsed;
    },

    async getRequest(reqId: number, existing?: MultisigChainContext): Promise<RequestView | null> {
      const chain = existing ?? await context();
      const raw = await app.chain.readRaw("getRequest", [app.chain.arg.integer(reqId)], { scriptHash: chain.contractHash });
      if (raw === null || raw === undefined) return null;
      const parsed = parseRequest(raw);
      if (!parsed) throw new Error("Malformed request response.");
      return parsed;
    },

    async balanceOf(vaultId: number, asset: VaultAsset, existing?: MultisigChainContext): Promise<string> {
      const chain = existing ?? await context();
      const raw = await app.chain.readRaw("balanceOf", [
        app.chain.arg.integer(vaultId),
        app.chain.arg.hash160(assetHash(asset)),
      ], { scriptHash: chain.contractHash });
      return baseString(raw, "vault balance");
    },

    async hasApproved(reqId: number, signer: string, existing?: MultisigChainContext): Promise<boolean> {
      const chain = existing ?? await context();
      const raw = await app.chain.readRaw("hasApproved", [
        app.chain.arg.integer(reqId),
        app.chain.arg.hash160(signer),
      ], { scriptHash: chain.contractHash });
      return strictBoolean(raw, "approval");
    },

    async lastVaultId(existing?: MultisigChainContext): Promise<number> {
      const chain = existing ?? await context();
      return safeInteger(await app.chain.readRaw("lastVaultId", [], { scriptHash: chain.contractHash }), "last vault id");
    },

    async lastRequestId(existing?: MultisigChainContext): Promise<number> {
      const chain = existing ?? await context();
      return safeInteger(await app.chain.readRaw("lastRequestId", [], { scriptHash: chain.contractHash }), "last request id");
    },

    async requestUnfunded(reqId: number): Promise<RequestUnfundedEvent | null> {
      await context();
      try {
        const events = await app.chain.events("RequestUnfunded", { limit: 50 });
        for (const entry of events ?? []) {
          const parsed = parseRequestUnfundedEvent(entry);
          if (parsed?.requestId === reqId) return parsed;
        }
      } catch {
        // This event only improves cancelled-request copy. The authoritative
        // request status still comes from getRequest.
      }
      return null;
    },
  };
}

export type VaultApi = ReturnType<typeof createVaultApi>;
