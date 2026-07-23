import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PLATFORM_ANCHOR, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { parseHash160 } from "./utils/neo";
import { parseBigInt, parseBool } from "./utils/parsers";

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const PUBLIC_KEY_RE = /^(02|03)[0-9a-fA-F]{64}$/;
const HEX_RE = /^(?:[0-9a-fA-F]{2})+$/;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export interface FrameworkPlatformAnchorConfig {
  anchorHash: string;
  neoHash?: string;
}

export interface FrameworkPlatformAnchorTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkPlatformAnchorInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface PlatformAnchorSurfaceChain {
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
    options?: FrameworkPlatformAnchorInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkPlatformAnchorTx>;
}

export interface PlatformAnchorSurfaceDeps {
  appId: string;
  chain: PlatformAnchorSurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformAnchorConfig;
}

export interface FrameworkPlatformAnchorSurface {
  readonly available: boolean;
  appMode(): Promise<bigint>;
  appAdmin(): Promise<string>;
  appPaused(): Promise<boolean>;
  totalStaked(): Promise<bigint>;
  totalStakers(): Promise<bigint>;
  rewardPerNeo(): Promise<bigint>;
  rewardReserve(): Promise<bigint>;
  totalRewardReserve(): Promise<bigint>;
  rewardRemainder(): Promise<bigint>;
  agentCount(): Promise<bigint>;
  userStake(account?: string): Promise<bigint>;
  pendingRewards(account?: string): Promise<bigint>;
  credit(asset: "NEO" | "GAS", account?: string): Promise<bigint>;
  totalGasCredit(): Promise<bigint>;
  agent(agentId: string | number | bigint): Promise<unknown>;
  agentCandidate(agentId: string | number | bigint): Promise<unknown>;
  agentAccount(agentId: string | number | bigint): Promise<string>;
  selectedAgentId(): Promise<bigint>;
  selectedCandidate(): Promise<unknown>;
  stats(): Promise<unknown>;
  stakeNeo(
    amount: string | number | bigint,
    account?: string,
    options?: FrameworkPlatformAnchorInvokeOptions,
  ): Promise<FrameworkPlatformAnchorTx>;
  withdraw(
    amount: string | number | bigint,
    account?: string,
    options?: FrameworkPlatformAnchorInvokeOptions,
  ): Promise<FrameworkPlatformAnchorTx>;
  claimRewards(
    account?: string,
    options?: FrameworkPlatformAnchorInvokeOptions,
  ): Promise<FrameworkPlatformAnchorTx>;
  withdrawCredit(
    asset: "NEO" | "GAS",
    amount: string | number | bigint,
    account?: string,
    options?: FrameworkPlatformAnchorInvokeOptions,
  ): Promise<FrameworkPlatformAnchorTx>;
  registerAgent(account: string, candidate: string, verificationScriptHash: string): Promise<FrameworkPlatformAnchorTx>;
  registerAgents(agents: Array<{ account: string; candidate: string; verificationScriptHash: string }>): Promise<FrameworkPlatformAnchorTx>;
  setAgentCandidate(agentId: string | number | bigint, candidate: string): Promise<FrameworkPlatformAnchorTx>;
  setAgentAccount(agentId: string | number | bigint, account: string, verificationScriptHash: string): Promise<FrameworkPlatformAnchorTx>;
  transferAgentNeo(fromAgentId: string | number | bigint, toAgentId: string | number | bigint, amount: string | number | bigint): Promise<FrameworkPlatformAnchorTx>;
  voteAgent(agentId: string | number | bigint): Promise<FrameworkPlatformAnchorTx>;
  harvestRewards(amount: string | number | bigint): Promise<FrameworkPlatformAnchorTx>;
  fundRewards(amount: string | number | bigint, funder?: string): Promise<FrameworkPlatformAnchorTx>;
  stakeFromCredit(amount: string | number | bigint, account?: string): Promise<FrameworkPlatformAnchorTx>;
}

