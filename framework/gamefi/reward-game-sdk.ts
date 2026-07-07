import { eventStateValue } from "../utils/chain-events";
import { fromFixed8 } from "../utils/format";
import { addressToScriptHash } from "../utils/neo";
import { parseBigInt } from "../utils/parsers";
import {
  morpheusNetworkOf,
  teeSessionSealOpLog,
  teeSessionStart,
  teeSessionStep,
} from "../logic/tee-session";
import type {
  TeeIdentity,
  TeeSessionOp,
  TeeStartResult,
  TeeStepResult,
} from "../logic/tee-session";

const FIXED8 = 100_000_000n;

export type Fixed8Input = bigint | number | string;

export interface RewardGameMode {
  id: number;
  key?: string;
  label?: string;
  entryFixed8: Fixed8Input;
  rewardFixed8: Fixed8Input;
  limitMs?: number;
  minSolveMs?: number;
  target?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedRewardGameMode extends Omit<RewardGameMode, "entryFixed8" | "rewardFixed8"> {
  entryFixed8: bigint;
  rewardFixed8: bigint;
  entryGas: number;
  rewardGas: number;
}

export interface RewardGameContractMethods {
  startGame: string;
  finalizeGame: string;
  expireGame: string;
  withdraw: string;
  freePool: string;
  creditOf: string;
  activeGameOf: string;
  getGame: string;
  statsOf: string;
}

export interface RewardGameEvents {
  gameStarted: string;
  solved: string;
  creditWithdrawn: string;
}

export interface RewardGameEventSlots {
  gameStartedGameId: number;
  solvedPlayer: number;
  solvedDifficulty: number;
  solvedElapsedMs: number;
  solvedPayout: number;
}

export interface RewardGameConfig {
  appId: string;
  engineHash: string;
  entryMemo: string;
  modes: readonly RewardGameMode[];
  methods?: Partial<RewardGameContractMethods>;
  events?: Partial<RewardGameEvents>;
  eventSlots?: Partial<RewardGameEventSlots>;
  waitTimeoutMs?: {
    start?: number;
    finalize?: number;
    withdraw?: number;
  };
  settlement?: {
    pollAttempts?: number;
    pollDelayMs?: number;
  };
  progression?: RewardGameProgressionPolicy;
}

export interface RewardGameProgressionPolicy {
  /**
   * When true, startRewardGame reads the connected player's Solved history
   * before payment and rejects lower completed tiers. This is product-side
   * gating; contracts/TEE should still enforce the same rule for funds safety.
   */
  enabled?: boolean;
  eventLimit?: number;
  hardLimitStepMs?: number;
  hardLimitMinMs?: number;
}

export interface RewardGameProgressionState {
  requestedDifficulty: number;
  requiredDifficulty: number;
  maxDifficulty: number;
  completedDifficulties: number[];
  hardWins: number;
  hardChallengeLevel: number;
  allowed: boolean;
  reason: "ok" | "difficulty-locked";
  effectiveLimitMs?: number;
}

export interface RewardGameContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean;
}

export interface RewardGameInvokeOptions {
  scriptHash?: string;
  signers?: Array<{
    account: string;
    scopes: string | number;
    allowedContracts?: string[];
    allowedGroups?: string[];
    rules?: unknown[];
  }>;
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onPaymentSent?: (txid: string) => void;
}

export interface RewardGameTxResult {
  txid: string;
  event?: unknown;
  success?: boolean;
  verified?: boolean;
}

export interface RewardGameChain {
  address: { get(): string | null };
  contractAddress: { get(): string | null };
  ensureWallet(): Promise<string>;
  detectNetwork(): Promise<string>;
  read(operation: string, args?: RewardGameContractArg[]): Promise<unknown>;
  invoke(
    operation: string,
    args: RewardGameContractArg[],
    options?: RewardGameInvokeOptions,
  ): Promise<RewardGameTxResult>;
  invokeWithPayment(
    amount: string,
    memo: string,
    operation: string,
    args: RewardGameContractArg[],
    options?: RewardGameInvokeOptions,
  ): Promise<RewardGameTxResult>;
  listEvents?(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]>;
}

