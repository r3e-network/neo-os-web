import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PLATFORM_VESTING, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { parseBigInt } from "./utils/parsers";

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export type FrameworkVestingAsset = "GAS" | "NEO";
export type FrameworkPlatformVestingAmount = string | number | bigint;

export interface FrameworkPlatformVestingConfig {
  vestingHash: string;
  gasHash?: string;
  neoHash?: string;
}

export interface FrameworkPlatformVestingTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkPlatformVestingInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface PlatformVestingSurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  read(
    operation: string,
    args?: Array<{ type: string; value: unknown }>,
    options?: unknown,
  ): Promise<unknown>;
  invoke(
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformVestingInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkPlatformVestingTx>;
  invokeMultiple(
    calls: Array<{
      scriptHash: string;
      operation: string;
      args: Array<{ type: string; value: unknown }>;
    }>,
    options?: { onTransactionSent?: (txid: string) => void },
  ): Promise<{ txid: string; state?: string; exception?: string }>;
}

export interface PlatformVestingSurfaceDeps {
  appId: string;
  chain: PlatformVestingSurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformVestingConfig;
}

export interface FrameworkPlatformVestingCreateInput {
  beneficiary: string;
  asset: FrameworkVestingAsset;
  totalAmount: FrameworkPlatformVestingAmount;
  rateAmount: FrameworkPlatformVestingAmount;
  intervalSeconds: FrameworkPlatformVestingAmount;
  title?: string;
  notes?: string;
  creator?: string;
  fundAmount?: FrameworkPlatformVestingAmount;
  options?: FrameworkPlatformVestingInvokeOptions;
}

export interface FrameworkPlatformVestingSurface {
  readonly available: boolean;
  readonly configuredHash: string | null;
  prepayGas(amount: FrameworkPlatformVestingAmount, payer?: string, options?: FrameworkPlatformVestingInvokeOptions): Promise<FrameworkPlatformVestingTx>;
  prepayNeo(amount: FrameworkPlatformVestingAmount, payer?: string, options?: FrameworkPlatformVestingInvokeOptions): Promise<FrameworkPlatformVestingTx>;
  createStream(input: FrameworkPlatformVestingCreateInput): Promise<FrameworkPlatformVestingTx>;
  claimStream(streamId: FrameworkPlatformVestingAmount, beneficiary?: string, options?: FrameworkPlatformVestingInvokeOptions): Promise<FrameworkPlatformVestingTx>;
  cancelStream(streamId: FrameworkPlatformVestingAmount, creator?: string, options?: FrameworkPlatformVestingInvokeOptions): Promise<FrameworkPlatformVestingTx>;
  withdrawCredit(asset: FrameworkVestingAsset, amount: FrameworkPlatformVestingAmount, payer?: string, options?: FrameworkPlatformVestingInvokeOptions): Promise<FrameworkPlatformVestingTx>;
  creditOf(asset: FrameworkVestingAsset, payer?: string): Promise<bigint>;
  creditLiability(asset: FrameworkVestingAsset): Promise<bigint>;
  streamLiability(asset: FrameworkVestingAsset): Promise<bigint>;
  totalCreditLiability(asset: FrameworkVestingAsset): Promise<bigint>;
  totalStreams(): Promise<bigint>;
  claimableOf(streamId: FrameworkPlatformVestingAmount): Promise<bigint>;
  getStreamDetails(streamId: FrameworkPlatformVestingAmount): Promise<unknown>;
  getUserStreams(creator?: string, offset?: FrameworkPlatformVestingAmount, limit?: FrameworkPlatformVestingAmount): Promise<unknown[]>;
  getBeneficiaryStreams(beneficiary?: string, offset?: FrameworkPlatformVestingAmount, limit?: FrameworkPlatformVestingAmount): Promise<unknown[]>;
}

function positive(value: FrameworkPlatformVestingAmount, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized <= 0n) throw new Error(`${label} must be a positive integer`);
  return normalized.toString();
}

function assetKind(value: FrameworkVestingAsset): FrameworkVestingAsset {
  if (value !== "GAS" && value !== "NEO") throw new Error("asset must be GAS or NEO");
  return value;
}