function positive(value: string | number | bigint, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized <= 0n) throw new Error(`${label} must be a positive integer`);
  return normalized.toString();
}

function publicKey(value: string): string {
  const normalized = String(value ?? "").trim().replace(/^0x/i, "");
  if (!PUBLIC_KEY_RE.test(normalized)) throw new Error("candidate must be a compressed public key");
  return normalized.toLowerCase();
}

function byteArray(value: string): string {
  const normalized = String(value ?? "").trim().replace(/^0x/i, "");
  if (!HEX_RE.test(normalized)) throw new Error("verificationScriptHash must be non-empty even-length hex");
  return normalized.toLowerCase();
}

export function createPlatformAnchorSurface(
  deps: PlatformAnchorSurfaceDeps,
): FrameworkPlatformAnchorSurface {
  const config = deps.config;
  const valid = Boolean(config && HASH160_RE.test(String(config.anchorHash ?? "").trim()));
  const requireConfig = (): FrameworkPlatformAnchorConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "platformAnchor",
        "Platform anchor engine is not configured on this host",
      );
    }
    if (!HASH160_RE.test(String(config.anchorHash ?? "").trim())) {
      throw new FrameworkCapabilityError(
        "platformAnchor",
        "platformAnchor config is missing a valid anchorHash",
      );
    }
    if (config.neoHash && !HASH160_RE.test(String(config.neoHash).trim())) {
      throw new FrameworkCapabilityError(
        "platformAnchor",
        "platformAnchor config has an invalid neoHash",
      );
    }
    return config;
  };
  const anchorHash = () => requireConfig().anchorHash.trim().toLowerCase();
  const neoHash = () => (requireConfig().neoHash ?? NEO_HASH).trim().toLowerCase();
  const appId = (): string => {
    const value = String(deps.appId ?? "").trim();
    if (!value) throw new Error("appId is required");
    return value;
  };
  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? deps.chain.address.get() ?? "").trim() || await deps.chain.ensureWallet();
    return accountToHash160(resolved);
  };
  const tenantArgs = () => [{ type: "String", value: appId() }];
  const accountArg = (value: string) => ({ type: "Hash160", value });
  const idArg = (value: string | number | bigint, label: string) => ({
    type: "Integer",
    value: positive(value, label),
  });
  const read = (operation: string, args: Array<{ type: string; value: unknown }> = []) =>
    deps.chain.read(operation, args, { scriptHash: anchorHash() });
  const invoke = (
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformAnchorInvokeOptions,
  ) => deps.chain.invoke(operation, args, { ...(options ?? {}), scriptHash: anchorHash() });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformAnchorTx>) =>
    guardedWrite(deps.guards, WRITE_PLATFORM_ANCHOR, run);

  return {
    get available() {
      return valid;
    },
    appMode: async () => parseBigInt(await read("getAppMode", tenantArgs())),
    appAdmin: async () => parseHash160(await read("getAppAdmin", tenantArgs())),
    appPaused: async () => parseBool(await read("isAppPaused", tenantArgs())),
    totalStaked: async () => parseBigInt(await read("getTotalStaked", tenantArgs())),
    totalStakers: async () => parseBigInt(await read("getTotalStakers", tenantArgs())),
    rewardPerNeo: async () => parseBigInt(await read("getRewardPerNeo", tenantArgs())),
    rewardReserve: async () => parseBigInt(await read("getRewardReserve", tenantArgs())),
    totalRewardReserve: async () => parseBigInt(await read("getTotalRewardReserve")),
    rewardRemainder: async () => parseBigInt(await read("getRewardRemainder", tenantArgs())),
    agentCount: async () => parseBigInt(await read("getAgentCount", tenantArgs())),
    userStake: async (value) => parseBigInt(await read("getUserStake", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    pendingRewards: async (value) => parseBigInt(await read("getPendingRewards", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    credit: async (asset, value) => parseBigInt(await read("getCredit", [
      accountArg(await account(value)), { type: "String", value: asset },
    ])),
    totalGasCredit: async () => parseBigInt(await read("getTotalGasCredit")),
    agent: async (agentId) => read("getAgent", [...tenantArgs(), idArg(agentId, "agentId")]),
    agentCandidate: async (agentId) => read("getAgentCandidate", [...tenantArgs(), idArg(agentId, "agentId")]),
    agentAccount: async (agentId) => parseHash160(await read("getAgentAccount", [
      ...tenantArgs(), idArg(agentId, "agentId"),
    ])),
    selectedAgentId: async () => parseBigInt(await read("getSelectedAgentId", tenantArgs())),
    selectedCandidate: async () => read("getSelectedCandidate", tenantArgs()),
    stats: async () => read("getAnchorStats", tenantArgs()),
    stakeNeo: write(async (amount, value, options) => deps.chain.invoke("transfer", [
      accountArg(await account(value)),
      accountArg(anchorHash()),
      idArg(amount, "amount"),
      { type: "String", value: `stake:${appId()}` },
    ], { ...(options ?? {}), scriptHash: neoHash() })),
    withdraw: write(async (amount, value, options) => invoke("withdraw", [
      ...tenantArgs(), accountArg(await account(value)), idArg(amount, "amount"),
    ], options)),
    claimRewards: write(async (value, options) => invoke("claimRewards", [
      ...tenantArgs(), accountArg(await account(value)),
    ], options)),
    withdrawCredit: write(async (asset, amount, value, options) => invoke("withdrawCredit", [
      accountArg(await account(value)), { type: "String", value: asset }, idArg(amount, "amount"),
    ], options)),
    registerAgent: write(async (value, candidate, verificationScriptHash) => invoke("registerAgent", [
      ...tenantArgs(),
      accountArg(accountToHash160(value)),
      { type: "PublicKey", value: publicKey(candidate) },
      { type: "ByteArray", value: byteArray(verificationScriptHash) },
    ])),
    registerAgents: write(async (agents) => {
      if (!Array.isArray(agents) || agents.length === 0 || agents.length > 21) {
        throw new Error("agents must contain 1 to 21 entries");
      }
      return invoke("registerAgents", [
        ...tenantArgs(),
        { type: "Array", value: agents.map((entry) => accountArg(accountToHash160(entry.account))) },
        { type: "Array", value: agents.map((entry) => ({ type: "PublicKey", value: publicKey(entry.candidate) })) },
        { type: "Array", value: agents.map((entry) => ({ type: "ByteArray", value: byteArray(entry.verificationScriptHash) })) },
      ]);
    }),
    setAgentCandidate: write(async (agentId, candidate) => invoke("setAgentCandidate", [
      ...tenantArgs(), idArg(agentId, "agentId"), { type: "PublicKey", value: publicKey(candidate) },
    ])),
    setAgentAccount: write(async (agentId, value, verificationScriptHash) => invoke("setAgentAccount", [
      ...tenantArgs(), idArg(agentId, "agentId"), accountArg(accountToHash160(value)),
      { type: "ByteArray", value: byteArray(verificationScriptHash) },
    ])),
    transferAgentNeo: write(async (fromAgentId, toAgentId, amount) => invoke("transferAgentNeo", [
      ...tenantArgs(), idArg(fromAgentId, "fromAgentId"), idArg(toAgentId, "toAgentId"), idArg(amount, "amount"),
    ])),
    voteAgent: write(async (agentId) => invoke("voteAgent", [
      ...tenantArgs(), idArg(agentId, "agentId"),
    ])),
    harvestRewards: write(async (amount) => invoke("harvestRewards", [
      ...tenantArgs(), idArg(amount, "amount"),
    ])),
    fundRewards: write(async (amount, funder) => invoke("fundRewards", [
      ...tenantArgs(), accountArg(await account(funder)), idArg(amount, "amount"),
    ])),
    stakeFromCredit: write(async (amount, value) => invoke("stake", [
      ...tenantArgs(), accountArg(await account(value)), idArg(amount, "amount"),
    ])),
  };
}