export interface RewardGameBalances {
  playerHash: string;
  poolFreeFixed8: bigint;
  poolFreeGas: number;
  creditFixed8: bigint;
  creditGas: number;
}

export interface RewardGameStartResult {
  tx: RewardGameTxResult;
  gameId: string;
  player: string;
  playerHash: string;
  mode: NormalizedRewardGameMode;
  usedCredit: boolean;
  balances: RewardGameBalances;
  progression?: RewardGameProgressionState;
}

export type RewardGameSession = TeeStartResult & { identity: TeeIdentity };

export interface RewardGameStepResult<Op extends TeeSessionOp = TeeSessionOp> {
  step: TeeStepResult;
  opLog: Op[];
  recovered: boolean;
}

export interface RewardGameStorage<Op extends TeeSessionOp = TeeSessionOp> {
  load(gameId: string): Op[];
  save(gameId: string, ops: readonly Op[]): void;
  forget(gameId: string): void;
}

export type RewardGameStatus =
  | "committed"
  | "dealt"
  | "solved"
  | "expired"
  | "refunded"
  | "unknown";

export interface RewardGameSnapshot {
  gameId: string;
  status: RewardGameStatus;
  difficulty: number;
  commitment: string;
  dealtAt: number;
  deadline: number;
  payoutFixed8: bigint;
  payoutGas: number;
  solveMs: number;
  raw: unknown;
}

export interface RewardGameSettlement {
  gameId: string;
  status: RewardGameStatus;
  payoutFixed8: bigint;
  payoutGas: number;
  elapsedMs: number;
  source: "event" | "poll" | "timeout";
}

export interface RewardGameFinalizeResult {
  tx: RewardGameTxResult;
  sealedOpLogHex: string;
  opCount: number;
  settlement: RewardGameSettlement;
}

export interface RewardGameRecoverResult {
  gameId: string;
  playerHash: string;
  snapshot: RewardGameSnapshot | null;
}

export class RewardGameError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RewardGameError";
    this.code = code;
  }
}

const DEFAULT_METHODS: RewardGameContractMethods = {
  startGame: "startGame",
  finalizeGame: "finalizeGame",
  expireGame: "expireGame",
  withdraw: "withdraw",
  freePool: "freePool",
  creditOf: "creditOf",
  activeGameOf: "activeGameOf",
  getGame: "getGame",
  statsOf: "statsOf",
};

const DEFAULT_EVENTS: RewardGameEvents = {
  gameStarted: "GameStarted",
  solved: "Solved",
  creditWithdrawn: "CreditWithdrawn",
};

const DEFAULT_EVENT_SLOTS: RewardGameEventSlots = {
  gameStartedGameId: 0,
  solvedPlayer: 1,
  solvedDifficulty: 2,
  solvedElapsedMs: 3,
  solvedPayout: 5,
};

export function rewardGameMethods(config: RewardGameConfig): RewardGameContractMethods {
  return { ...DEFAULT_METHODS, ...config.methods };
}

export function rewardGameEvents(config: RewardGameConfig): RewardGameEvents {
  return { ...DEFAULT_EVENTS, ...config.events };
}

export function rewardGameEventSlots(config: RewardGameConfig): RewardGameEventSlots {
  return { ...DEFAULT_EVENT_SLOTS, ...config.eventSlots };
}

export function gasToFixed8(value: string | number): bigint {
  const raw = typeof value === "number"
    ? Number.isFinite(value)
      ? value.toFixed(8).replace(/\.?0+$/, "")
      : ""
    : String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new RewardGameError("BAD_AMOUNT", `Invalid GAS amount: ${raw}`);
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  if (fraction.length > 8) {
    throw new RewardGameError("BAD_AMOUNT", "GAS amount cannot have more than 8 decimals");
  }
  return BigInt(whole || "0") * FIXED8 + BigInt((fraction || "").padEnd(8, "0") || "0");
}

export function fixed8ToGasString(value: Fixed8Input, maxDecimals = 8): string {
  const fixed8 = fixed8Of(value);
  const whole = fixed8 / FIXED8;
  const fraction = fixed8 % FIXED8;
  if (fraction === 0n || maxDecimals <= 0) return whole.toString();
  const decimals = fraction
    .toString()
    .padStart(8, "0")
    .slice(0, Math.min(Math.max(maxDecimals, 0), 8))
    .replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : whole.toString();
}

