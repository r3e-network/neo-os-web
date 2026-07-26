import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PLATFORM_ESCROW, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { parseBigInt } from "./utils/parsers";

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export type FrameworkEscrowAsset = "GAS" | "NEO";
export type FrameworkPlatformEscrowAmount = string | number | bigint;

export interface FrameworkPlatformEscrowConfig {
  escrowHash: string;
  gasHash?: string;
  neoHash?: string;
}

export interface FrameworkPlatformEscrowTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkPlatformEscrowInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface PlatformEscrowSurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  read(operation: string, args?: Array<{ type: string; value: unknown }>, options?: unknown): Promise<unknown>;
  invoke(operation: string, args: Array<{ type: string; value: unknown }>, options?: FrameworkPlatformEscrowInvokeOptions & { scriptHash?: string }): Promise<FrameworkPlatformEscrowTx>;
  invokeMultiple(calls: Array<{ scriptHash: string; operation: string; args: Array<{ type: string; value: unknown }> }>, options?: { onTransactionSent?: (txid: string) => void }): Promise<{ txid: string; state?: string; exception?: string }>;
}

export interface PlatformEscrowSurfaceDeps {
  appId: string;
  chain: PlatformEscrowSurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformEscrowConfig;
}

export interface FrameworkPlatformEscrowCreateInput {
  beneficiary: string;
  asset: FrameworkEscrowAsset;
  totalAmount: FrameworkPlatformEscrowAmount;
  milestoneAmounts: FrameworkPlatformEscrowAmount[];
  approvers?: string[];
  approvalThreshold?: FrameworkPlatformEscrowAmount;
  title?: string;
  notes?: string;
  creator?: string;
  fundAmount?: FrameworkPlatformEscrowAmount;
  options?: FrameworkPlatformEscrowInvokeOptions;
}

