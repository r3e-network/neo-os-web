/**
 * Neo Multisig — on-chain vault service.
 *
 * Thin wrapper around the platform ChainService that talks to the deployed
 * MiniAppMultisig custody-vault contract (resolved from the app manifest).
 * Every method is a direct contract read or invoke — there is no off-chain
 * store. State (vault balances, request status, approval counts) is read back
 * from the contract via getVault / getRequest / balanceOf.
 *
 *   write: createVault, deposit, createRequest, approve, cancel
 *   read:  getVault, getRequest, balanceOf, hasApproved, lastVaultId,
 *          lastRequestId
 */

import {
  assetHash,
  buildApproveArgs,
  buildCancelArgs,
  buildCreateRequestArgs,
  buildCreateVaultArgs,
  buildDepositArgs,
  parseRequest,
  parseVault,
  validateSignerSet,
  type ContractArg,
  type RequestView,
  type VaultAsset,
  type VaultView,
} from "../utils/vault";

/**
 * A single contract argument as accepted by the platform chain layer. The
 * runtime SDK tolerates nested Array values (an array of ContractArg), which
 * the static `ChainService.ContractArg` type narrows to scalars — this widened
 * alias is what we hand to the chain at the call boundary.
 */
type ChainArg = { type: string; value: unknown };

/**
 * Minimal chain surface this service needs. `ctx.services.chain` satisfies it.
 * Kept narrow so the dependency is explicit and the module stays testable.
 */
export interface VaultChain {
  invoke(
    operation: string,
    args: ChainArg[],
    options?: { scriptHash?: string },
  ): Promise<{ txid: string; success: boolean }>;
  read(
    operation: string,
    args?: ChainArg[],
    options?: { scriptHash?: string },
  ): Promise<unknown>;
  /** Resolved app contract hash (the custody vault). */
  contractAddress: { get(): string | null };
}

/** Cast our typed vault args to the widened chain-arg shape. */
function toChainArgs(args: ContractArg[]): ChainArg[] {
  return args as unknown as ChainArg[];
}

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

export function createVaultApi(chain: VaultChain) {
  /** Resolve the deployed custody-vault contract hash from the chain layer. */
  function contractHash(): string {
    const hash = chain.contractAddress.get();
    if (!hash) {
      throw new Error("Vault contract is not configured for this network.");
    }
    return hash;
  }

  return {
    // -- Writes -------------------------------------------------------------

    /** createVault(creator, signers[], threshold) — connected wallet witnesses. */
    async createVault(input: CreateVaultInput) {
      const set = validateSignerSet(input.signers, input.threshold);
      return chain.invoke(
        "createVault",
        toChainArgs(buildCreateVaultArgs(input.creator, set)),
      );
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
      return chain.invoke("transfer", toChainArgs(args), {
        scriptHash: assetHash(input.asset),
      });
    },

    /** createRequest(vaultId, creator, recipient, asset, amount, memo). */
    async createRequest(input: CreateRequestInput) {
      return chain.invoke(
        "createRequest",
        toChainArgs(buildCreateRequestArgs(input)),
      );
    },

    /** approve(reqId, signer) — releases funds at threshold. */
    async approve(reqId: number, signer: string) {
      return chain.invoke("approve", toChainArgs(buildApproveArgs(reqId, signer)));
    },

    /** cancel(reqId, caller) — creator-only, pending requests only. */
    async cancel(reqId: number, caller: string) {
      return chain.invoke("cancel", toChainArgs(buildCancelArgs(reqId, caller)));
    },

    // -- Reads --------------------------------------------------------------

    async getVault(vaultId: number): Promise<VaultView | null> {
      const raw = await chain.read("getVault", [
        { type: "Integer", value: String(vaultId) },
      ]);
      return parseVault(raw);
    },

    async getRequest(reqId: number): Promise<RequestView | null> {
      const raw = await chain.read("getRequest", [
        { type: "Integer", value: String(reqId) },
      ]);
      return parseRequest(raw);
    },

    async balanceOf(vaultId: number, asset: VaultAsset): Promise<number> {
      const raw = await chain.read("balanceOf", [
        { type: "Integer", value: String(vaultId) },
        { type: "Hash160", value: assetHash(asset) },
      ]);
      return toNumber(raw);
    },

    async hasApproved(reqId: number, signer: string): Promise<boolean> {
      const raw = await chain.read("hasApproved", [
        { type: "Integer", value: String(reqId) },
        { type: "Hash160", value: signer },
      ]);
      return Boolean(raw);
    },

    async lastVaultId(): Promise<number> {
      return toNumber(await chain.read("lastVaultId"));
    },

    async lastRequestId(): Promise<number> {
      return toNumber(await chain.read("lastRequestId"));
    },
  };
}

export type VaultApi = ReturnType<typeof createVaultApi>;