export function fixed8Of(value: Fixed8Input): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 0n;
  if (raw.includes(".")) return gasToFixed8(raw);
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function normalizeRewardGameMode(mode: RewardGameMode): NormalizedRewardGameMode {
  const entryFixed8 = fixed8Of(mode.entryFixed8);
  const rewardFixed8 = fixed8Of(mode.rewardFixed8);
  if (entryFixed8 <= 0n) {
    throw new RewardGameError("BAD_MODE", `Reward-game mode ${mode.id} must have a positive entry`);
  }
  if (rewardFixed8 < 0n) {
    throw new RewardGameError("BAD_MODE", `Reward-game mode ${mode.id} cannot have a negative reward`);
  }
  return {
    ...mode,
    entryFixed8,
    rewardFixed8,
    entryGas: fromFixed8(entryFixed8),
    rewardGas: fromFixed8(rewardFixed8),
  };
}

export function rewardGameModeOf(
  config: RewardGameConfig,
  difficulty: number | string,
): NormalizedRewardGameMode {
  const id = Math.max(0, Math.trunc(Number(difficulty) || 0));
  const mode = config.modes.find((entry) => entry.id === id) ?? config.modes[0];
  if (!mode) {
    throw new RewardGameError("NO_MODE", `${config.appId} has no reward-game modes`);
  }
  return normalizeRewardGameMode(mode);
}

function rewardGameModeIds(config: RewardGameConfig): number[] {
  return [...new Set(config.modes.map((mode) => Math.max(0, Math.trunc(Number(mode.id) || 0))))]
    .sort((a, b) => a - b);
}

function maxRewardGameDifficulty(config: RewardGameConfig): number {
  const ids = rewardGameModeIds(config);
  return ids.length > 0 ? ids[ids.length - 1]! : 0;
}

export function rewardGameProgressionOf(
  config: RewardGameConfig,
  solvedDifficulties: readonly number[],
  requestedDifficulty: number | string,
): RewardGameProgressionState {
  const requested = Math.max(0, Math.trunc(Number(requestedDifficulty) || 0));
  const ids = rewardGameModeIds(config);
  const maxDifficulty = maxRewardGameDifficulty(config);
  const completed = [...new Set(
    solvedDifficulties
      .map((difficulty) => Math.max(0, Math.trunc(Number(difficulty) || 0)))
      .filter((difficulty) => ids.includes(difficulty)),
  )].sort((a, b) => a - b);
  const highestCompleted = completed.length > 0 ? completed[completed.length - 1]! : -1;
  const requiredDifficulty =
    ids.find((difficulty) => difficulty > highestCompleted) ?? maxDifficulty;
  const hardWins = solvedDifficulties
    .map((difficulty) => Math.max(0, Math.trunc(Number(difficulty) || 0)))
    .filter((difficulty) => difficulty === maxDifficulty)
    .length;
  const mode = rewardGameModeOf(config, Math.min(requested, maxDifficulty));
  const hardLimitStepMs = Math.max(0, config.progression?.hardLimitStepMs ?? 15_000);
  const hardLimitMinMs = Math.max(
    mode.minSolveMs ?? 0,
    config.progression?.hardLimitMinMs ?? Math.max(mode.minSolveMs ?? 0, Math.floor((mode.limitMs ?? 0) * 0.55)),
  );
  const effectiveLimitMs =
    requested >= maxDifficulty && mode.limitMs !== undefined
      ? Math.max(hardLimitMinMs, mode.limitMs - hardWins * hardLimitStepMs)
      : mode.limitMs;
  const allowed = requested >= requiredDifficulty;
  return {
    requestedDifficulty: requested,
    requiredDifficulty,
    maxDifficulty,
    completedDifficulties: completed,
    hardWins,
    hardChallengeLevel: requested >= maxDifficulty ? hardWins + 1 : 0,
    allowed,
    reason: allowed ? "ok" : "difficulty-locked",
    effectiveLimitMs,
  };
}

