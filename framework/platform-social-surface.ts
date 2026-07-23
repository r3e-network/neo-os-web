import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PRIMARY, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { parseHash160 } from "./utils/neo";
import { parseBigInt, parseBool } from "./utils/parsers";

export interface FrameworkPlatformSocialConfig {
  socialHash: string;
  gasHash?: string;
  neoHash?: string;
}

export interface FrameworkPlatformSocialTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkPlatformSocialInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface PlatformSocialSurfaceChain {
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
    options?: FrameworkPlatformSocialInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkPlatformSocialTx>;
}

export interface PlatformSocialSurfaceDeps {
  appId: string;
  chain: PlatformSocialSurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformSocialConfig;
}

export interface FrameworkPlatformSocialNotarization {
  submitter: string;
  timestampMs: bigint;
  blockIndex: bigint;
}

export interface FrameworkPlatformSocialSurface {
  readonly available: boolean;
  prepayGasCredit(amount: string | number | bigint, payer?: string, options?: FrameworkPlatformSocialInvokeOptions): Promise<FrameworkPlatformSocialTx>;
  prepayNeoCredit(amount: string | number | bigint, payer?: string, options?: FrameworkPlatformSocialInvokeOptions): Promise<FrameworkPlatformSocialTx>;
  gasCreditOf(account?: string): Promise<bigint>;
  neoCreditOf(account?: string): Promise<bigint>;
  gasCreditLiability(): Promise<bigint>;
  neoCreditLiability(): Promise<bigint>;
  totalGasCreditLiability(): Promise<bigint>;
  totalNeoCreditLiability(): Promise<bigint>;
  withdrawGasCredit(amount: string | number | bigint, account?: string): Promise<FrameworkPlatformSocialTx>;
  withdrawNeoCredit(amount: string | number | bigint, account?: string): Promise<FrameworkPlatformSocialTx>;
  createEnvelope(packetCount: string | number | bigint, expiryMs: string | number | bigint, creator?: string): Promise<FrameworkPlatformSocialTx>;
  claimEnvelope(envelopeId: string | number | bigint, claimer?: string): Promise<FrameworkPlatformSocialTx>;
  refundExpiredEnvelope(envelopeId: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  getEnvelope(envelopeId: string | number | bigint): Promise<unknown>;
  hasClaimed(envelopeId: string | number | bigint, claimer?: string): Promise<boolean>;
  createRangeGasPool(input: {
    totalAmount: string | number | bigint;
    minClaimAmount: string | number | bigint;
    maxClaimAmount: string | number | bigint;
    maxClaims: string | number | bigint;
    expiryMs: string | number | bigint;
    creator?: string;
  }): Promise<FrameworkPlatformSocialTx>;
  claimRangeGasPool(poolId: string | number | bigint, claimer?: string): Promise<FrameworkPlatformSocialTx>;
  fundRangeGasPool(poolId: string | number | bigint, amount: string | number | bigint, creator?: string): Promise<FrameworkPlatformSocialTx>;
  refundRangeGasPool(poolId: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  getRangeGasPool(poolId: string | number | bigint): Promise<unknown>;
  hasClaimedRangeGasPool(poolId: string | number | bigint, claimer?: string): Promise<boolean>;
  createTrust(heir: string, heartbeatIntervalMs: string | number | bigint, owner?: string): Promise<FrameworkPlatformSocialTx>;
  heartbeat(trustId: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  executeTrust(trustId: string | number | bigint, executor?: string): Promise<FrameworkPlatformSocialTx>;
  cancelTrust(trustId: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  addGuardian(trustId: string | number | bigint, guardian: string): Promise<FrameworkPlatformSocialTx>;
  getTrust(trustId: string | number | bigint): Promise<unknown>;
  isGuardian(trustId: string | number | bigint, guardian?: string): Promise<boolean>;
  createVault(secretHashHex: string, difficulty: string | number | bigint, creator?: string): Promise<FrameworkPlatformSocialTx>;
  commitAttempt(vaultId: string | number | bigint, commitmentHex: string, attacker?: string): Promise<FrameworkPlatformSocialTx>;
  revealAttempt(vaultId: string | number | bigint, solutionHex: string, saltHex: string, attacker?: string): Promise<FrameworkPlatformSocialTx>;
  increaseBounty(vaultId: string | number | bigint, amount: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  refundExpiredVault(vaultId: string | number | bigint): Promise<FrameworkPlatformSocialTx>;
  getVault(vaultId: string | number | bigint): Promise<unknown>;
  notarize(digestHex: string, submitter?: string, options?: FrameworkPlatformSocialInvokeOptions): Promise<FrameworkPlatformSocialTx>;
  getNotarization(digestHex: string): Promise<FrameworkPlatformSocialNotarization | null>;
  isNotarized(digestHex: string): Promise<boolean>;
  notarizationCount(): Promise<bigint>;
}

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_RE = /^(?:[0-9a-fA-F]{2})+$/;
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

function positive(value: string | number | bigint, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized <= 0n) throw new Error(`${label} must be a positive integer`);
  return normalized.toString();
}

function byteArray(value: string, label: string, exactBytes?: number): string {
  const normalized = String(value ?? "").trim().replace(/^0x/i, "");
  if (!HEX_RE.test(normalized)) throw new Error(`${label} must be non-empty even-length hex`);
  if (exactBytes !== undefined && normalized.length !== exactBytes * 2) {
    throw new Error(`${label} must be ${exactBytes} bytes`);
  }
  return normalized.toLowerCase();
}

export function createPlatformSocialSurface(
  deps: PlatformSocialSurfaceDeps,
): FrameworkPlatformSocialSurface {
  const config = deps.config;
  const valid = Boolean(config && HASH160_RE.test(String(config.socialHash ?? "").trim()));
  const requireConfig = (): FrameworkPlatformSocialConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "platformSocial",
        "Platform social engine is not configured on this host",
      );
    }
    if (!HASH160_RE.test(String(config.socialHash ?? "").trim())) {
      throw new FrameworkCapabilityError(
        "platformSocial",
        "platformSocial config is missing a valid socialHash",
      );
    }
    if (config.gasHash && !HASH160_RE.test(String(config.gasHash).trim())) {
      throw new FrameworkCapabilityError("platformSocial", "platformSocial config has an invalid gasHash");
    }
    if (config.neoHash && !HASH160_RE.test(String(config.neoHash).trim())) {
      throw new FrameworkCapabilityError("platformSocial", "platformSocial config has an invalid neoHash");
    }
    return config;
  };
  const socialHash = (): string => requireConfig().socialHash.trim().toLowerCase();
  const gasHash = (): string => (requireConfig().gasHash ?? GAS_HASH).trim().toLowerCase();
  const neoHash = (): string => (requireConfig().neoHash ?? NEO_HASH).trim().toLowerCase();
  const appId = (): string => {
    const value = String(deps.appId ?? "").trim();
    if (!value) throw new Error("appId is required");
    return value;
  };
  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? deps.chain.address.get() ?? "").trim() || await deps.chain.ensureWallet();
    return accountToHash160(resolved);
  };
  const read = (operation: string, args: Array<{ type: string; value: unknown }>) =>
    deps.chain.read(operation, args, { scriptHash: socialHash() });
  const invoke = (
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformSocialInvokeOptions,
  ) => deps.chain.invoke(operation, args, { ...options, scriptHash: socialHash() });
  const invokeAssetTransfer = (
    assetHash: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformSocialInvokeOptions,
  ) => deps.chain.invoke("transfer", args, { ...options, scriptHash: assetHash });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformSocialTx>) =>
    guardedWrite(deps.guards, WRITE_PRIMARY, run);
  const tenantArgs = (): Array<{ type: string; value: unknown }> => [
    { type: "String", value: appId() },
  ];
  const idArg = (value: string | number | bigint, label: string) => ({
    type: "Integer",
    value: positive(value, label),
  });
  const accountArg = (value: string) => ({ type: "Hash160", value });

  return {
    get available() {
      return valid;
    },
    prepayGasCredit: write(async (amount, payer, options) => invokeAssetTransfer(gasHash(), [
      accountArg(await account(payer)),
      accountArg(socialHash()),
      idArg(amount, "amount"),
      { type: "String", value: `${appId()}:credit` },
    ], options)),
    prepayNeoCredit: write(async (amount, payer, options) => invokeAssetTransfer(neoHash(), [
      accountArg(await account(payer)),
      accountArg(socialHash()),
      idArg(amount, "amount"),
      { type: "String", value: `${appId()}:credit` },
    ], options)),
    gasCreditOf: async (value?: string) => parseBigInt(await read("getDirectGasCredit", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    neoCreditOf: async (value?: string) => parseBigInt(await read("getDirectNeoCredit", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    gasCreditLiability: async () => parseBigInt(await read("gasCreditLiabilityOf", tenantArgs())),
    neoCreditLiability: async () => parseBigInt(await read("neoCreditLiabilityOf", tenantArgs())),
    totalGasCreditLiability: async () => parseBigInt(await read("totalGasCreditLiability", [])),
    totalNeoCreditLiability: async () => parseBigInt(await read("totalNeoCreditLiability", [])),
    withdrawGasCredit: write(async (amount, value) => invoke("withdrawGasCredit", [
      ...tenantArgs(), accountArg(await account(value)), idArg(amount, "amount"),
    ])),
    withdrawNeoCredit: write(async (amount, value) => invoke("withdrawNeoCredit", [
      ...tenantArgs(), accountArg(await account(value)), idArg(amount, "amount"),
    ])),
    createEnvelope: write(async (packetCount, expiryMs, creator) => invoke("createEnvelope", [
      ...tenantArgs(), accountArg(await account(creator)), idArg(packetCount, "packetCount"), idArg(expiryMs, "expiryMs"),
    ])),
    claimEnvelope: write(async (envelopeId, claimer) => invoke("claimEnvelope", [
      ...tenantArgs(), idArg(envelopeId, "envelopeId"), accountArg(await account(claimer)),
    ])),
    refundExpiredEnvelope: write(async (envelopeId) => invoke("refundExpiredEnvelope", [
      ...tenantArgs(), idArg(envelopeId, "envelopeId"),
    ])),
    getEnvelope: async (envelopeId) => read("getEnvelope", [...tenantArgs(), idArg(envelopeId, "envelopeId")]),
    hasClaimed: async (envelopeId, claimer) => parseBool(await read("hasClaimed", [
      ...tenantArgs(), idArg(envelopeId, "envelopeId"), accountArg(await account(claimer)),
    ])),
    createRangeGasPool: write(async (input) => invoke("createRangeGasPool", [
      ...tenantArgs(),
      accountArg(await account(input.creator)),
      idArg(input.totalAmount, "totalAmount"),
      idArg(input.minClaimAmount, "minClaimAmount"),
      idArg(input.maxClaimAmount, "maxClaimAmount"),
      idArg(input.maxClaims, "maxClaims"),
      idArg(input.expiryMs, "expiryMs"),
    ])),
    claimRangeGasPool: write(async (poolId, claimer) => invoke("claimRangeGasPool", [
      ...tenantArgs(), idArg(poolId, "poolId"), accountArg(await account(claimer)),
    ])),
    fundRangeGasPool: write(async (poolId, amount, creator) => invoke("fundRangeGasPool", [
      ...tenantArgs(), idArg(poolId, "poolId"), accountArg(await account(creator)), idArg(amount, "amount"),
    ])),
    refundRangeGasPool: write(async (poolId) => invoke("refundRangeGasPool", [
      ...tenantArgs(), idArg(poolId, "poolId"),
    ])),
    getRangeGasPool: async (poolId) => read("getRangeGasPool", [...tenantArgs(), idArg(poolId, "poolId")]),
    hasClaimedRangeGasPool: async (poolId, claimer) => parseBool(await read("hasClaimedRangeGasPool", [
      ...tenantArgs(), idArg(poolId, "poolId"), accountArg(await account(claimer)),
    ])),
    createTrust: write(async (heir, heartbeatIntervalMs, owner) => invoke("createTrust", [
      ...tenantArgs(), accountArg(await account(owner)), accountArg(accountToHash160(heir)), idArg(heartbeatIntervalMs, "heartbeatIntervalMs"),
    ])),
    heartbeat: write(async (trustId) => invoke("heartbeat", [...tenantArgs(), idArg(trustId, "trustId")])),
    executeTrust: write(async (trustId, executor) => invoke("executeTrust", [
      ...tenantArgs(), idArg(trustId, "trustId"), accountArg(await account(executor)),
    ])),
    cancelTrust: write(async (trustId) => invoke("cancelTrust", [...tenantArgs(), idArg(trustId, "trustId")])),
    addGuardian: write(async (trustId, guardian) => invoke("addGuardian", [
      ...tenantArgs(), idArg(trustId, "trustId"), accountArg(accountToHash160(guardian)),
    ])),
    getTrust: async (trustId) => read("getTrust", [...tenantArgs(), idArg(trustId, "trustId")]),
    isGuardian: async (trustId, guardian) => parseBool(await read("isGuardian", [
      ...tenantArgs(), idArg(trustId, "trustId"), accountArg(await account(guardian)),
    ])),
    createVault: write(async (secretHashHex, difficulty, creator) => invoke("createVault", [
      ...tenantArgs(),
      accountArg(await account(creator)),
      { type: "ByteArray", value: byteArray(secretHashHex, "secretHashHex", 32) },
      idArg(difficulty, "difficulty"),
    ])),
    commitAttempt: write(async (vaultId, commitmentHex, attacker) => invoke("commitAttempt", [
      ...tenantArgs(),
      idArg(vaultId, "vaultId"),
      accountArg(await account(attacker)),
      { type: "ByteArray", value: byteArray(commitmentHex, "commitmentHex", 32) },
    ])),
    revealAttempt: write(async (vaultId, solutionHex, saltHex, attacker) => invoke("revealAttempt", [
      ...tenantArgs(),
      idArg(vaultId, "vaultId"),
      accountArg(await account(attacker)),
      { type: "ByteArray", value: byteArray(solutionHex, "solutionHex") },
      { type: "ByteArray", value: byteArray(saltHex, "saltHex") },
    ])),
    increaseBounty: write(async (vaultId, amount) => invoke("increaseBounty", [
      ...tenantArgs(), idArg(vaultId, "vaultId"), idArg(amount, "amount"),
    ])),
    refundExpiredVault: write(async (vaultId) => invoke("refundExpiredVault", [
      ...tenantArgs(), idArg(vaultId, "vaultId"),
    ])),
    getVault: async (vaultId) => read("getVault", [...tenantArgs(), idArg(vaultId, "vaultId")]),
    notarize: write(async (digestHex, submitter, options) => invoke("notarize", [
      ...tenantArgs(),
      accountArg(await account(submitter)),
      { type: "ByteArray", value: byteArray(digestHex, "digestHex", 32) },
    ], options)),
    getNotarization: async (digestHex) => {
      const raw = await read("getNotarization", [
        ...tenantArgs(),
        { type: "ByteArray", value: byteArray(digestHex, "digestHex", 32) },
      ]);
      if (!Array.isArray(raw) || raw.length < 4 || !parseBool(raw[3])) return null;
      const submitter = parseHash160(raw[0]);
      if (!submitter) return null;
      return {
        submitter,
        timestampMs: parseBigInt(raw[1]),
        blockIndex: parseBigInt(raw[2]),
      };
    },
    isNotarized: async (digestHex) => parseBool(await read("isNotarized", [
      ...tenantArgs(),
      { type: "ByteArray", value: byteArray(digestHex, "digestHex", 32) },
    ])),
    notarizationCount: async () => parseBigInt(await read("notarizationCount", tenantArgs())),
  };
}