export interface FrameworkPlatformEscrowSurface {
  readonly available: boolean;
  prepayGas(amount: FrameworkPlatformEscrowAmount, payer?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  prepayNeo(amount: FrameworkPlatformEscrowAmount, payer?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  createEscrow(input: FrameworkPlatformEscrowCreateInput): Promise<FrameworkPlatformEscrowTx>;
  approveMilestone(escrowId: FrameworkPlatformEscrowAmount, milestoneIndex: FrameworkPlatformEscrowAmount, approver?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  claimMilestone(escrowId: FrameworkPlatformEscrowAmount, milestoneIndex: FrameworkPlatformEscrowAmount, beneficiary?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  cancelEscrow(escrowId: FrameworkPlatformEscrowAmount, creator?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  reclaimApprovedMilestone(escrowId: FrameworkPlatformEscrowAmount, milestoneIndex: FrameworkPlatformEscrowAmount, creator?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  withdrawCredit(asset: FrameworkEscrowAsset, amount: FrameworkPlatformEscrowAmount, payer?: string, options?: FrameworkPlatformEscrowInvokeOptions): Promise<FrameworkPlatformEscrowTx>;
  creditOf(asset: FrameworkEscrowAsset, payer?: string): Promise<bigint>;
  creditLiability(asset: FrameworkEscrowAsset): Promise<bigint>;
  escrowLiability(asset: FrameworkEscrowAsset): Promise<bigint>;
  totalCreditLiability(asset: FrameworkEscrowAsset): Promise<bigint>;
  totalEscrowLiability(asset: FrameworkEscrowAsset): Promise<bigint>;
  totalEscrows(): Promise<bigint>;
  getEscrowDetails(escrowId: FrameworkPlatformEscrowAmount): Promise<unknown>;
  getMilestoneDetails(escrowId: FrameworkPlatformEscrowAmount, milestoneIndex: FrameworkPlatformEscrowAmount): Promise<unknown>;
  getPlatformStats(): Promise<unknown>;
  getCreatorEscrows(creator?: string, offset?: FrameworkPlatformEscrowAmount, limit?: FrameworkPlatformEscrowAmount): Promise<unknown[]>;
  getBeneficiaryEscrows(beneficiary?: string, offset?: FrameworkPlatformEscrowAmount, limit?: FrameworkPlatformEscrowAmount): Promise<unknown[]>;
}

function positive(value: FrameworkPlatformEscrowAmount, label: string): string {
  const parsed = parseBigInt(value);
  if (parsed <= 0n) throw new Error(`${label} must be a positive integer`);
  return parsed.toString();
}

function nonNegative(value: FrameworkPlatformEscrowAmount, label: string): string {
  const parsed = parseBigInt(value);
  if (parsed < 0n) throw new Error(`${label} must be non-negative`);
  return parsed.toString();
}

function assetKind(value: FrameworkEscrowAsset): FrameworkEscrowAsset {
  if (value !== "GAS" && value !== "NEO") throw new Error("asset must be GAS or NEO");
  return value;
}

function requiredString(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function createPlatformEscrowSurface(
  deps: PlatformEscrowSurfaceDeps,
): FrameworkPlatformEscrowSurface {
  const config = deps.config;
  const valid = Boolean(config && HASH160_RE.test(String(config.escrowHash ?? "").trim()));
  const requireConfig = (): FrameworkPlatformEscrowConfig => {
    if (!config) throw new FrameworkCapabilityError("platformEscrow", "Platform escrow engine is not configured on this host");
    for (const [name, value] of [
      ["escrowHash", config.escrowHash],
      ["gasHash", config.gasHash ?? GAS_HASH],
      ["neoHash", config.neoHash ?? NEO_HASH],
    ] as const) {
      if (!HASH160_RE.test(String(value ?? "").trim())) {
        throw new FrameworkCapabilityError("platformEscrow", `platformEscrow config has an invalid ${name}`);
      }
    }
    return config;
  };
  const hash = (value: string) => value.trim().toLowerCase();
  const escrowHash = () => hash(requireConfig().escrowHash);
  const tokenHash = (asset: FrameworkEscrowAsset) => {
    const cfg = requireConfig();
    return hash(asset === "GAS" ? cfg.gasHash ?? GAS_HASH : cfg.neoHash ?? NEO_HASH);
  };
  const appId = () => requiredString(deps.appId, "appId");
  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? deps.chain.address.get() ?? "").trim() || await deps.chain.ensureWallet();
    return accountToHash160(resolved);
  };
  const positiveArg = (value: FrameworkPlatformEscrowAmount, label: string) => ({
    type: "Integer",
    value: positive(value, label),
  });
  const nonNegativeArg = (value: FrameworkPlatformEscrowAmount, label: string) => ({
    type: "Integer",
    value: nonNegative(value, label),
  });
  const read = (operation: string, args: Array<{ type: string; value: unknown }> = []) =>
    deps.chain.read(operation, args, { scriptHash: escrowHash() });
  const invoke = (operation: string, args: Array<{ type: string; value: unknown }>, options?: FrameworkPlatformEscrowInvokeOptions) =>
    deps.chain.invoke(operation, args, { ...(options ?? {}), scriptHash: escrowHash() });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformEscrowTx>) =>
    guardedWrite(deps.guards, WRITE_PLATFORM_ESCROW, run);
  const transfer = (asset: FrameworkEscrowAsset) => write(async (
    amount: FrameworkPlatformEscrowAmount,
    payerValue?: string,
    options?: FrameworkPlatformEscrowInvokeOptions,
  ) => {
    const payer = await account(payerValue);
    return deps.chain.invoke("transfer", [
      { type: "Hash160", value: payer },
      { type: "Hash160", value: escrowHash() },
      positiveArg(amount, "amount"),
      { type: "String", value: `${appId()}:fund` },
    ], { ...(options ?? {}), scriptHash: tokenHash(asset) });
  });

  return {
    get available() { return valid; },
    prepayGas: transfer("GAS"),
    prepayNeo: transfer("NEO"),
    createEscrow: write(async (input) => {
      const asset = assetKind(input.asset);
      const creator = await account(input.creator);
      const beneficiary = accountToHash160(requiredString(input.beneficiary, "beneficiary"));
      const totalAmount = parseBigInt(input.totalAmount);
      const milestoneAmounts = input.milestoneAmounts.map((amount, index) => positive(amount, `milestoneAmounts[${index}]`));
      if (totalAmount <= 0n) throw new Error("totalAmount must be a positive integer");
      if (milestoneAmounts.length === 0) throw new Error("milestoneAmounts must not be empty");
      if (milestoneAmounts.reduce((sum, amount) => sum + BigInt(amount), 0n) !== totalAmount) {
        throw new Error("milestoneAmounts must sum to totalAmount");
      }
      const approverAddresses = (input.approvers ?? []).map((approver, index) =>
        accountToHash160(requiredString(approver, `approvers[${index}]`)));
      const multiApproval = input.approvers !== undefined;
      if (multiApproval && approverAddresses.length === 0) throw new Error("approvers must not be empty");
      const approvalThreshold = multiApproval
        ? positive(input.approvalThreshold ?? approverAddresses.length, "approvalThreshold")
        : "";
      const args = [
        { type: "String", value: appId() },
        { type: "Hash160", value: creator },
        { type: "Hash160", value: beneficiary },
        { type: "Hash160", value: tokenHash(asset) },
        positiveArg(input.totalAmount, "totalAmount"),
        { type: "Array", value: milestoneAmounts.map((amount) => ({ type: "Integer", value: amount })) },
        { type: "String", value: input.title ?? "" },
        { type: "String", value: input.notes ?? "" },
      ];
      const multiApprovalArgs = [
        ...args.slice(0, 6),
        { type: "Array", value: approverAddresses.map((approver) => ({ type: "Hash160", value: approver })) },
        { type: "Integer", value: approvalThreshold },
        ...args.slice(6),
      ];
      const createOperation = multiApproval ? "createEscrowWithApprovers" : "createEscrow";
      const fundAmount = input.fundAmount == null ? 0n : parseBigInt(input.fundAmount);
      if (fundAmount < 0n) throw new Error("fundAmount must be non-negative");
      if (fundAmount === 0n) {
        if (multiApproval) return invoke("createEscrowWithApprovers", multiApprovalArgs, input.options);
        return invoke("createEscrow", args, input.options);
      }
      if (fundAmount < totalAmount) throw new Error("fundAmount must cover totalAmount");
      const result = await deps.chain.invokeMultiple([
        {
          scriptHash: tokenHash(asset),
          operation: "transfer",
          args: [
            { type: "Hash160", value: creator },
            { type: "Hash160", value: escrowHash() },
            { type: "Integer", value: fundAmount.toString() },
            { type: "String", value: `${appId()}:fund` },
          ],
        },
        { scriptHash: escrowHash(), operation: createOperation, args: multiApproval ? multiApprovalArgs : args },
      ], { onTransactionSent: input.options?.onTransactionSent });
      return { txid: String(result.txid ?? ""), success: !String(result.state ?? "").toUpperCase().includes("FAULT") };
    }),
    approveMilestone: write(async (escrowId, milestoneIndex, approver, options) => invoke("approveMilestone", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(approver) },
      positiveArg(escrowId, "escrowId"),
      positiveArg(milestoneIndex, "milestoneIndex"),
    ], options)),
    claimMilestone: write(async (escrowId, milestoneIndex, beneficiary, options) => invoke("claimMilestone", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(beneficiary) },
      positiveArg(escrowId, "escrowId"),
      positiveArg(milestoneIndex, "milestoneIndex"),
    ], options)),
    cancelEscrow: write(async (escrowId, creator, options) => invoke("cancelEscrow", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(creator) },
      positiveArg(escrowId, "escrowId"),
    ], options)),
    reclaimApprovedMilestone: write(async (escrowId, milestoneIndex, creator, options) => invoke("reclaimApprovedMilestone", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(creator) },
      positiveArg(escrowId, "escrowId"),
      positiveArg(milestoneIndex, "milestoneIndex"),
    ], options)),
    withdrawCredit: write(async (asset, amount, payer, options) => invoke("withdrawCredit", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(payer) },
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
      positiveArg(amount, "amount"),
    ], options)),
    creditOf: async (asset, payer) => parseBigInt(await read("creditOf", [
      { type: "String", value: appId() },
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
      { type: "Hash160", value: await account(payer) },
    ])),
    creditLiability: async (asset) => parseBigInt(await read("creditLiabilityOf", [
      { type: "String", value: appId() }, { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    escrowLiability: async (asset) => parseBigInt(await read("escrowLiabilityOf", [
      { type: "String", value: appId() }, { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    totalCreditLiability: async (asset) => parseBigInt(await read("totalCreditLiability", [
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    totalEscrowLiability: async (asset) => parseBigInt(await read("totalEscrowLiability", [
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    totalEscrows: async () => parseBigInt(await read("totalEscrows", [{ type: "String", value: appId() }])),
    getEscrowDetails: async (escrowId) => read("getEscrowDetails", [
      { type: "String", value: appId() }, positiveArg(escrowId, "escrowId"),
    ]),
    getMilestoneDetails: async (escrowId, milestoneIndex) => read("getMilestoneDetails", [
      { type: "String", value: appId() }, positiveArg(escrowId, "escrowId"), positiveArg(milestoneIndex, "milestoneIndex"),
    ]),
    getPlatformStats: async () => read("getPlatformStats", [{ type: "String", value: appId() }]),
    getCreatorEscrows: async (creator, offset = 0, limit = 20) => {
      const raw = await read("getCreatorEscrows", [
        { type: "String", value: appId() }, { type: "Hash160", value: await account(creator) },
        nonNegativeArg(offset, "offset"), positiveArg(limit, "limit"),
      ]);
      return Array.isArray(raw) ? raw : [];
    },
    getBeneficiaryEscrows: async (beneficiary, offset = 0, limit = 20) => {
      const raw = await read("getBeneficiaryEscrows", [
        { type: "String", value: appId() }, { type: "Hash160", value: await account(beneficiary) },
        nonNegativeArg(offset, "offset"), positiveArg(limit, "limit"),
      ]);
      return Array.isArray(raw) ? raw : [];
    },
  };
}