export async function readRewardGameProgression(
  config: RewardGameConfig,
  chain: RewardGameChain,
  playerHash: string,
  requestedDifficulty: number | string,
): Promise<RewardGameProgressionState> {
  const events = rewardGameEvents(config);
  const slots = rewardGameEventSlots(config);
  if (!chain.listEvents) {
    throw new RewardGameError(
      "PROGRESSION_UNAVAILABLE",
      "Reward-game progression history is unavailable",
    );
  }
  const solvedEvents = await chain.listEvents(events.solved, {
    limit: config.progression?.eventLimit ?? 300,
  });
  const solvedDifficulties = solvedEvents
    .filter((event) => eventHashMatches(eventStateValue(event, slots.solvedPlayer), playerHash))
    .map((event) => Number(parseBigInt(eventStateValue(event, slots.solvedDifficulty))));
  return rewardGameProgressionOf(config, solvedDifficulties, requestedDifficulty);
}

export function rewardGameStatusOf(raw: unknown): RewardGameStatus {
  switch (Number(parseBigInt(raw))) {
    case 1:
      return "dealt";
    case 2:
      return "solved";
    case 3:
      return "expired";
    case 4:
      return "refunded";
    case 0:
      return "committed";
    default:
      return "unknown";
  }
}

export function mapField(map: unknown, key: string): unknown {
  if (map instanceof Map) return map.get(key);
  if (map && typeof map === "object" && key in (map as Record<string, unknown>)) {
    return (map as Record<string, unknown>)[key];
  }
  return undefined;
}

export function normalizedHash(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^0x/, "");
}

export function to0xHash(value: unknown): string {
  const normalized = normalizedHash(value);
  return normalized ? `0x${normalized}` : "";
}

export function eventHashMatches(eventValue: unknown, playerHash: string): boolean {
  const a = normalizedHash(eventValue);
  const b = normalizedHash(playerHash);
  if (!a || !b) return false;
  const reversed = (b.match(/../g) ?? []).reverse().join("");
  return a === b || a === reversed;
}

export function createMemoryRewardGameStorage<Op extends TeeSessionOp = TeeSessionOp>(
  initial?: Record<string, readonly Op[]>,
): RewardGameStorage<Op> {
  const store = new Map<string, Op[]>(
    Object.entries(initial ?? {}).map(([gameId, ops]) => [gameId, [...ops]]),
  );
  return {
    load(gameId) {
      return [...(store.get(gameId) ?? [])];
    },
    save(gameId, ops) {
      store.set(gameId, [...ops]);
    },
    forget(gameId) {
      store.delete(gameId);
    },
  };
}