function requiredString(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function createPlatformVestingSurface(
  deps: PlatformVestingSurfaceDeps,
): FrameworkPlatformVestingSurface {
  const config = deps.config;
  const valid = Boolean(config && HASH160_RE.test(String(config.vestingHash ?? "").trim()));
  const requireConfig = (): FrameworkPlatformVestingConfig => {
    if (!config) throw new FrameworkCapabilityError("platformVesting", "Platform vesting engine is not configured on this host");
    for (const [name, value] of [
      ["vestingHash", config.vestingHash],
      ["gasHash", config.gasHash ?? GAS_HASH],
      ["neoHash", config.neoHash ?? NEO_HASH],
    ] as const) {
      if (!HASH160_RE.test(String(value ?? "").trim())) {
        throw new FrameworkCapabilityError("platformVesting", `platformVesting config has an invalid ${name}`);
      }
    }
    return config;
  };
  const hash = (value: string) => value.trim().toLowerCase();
  const vestingHash = () => hash(requireConfig().vestingHash);
  const tokenHash = (asset: FrameworkVestingAsset) => {
    const cfg = requireConfig();
    return hash(asset === "GAS" ? cfg.gasHash ?? GAS_HASH : cfg.neoHash ?? NEO_HASH);
  };
  const appId = () => requiredString(deps.appId, "appId");
  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? deps.chain.address.get() ?? "").trim() || await deps.chain.ensureWallet();
    return accountToHash160(resolved);
  };
  const amountArg = (value: FrameworkPlatformVestingAmount, label: string) => ({
    type: "Integer",
    value: positive(value, label),
  });
  const integerArg = (value: FrameworkPlatformVestingAmount, label: string) => ({
    type: "Integer",
    value: parseBigInt(value).toString(),
  });
  const read = (operation: string, args: Array<{ type: string; value: unknown }> = []) =>
    deps.chain.read(operation, args, { scriptHash: vestingHash() });
  const invoke = (
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformVestingInvokeOptions,
  ) => deps.chain.invoke(operation, args, { ...(options ?? {}), scriptHash: vestingHash() });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformVestingTx>) =>
    guardedWrite(deps.guards, WRITE_PLATFORM_VESTING, run);

  const transfer = (asset: FrameworkVestingAsset) => write(async (
    amount: FrameworkPlatformVestingAmount,
    payerValue?: string,
    options?: FrameworkPlatformVestingInvokeOptions,
  ) => {
    const payer = await account(payerValue);
    return deps.chain.invoke("transfer", [
      { type: "Hash160", value: payer },
      { type: "Hash160", value: vestingHash() },
      amountArg(amount, "amount"),
      { type: "String", value: `${appId()}:fund` },
    ], { ...(options ?? {}), scriptHash: tokenHash(asset) });
  });

  return {
    get available() { return valid; },
    get configuredHash() {
      return valid ? hash(String(config?.vestingHash ?? "")) : null;
    },
    prepayGas: transfer("GAS"),
    prepayNeo: transfer("NEO"),
    createStream: write(async (input) => {
      const asset = assetKind(input.asset);
      const creator = await account(input.creator);
      const beneficiary = accountToHash160(requiredString(input.beneficiary, "beneficiary"));
      const args = [
        { type: "String", value: appId() },
        { type: "Hash160", value: creator },
        { type: "Hash160", value: beneficiary },
        { type: "Hash160", value: tokenHash(asset) },
        amountArg(input.totalAmount, "totalAmount"),
        amountArg(input.rateAmount, "rateAmount"),
        amountArg(input.intervalSeconds, "intervalSeconds"),
        { type: "String", value: input.title ?? "" },
        { type: "String", value: input.notes ?? "" },
      ];
      const fundAmount = input.fundAmount == null ? 0n : parseBigInt(input.fundAmount);
      if (fundAmount < 0n) throw new Error("fundAmount must be non-negative");
      if (fundAmount === 0n) return invoke("createStream", args, input.options);
      if (fundAmount < parseBigInt(input.totalAmount)) {
        throw new Error("fundAmount must cover totalAmount");
      }
      if (!deps.chain.invokeMultiple) throw new Error("Host chain service does not support invokeMultiple");
      const result = await deps.chain.invokeMultiple([
        {
          scriptHash: tokenHash(asset),
          operation: "transfer",
          args: [
            { type: "Hash160", value: creator },
            { type: "Hash160", value: vestingHash() },
            { type: "Integer", value: fundAmount.toString() },
            { type: "String", value: `${appId()}:fund` },
          ],
        },
        { scriptHash: vestingHash(), operation: "createStream", args },
      ], { onTransactionSent: input.options?.onTransactionSent });
      return { txid: String(result.txid ?? ""), success: !String(result.state ?? "").toUpperCase().includes("FAULT") };
    }),
    claimStream: write(async (streamId, beneficiary, options) => invoke("claimStream", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(beneficiary) },
      amountArg(streamId, "streamId"),
    ], options)),
    cancelStream: write(async (streamId, creator, options) => invoke("cancelStream", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(creator) },
      amountArg(streamId, "streamId"),
    ], options)),
    withdrawCredit: write(async (asset, amount, payer, options) => invoke("withdrawCredit", [
      { type: "String", value: appId() },
      { type: "Hash160", value: await account(payer) },
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
      amountArg(amount, "amount"),
    ], options)),
    creditOf: async (asset, payer) => parseBigInt(await read("creditOf", [
      { type: "String", value: appId() },
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
      { type: "Hash160", value: await account(payer) },
    ])),
    creditLiability: async (asset) => parseBigInt(await read("creditLiabilityOf", [
      { type: "String", value: appId() }, { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    streamLiability: async (asset) => parseBigInt(await read("streamLiabilityOf", [
      { type: "String", value: appId() }, { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    totalCreditLiability: async (asset) => parseBigInt(await read("totalCreditLiability", [
      { type: "Hash160", value: tokenHash(assetKind(asset)) },
    ])),
    totalStreams: async () => parseBigInt(await read("totalStreams", [{ type: "String", value: appId() }])),
    claimableOf: async (streamId) => parseBigInt(await read("claimableOf", [
      { type: "String", value: appId() }, amountArg(streamId, "streamId"),
    ])),
    getStreamDetails: async (streamId) => read("getStreamDetails", [
      { type: "String", value: appId() }, amountArg(streamId, "streamId"),
    ]),
    getUserStreams: async (creator, offset = 0, limit = 20) => {
      const raw = await read("getUserStreams", [
        { type: "String", value: appId() }, { type: "Hash160", value: await account(creator) },
        integerArg(offset, "offset"), amountArg(limit, "limit"),
      ]);
      return Array.isArray(raw) ? raw : [];
    },
    getBeneficiaryStreams: async (beneficiary, offset = 0, limit = 20) => {
      const raw = await read("getBeneficiaryStreams", [
        { type: "String", value: appId() }, { type: "Hash160", value: await account(beneficiary) },
        integerArg(offset, "offset"), amountArg(limit, "limit"),
      ]);
      return Array.isArray(raw) ? raw : [];
    },
  };
}