export function createLocalStorageRewardGameStorage<Op extends TeeSessionOp = TeeSessionOp>(
  prefix: string,
  storage: Storage | null | undefined = globalThis.localStorage,
): RewardGameStorage<Op> {
  const keyOf = (gameId: string) => `${prefix}${gameId}`;
  return {
    load(gameId) {
      if (!storage) return [];
      try {
        const parsed = JSON.parse(storage.getItem(keyOf(gameId)) || "[]") as Op[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    save(gameId, ops) {
      if (!storage) return;
      try {
        storage.setItem(keyOf(gameId), JSON.stringify(ops));
      } catch {
        /* op-log persistence is best-effort */
      }
    },
    forget(gameId) {
      if (!storage) return;
      try {
        storage.removeItem(keyOf(gameId));
      } catch {
        /* nothing to clean */
      }
    },
  };
}

export async function rewardGamePlayerHash(chain: RewardGameChain, prompt = false): Promise<{
  player: string;
  playerHash: string;
}> {
  const player = prompt ? await chain.ensureWallet() : chain.address.get();
  const playerHash = player ? addressToScriptHash(player) : "";
  if (!player || !playerHash) {
    throw new RewardGameError("NO_WALLET", "Connect a wallet before starting the game");
  }
  return { player, playerHash };
}

export async function refreshRewardGameBalances(
  config: RewardGameConfig,
  chain: RewardGameChain,
  playerHash?: string,
): Promise<RewardGameBalances> {
  const methods = rewardGameMethods(config);
  const connected = chain.address.get();
  const hash = playerHash || (connected ? addressToScriptHash(connected) : "");
  let poolFreeFixed8 = 0n;
  let creditFixed8 = 0n;
  try {
    poolFreeFixed8 = parseBigInt(await chain.read(methods.freePool, []));
  } catch {
    poolFreeFixed8 = 0n;
  }
  if (hash) {
    try {
      creditFixed8 = parseBigInt(await chain.read(methods.creditOf, [
        { type: "Hash160", value: hash },
      ]));
    } catch {
      creditFixed8 = 0n;
    }
  }
  return {
    playerHash: hash,
    poolFreeFixed8,
    poolFreeGas: fromFixed8(poolFreeFixed8),
    creditFixed8,
    creditGas: fromFixed8(creditFixed8),
  };
}

export async function buildRewardGameIdentity(
  config: RewardGameConfig,
  chain: RewardGameChain,
  gameId: string,
  difficulty: number,
): Promise<TeeIdentity> {
  const { playerHash } = await rewardGamePlayerHash(chain);
  const contractHash = chain.contractAddress.get();
  if (!contractHash) {
    throw new RewardGameError("NO_CONTRACT", `${config.appId} has no bound contract`);
  }
  let detected = "testnet";
  try {
    detected = await chain.detectNetwork();
  } catch {
    detected = "testnet";
  }
  return {
    appId: config.appId,
    engineHash: config.engineHash,
    network: morpheusNetworkOf(detected),
    contractHash: to0xHash(contractHash),
    gameId,
    player: to0xHash(playerHash),
    difficulty,
  };
}

export async function startRewardGame<Op extends TeeSessionOp = TeeSessionOp>(
  config: RewardGameConfig,
  chain: RewardGameChain,
  difficulty: number,
  storage?: RewardGameStorage<Op>,
): Promise<RewardGameStartResult> {
  const methods = rewardGameMethods(config);
  const events = rewardGameEvents(config);
  const slots = rewardGameEventSlots(config);
  const mode = rewardGameModeOf(config, difficulty);
  const player = await chain.ensureWallet();
  const playerHash = addressToScriptHash(player);
  if (!playerHash) throw new RewardGameError("BAD_WALLET", "Wallet address is not a valid Neo address");

  const progression = config.progression?.enabled
    ? await readRewardGameProgression(config, chain, playerHash, difficulty)
    : undefined;
  if (progression && !progression.allowed) {
    throw new RewardGameError(
      "DIFFICULTY_LOCKED",
      `This account must play difficulty ${progression.requiredDifficulty} or higher`,
    );
  }

  const balances = await refreshRewardGameBalances(config, chain, playerHash);
  if (balances.poolFreeFixed8 < mode.rewardFixed8) {
    throw new RewardGameError("POOL_LOW", "Reward pool cannot cover this game's payout");
  }

  const args: RewardGameContractArg[] = [
    { type: "Hash160", value: playerHash },
    { type: "Integer", value: String(mode.id) },
  ];
  const options = {
    waitForEvent: events.gameStarted,
    waitTimeoutMs: config.waitTimeoutMs?.start ?? 30_000,
  };
  const usedCredit = balances.creditFixed8 >= mode.entryFixed8;
  const tx = usedCredit
    ? await chain.invoke(methods.startGame, args, options)
    : await chain.invokeWithPayment(
        mode.entryFixed8.toString(),
        config.entryMemo,
        methods.startGame,
        args,
        options,
      );

  let gameId = tx.event != null
    ? String(parseBigInt(eventStateValue(tx.event, slots.gameStartedGameId)) || "")
    : "";
  if (!gameId || gameId === "0") {
    gameId = String(parseBigInt(await chain.read(methods.activeGameOf, [
      { type: "Hash160", value: playerHash },
    ])) || "0");
  }
  if (!gameId || gameId === "0") {
    throw new RewardGameError("NO_GAME_ID", "Game start transaction did not expose an active game id");
  }
  storage?.forget(gameId);
  return {
    tx,
    gameId,
    player,
    playerHash,
    mode,
    usedCredit,
    balances,
    progression,
  };
}

export async function openRewardGameSession(
  config: RewardGameConfig,
  chain: RewardGameChain,
  gameId: string,
  difficulty: number,
  fetcher?: typeof fetch,
): Promise<RewardGameSession> {
  const identity = await buildRewardGameIdentity(config, chain, gameId, difficulty);
  const started = await teeSessionStart(identity, fetcher);
  return { ...started, identity };
}

export async function recordRewardGameOp<Op extends TeeSessionOp>(
  session: RewardGameSession,
  storage: RewardGameStorage<Op>,
  op: Op,
  fetcher?: typeof fetch,
): Promise<RewardGameStepResult<Op>> {
  const gameId = session.identity.gameId;
  const existing = storage.load(gameId);
  let recovered = false;
  let step: TeeStepResult;
  try {
    step = await teeSessionStep(session.identity, session.sessionToken, existing.length, op, undefined, fetcher);
  } catch {
    recovered = true;
    step = await teeSessionStep(session.identity, session.sessionToken, existing.length, op, existing, fetcher);
  }
  const opLog = [...existing, op];
  storage.save(gameId, opLog);
  return { step, opLog, recovered };
}

export async function replayRewardGameOps<Op extends TeeSessionOp>(
  session: RewardGameSession,
  opLog: readonly Op[],
  onStep?: (step: TeeStepResult, op: Op, index: number) => void | Promise<void>,
  fetcher?: typeof fetch,
): Promise<TeeStepResult[]> {
  const steps: TeeStepResult[] = [];
  for (let index = 0; index < opLog.length; index += 1) {
    const op = opLog[index];
    if (!op) continue;
    const step = await teeSessionStep(
      session.identity,
      session.sessionToken,
      index,
      op,
      opLog as TeeSessionOp[],
      fetcher,
    );
    steps.push(step);
    await onStep?.(step, op, index);
  }
  return steps;
}

export async function finalizeRewardGame<Op extends TeeSessionOp>(
  config: RewardGameConfig,
  chain: RewardGameChain,
  session: RewardGameSession,
  storage: RewardGameStorage<Op>,
  options?: {
    pollAttempts?: number;
    pollDelayMs?: number;
    delay?: (ms: number) => Promise<void>;
    fetcher?: typeof fetch;
  },
): Promise<RewardGameFinalizeResult> {
  const methods = rewardGameMethods(config);
  const events = rewardGameEvents(config);
  const gameId = session.identity.gameId;
  const opLog = storage.load(gameId);
  const sealed = await teeSessionSealOpLog(session.identity, opLog, options?.fetcher);
  const tx = await chain.invoke(
    methods.finalizeGame,
    [
      { type: "Integer", value: gameId },
      { type: "String", value: sealed.sealedOpLogHex },
    ],
    {
      waitForEvent: events.solved,
      waitTimeoutMs: config.waitTimeoutMs?.finalize ?? 60_000,
    },
  );
  const settlement = await observeRewardGameSettlement(config, chain, gameId, tx.event, {
    pollAttempts: options?.pollAttempts,
    pollDelayMs: options?.pollDelayMs,
    delay: options?.delay,
  });
  storage.forget(gameId);
  return {
    tx,
    sealedOpLogHex: sealed.sealedOpLogHex,
    opCount: opLog.length,
    settlement,
  };
}

export async function observeRewardGameSettlement(
  config: RewardGameConfig,
  chain: RewardGameChain,
  gameId: string,
  solvedEvent?: unknown | null,
  options?: {
    pollAttempts?: number;
    pollDelayMs?: number;
    delay?: (ms: number) => Promise<void>;
  },
): Promise<RewardGameSettlement> {
  const slots = rewardGameEventSlots(config);
  if (solvedEvent != null) {
    const payoutFixed8 = parseBigInt(eventStateValue(solvedEvent, slots.solvedPayout));
    return {
      gameId,
      status: payoutFixed8 > 0n ? "solved" : "expired",
      payoutFixed8,
      payoutGas: fromFixed8(payoutFixed8),
      elapsedMs: Number(parseBigInt(eventStateValue(solvedEvent, slots.solvedElapsedMs))),
      source: "event",
    };
  }

  const attempts = options?.pollAttempts ?? config.settlement?.pollAttempts ?? 20;
  const pollDelayMs = options?.pollDelayMs ?? config.settlement?.pollDelayMs ?? 3_000;
  const delay = options?.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const snapshot = await readRewardGameSnapshot(config, chain, gameId);
      if (snapshot.status === "solved" || snapshot.status === "expired" || snapshot.status === "refunded") {
        return {
          gameId,
          status: snapshot.status,
          payoutFixed8: snapshot.payoutFixed8,
          payoutGas: snapshot.payoutGas,
          elapsedMs: snapshot.solveMs,
          source: "poll",
        };
      }
    } catch {
      /* transient read failure — keep polling */
    }
    if (attempt < attempts - 1) await delay(pollDelayMs);
  }
  return {
    gameId,
    status: "unknown",
    payoutFixed8: 0n,
    payoutGas: 0,
    elapsedMs: 0,
    source: "timeout",
  };
}

export async function readRewardGameSnapshot(
  config: RewardGameConfig,
  chain: RewardGameChain,
  gameId: string,
): Promise<RewardGameSnapshot> {
  const methods = rewardGameMethods(config);
  const raw = await chain.read(methods.getGame, [{ type: "Integer", value: gameId }]);
  const payoutFixed8 = parseBigInt(mapField(raw, "payout"));
  return {
    gameId,
    status: rewardGameStatusOf(mapField(raw, "status")),
    difficulty: Number(parseBigInt(mapField(raw, "difficulty"))),
    commitment: String(mapField(raw, "commitment") ?? ""),
    dealtAt: Number(parseBigInt(mapField(raw, "dealtAt"))),
    deadline: Number(parseBigInt(mapField(raw, "deadline"))),
    payoutFixed8,
    payoutGas: fromFixed8(payoutFixed8),
    solveMs: Number(parseBigInt(mapField(raw, "solveMs"))),
    raw,
  };
}

export async function recoverActiveRewardGame(
  config: RewardGameConfig,
  chain: RewardGameChain,
): Promise<RewardGameRecoverResult> {
  const methods = rewardGameMethods(config);
  const { playerHash } = await rewardGamePlayerHash(chain);
  const gameId = String(parseBigInt(await chain.read(methods.activeGameOf, [
    { type: "Hash160", value: playerHash },
  ])) || "0");
  if (!gameId || gameId === "0") return { gameId: "0", playerHash, snapshot: null };
  return {
    gameId,
    playerHash,
    snapshot: await readRewardGameSnapshot(config, chain, gameId),
  };
}

export async function expireRewardGame<Op extends TeeSessionOp = TeeSessionOp>(
  config: RewardGameConfig,
  chain: RewardGameChain,
  gameId: string,
  storage?: RewardGameStorage<Op>,
): Promise<RewardGameTxResult> {
  const methods = rewardGameMethods(config);
  const tx = await chain.invoke(methods.expireGame, [{ type: "Integer", value: gameId }], {});
  storage?.forget(gameId);
  return tx;
}

export async function withdrawRewardCredit(
  config: RewardGameConfig,
  chain: RewardGameChain,
  creditFixed8?: Fixed8Input,
): Promise<{ skipped: true; reason: "no-credit" } | { skipped: false; tx: RewardGameTxResult }> {
  const methods = rewardGameMethods(config);
  const events = rewardGameEvents(config);
  const player = await chain.ensureWallet();
  const playerHash = addressToScriptHash(player);
  if (!playerHash) throw new RewardGameError("BAD_WALLET", "Wallet address is not a valid Neo address");
  const credit =
    creditFixed8 === undefined
      ? parseBigInt(await chain.read(methods.creditOf, [{ type: "Hash160", value: playerHash }]))
      : fixed8Of(creditFixed8);
  if (credit <= 0n) return { skipped: true, reason: "no-credit" };
  const tx = await chain.invoke(
    methods.withdraw,
    [{ type: "Hash160", value: playerHash }],
    {
      waitForEvent: events.creditWithdrawn,
      waitTimeoutMs: config.waitTimeoutMs?.withdraw ?? 30_000,
    },
  );
  return { skipped: false, tx };
}
