/**
 * app.platformGame — the PlatformGame v2 RewardGame engine surface (Platform
 * Contract Library v2 phase 2, docs/platform-contract-library-v2.md §3.3).
 *
 * PlatformGame is the shared multi-tenant engine that absorbs the TEE
 * skill-game clones (gameType 5). Its ABI is the clone ABI verbatim with
 * appId threaded FIRST — `startGame(appId, player, difficulty)` /
 * `finalizeGame(appId, player, sealedOpLogHex)` / `expireGame(appId, gameId)`
 * / `withdraw(appId, account)` plus reads `freePool / poolBalance /
 * reservedPool / heldForApp / creditOf / activeGameOf / statsOf / getGame`
 * (pinned against contracts/platform/PlatformGame/PlatformGame.RewardGame*.cs
 * and contracts/build/PlatformGame.manifest.json). This surface is the
 * app-side of that grammar (§6 item 4, the app.credits exemplar): it
 * AUTO-THREADS the host appId into every call and auto-targets the injected
 * engine hash, so app code never passes an appId or hardcodes a script hash.
 *
 * Economics note: the engine draws the entry from the player's PREPAID
 * per-app credit (`<appId>:entry` GAS deposits), so `startGame` here is a
 * PLAIN invoke — no payment is carried (unlike the clone lane's
 * invokeWithPayment). Settlement stays kernel-verified: `finalizeGame` only
 * SUBMITS the sealed op-log (the engine forwards it to the Morpheus session
 * kernel and answers with the `Finalizing` ack); apps observe the outcome by
 * polling {@link FrameworkPlatformGameSurface.getGame} until the status
 * settles. `withdraw` is the pause-immune pull-payment exit for the credit
 * balance (unused entries + won payouts).
 *
 * Guards: every write lane goes through the RFC P0-2 guarded-write stanza —
 * guest guard first, then the S11 "invoke:primary" manifest gate (the same
 * named WRITE_PRIMARY policy as app.chain.invoke and the app.game.reward
 * broadcast lanes; a per-engine permission vocabulary is the design doc's
 * open question 6, deliberately NOT invented here). Reads stay ungated like
 * every other framework read lane, so guest-mode upsell UI can still quote
 * the pool.
 *
 * Config comes from `MiniAppFrameworkOptions.platformGame` (platform config
 * pattern, like `credits` / `registry`): the app layer injects the network's
 * deployed PlatformGame hash. Absent/invalid ⇒ every method throws a typed
 * {@link FrameworkCapabilityError} (capability "platformGame") so engine-aware
 * UI degrades away cleanly on hosts without the engine — branch on
 * `platformGame.available`.
 */

import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { mapField, rewardGameStatusOf } from "./gamefi/reward-game-sdk";
import type { RewardGameStatus } from "./gamefi/reward-game-sdk";
import { WRITE_PRIMARY, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { eventStateValue } from "./utils/chain-events";
import { parseHash160 } from "./utils/neo";
import { parseBigInt } from "./utils/parsers";

// ─── config + result types ──────────────────────────────────────────────────

/**
 * Platform-injected PlatformGame engine config
 * (`MiniAppFrameworkOptions.platformGame`). Absent or invalid ⇒ every surface
 * method throws a typed {@link FrameworkCapabilityError} naming what is
 * missing. The method/event names are NOT configurable: they are the
 * registry-pinned engine ABI (additive-only post-registration per the design
 * doc's ABI stability policy, so a divergence means a new engine row, not a
 * client-side rename — the per-app `config.methods` escape valve stays with
 * the clone lane in reward-game-sdk).
 */
export interface FrameworkPlatformGameConfig {
  /** Deployed PlatformGame contract hash for the network ("0x" + 40 hex). */
  gameHash: string;
  /** Per-lane event-wait deadlines in ms (defaults 30_000). */
  waitTimeoutMs?: {
    /** Deadline for the GameStarted wait inside {@link FrameworkPlatformGameSurface.startGame}. */
    start?: number;
    /** Deadline for the Finalizing ack wait inside {@link FrameworkPlatformGameSurface.finalizeGame}. */
    finalize?: number;
    /** Deadline for the CreditWithdrawn wait inside {@link FrameworkPlatformGameSurface.withdraw}. */
    withdraw?: number;
  };
}

/** One broadcast the engine accepted (the host chain lane's tx result). */
export interface FrameworkPlatformGameTx {
  /** Txid of the broadcast transaction. */
  txid: string;
  /** The awaited engine event when the host observed it (else undefined). */
  event?: unknown;
  /** VM success flag when the host reports one. */
  success?: boolean;
}

export interface FrameworkPlatformGameStartResult {
  /** The startGame broadcast. */
  tx: FrameworkPlatformGameTx;
  /**
   * The new game id (decimal string) — decoded from the GameStarted event
   * (slot 1; appId sits in slot 0 of every engine event), falling back to an
   * `activeGameOf` read on hosts that do not deliver invoke events.
   */
  gameId: string;
  /** The player argument as passed (Neo address or Hash160). */
  player: string;
  /** The normalized display-order `0x` player hash the engine witnessed. */
  playerHash: string;
}

export interface FrameworkPlatformGameFinalizeResult {
  /** The finalizeGame broadcast. */
  tx: FrameworkPlatformGameTx;
  /**
   * The Morpheus kernel request id (decimal string) from the Finalizing ack
   * (slot 3), or "" when the host did not observe the event — settlement is
   * then tracked by polling {@link FrameworkPlatformGameSurface.getGame}.
   */
  requestId: string;
}

/**
 * `withdraw` outcome: a `{ skipped: true, reason: "no-credit" }` short-circuit
 * when the credit read is zero (saves a doomed broadcast — the engine asserts
 * `credit > 0`), else the broadcast plus the withdrawn amount decoded from
 * the CreditWithdrawn event (0n when unobserved).
 */
export type FrameworkPlatformGameWithdrawResult =
  | { skipped: true; reason: "no-credit" }
  | { skipped: false; tx: FrameworkPlatformGameTx; amountFixed8: bigint };

/** The engine's `statsOf` row: lifetime play counters for one player. */
export interface FrameworkPlatformGameStats {
  /** Games started (settled or not). */
  played: number;
  /** Games settled with a non-zero payout. */
  solved: number;
  /** Lifetime winnings in GAS fixed8 base units. */
  totalWonFixed8: bigint;
}

/**
 * The engine's `getGame` row, typed. `status` is decoded into the
 * reward-game-sdk vocabulary via its `rewardGameStatusOf` (shared decode, no
 * fork); the engine-only intermediate state 5 (settling — finalize submitted,
 * kernel callback pending) maps to "unknown" there, so the raw `statusCode`
 * (1 in play, 2 settled, 3 expired, 4 refunded, 5 settling) is carried along
 * losslessly.
 */
export interface FrameworkPlatformGameSnapshot {
  /** The game id (decimal string). */
  gameId: string;
  /** Raw engine status code (1 in play, 2 settled, 3 expired, 4 refunded, 5 settling). */
  statusCode: number;
  /** SDK-vocabulary status decode (5 "settling" reads as "unknown" — use statusCode to distinguish). */
  status: RewardGameStatus;
  /** The game's player, display-order `0x` hash ("" when undecodable). */
  player: string;
  /** Difficulty tier (0..2). */
  difficulty: number;
  /** Entry paid in, GAS fixed8 base units. */
  entryFixed8: bigint;
  /** Base reward reserved for this game, GAS fixed8 base units. */
  rewardFixed8: bigint;
  /** Wall-clock ms the game started. */
  startTime: number;
  /** sha256 of the TEE problem canonical, lowercase hex ("" until settled). */
  commitment: string;
  /** Wall-clock ms the puzzle was dealt. */
  dealtAt: number;
  /** Wall-clock ms deadline (plus the app's settle grace bounds expiry). */
  deadline: number;
  /** TEE-tracked undo count recorded at settlement. */
  undos: number;
  /** Settled payout, GAS fixed8 base units (0n until settled / on failure). */
  payoutFixed8: bigint;
  /** TEE-attested solve time in ms (0 until settled). */
  solveMs: number;
  /** sha256 of the canonical answer, lowercase hex ("" until settled). */
  answerHash: string;
  /** TEE-attested achievement metric (exposed by the engine under the clone key "ringsHit"). */
  score: number;
  /** The undecoded chain row, for forward-compat with additive engine fields. */
  raw: unknown;
}

// ─── surface + deps ─────────────────────────────────────────────────────────

/** Chain lane the platform-game surface consumes (subset of the host service). */
export interface PlatformGameSurfaceChain {
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
    options?: { scriptHash?: string; waitForEvent?: string; waitTimeoutMs?: number },
  ): Promise<FrameworkPlatformGameTx>;
}

export interface PlatformGameSurfaceDeps {
  /** Host app id — the appId every call auto-threads first (§6 item 4). */
  appId: string;
  chain: PlatformGameSurfaceChain;
  /** Guest guard + S11 gate shared with every other framework write lane. */
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformGameConfig;
}

export interface FrameworkPlatformGameSurface {
  /** True when the host injected a valid platformGame config. */
  readonly available: boolean;
  /**
   * Start a skill-game challenge for `player` (Neo address or Hash160 — the
   * connected wallet in practice) at `difficulty` (0..2). Consumes the entry
   * from the player's prepaid engine credit and reserves the base reward —
   * NO payment rides along (fund credit first via an `<appId>:entry` GAS
   * transfer). Guest guard + S11 "invoke:primary".
   */
  startGame(player: string, difficulty: number): Promise<FrameworkPlatformGameStartResult>;
  /**
   * Submit the sealed TEE op-log of `player`'s active game to the Morpheus
   * kernel for settlement (one request per game; the engine locates the game
   * through the player's active-game pointer). `sealedOpLogHex` must be
   * non-empty even-length lowercase hex (the engine's codec contract).
   * Guest guard + S11 "invoke:primary".
   */
  finalizeGame(
    player: string,
    sealedOpLogHex: string,
  ): Promise<FrameworkPlatformGameFinalizeResult>;
  /**
   * Close a game that can no longer settle (active/settling past deadline +
   * settle grace), releasing its reservation. Permissionless on-chain — the
   * surface still runs the standard write stanza (guest guard + S11
   * "invoke:primary") like every other framework broadcast lane.
   */
  expireGame(gameId: string | number | bigint): Promise<FrameworkPlatformGameTx>;
  /**
   * Reclaim the connected wallet's whole engine credit (unused entries + won
   * payouts) — the pause-immune pull-payment exit. Skips the broadcast when
   * the credit read is zero. Guest guard + S11 "invoke:primary".
   */
  withdraw(): Promise<FrameworkPlatformGameWithdrawResult>;
  /** Pool not reserved by active games, GAS fixed8 base units. */
  freePool(appId?: string): Promise<bigint>;
  /** Whole reward pool (includes entries paid in), GAS fixed8 base units. */
  poolBalance(appId?: string): Promise<bigint>;
  /** Base rewards held by active games, GAS fixed8 base units. */
  reservedPool(appId?: string): Promise<bigint>;
  /**
   * The per-app liability counter (GAS the engine custodies for the tenant).
   * Invariant: `heldForApp == freePool + reservedPool + Σcredits`.
   */
  heldForApp(appId?: string): Promise<bigint>;
  /** The player's pull-payment credit (prepaid entries + won payouts), fixed8. */
  creditOf(player?: string, appId?: string): Promise<bigint>;
  /** The player's unfinished game id (decimal string), "0" when none. */
  activeGameOf(player?: string, appId?: string): Promise<string>;
  /** The player's lifetime stats row (zeros for an unknown player). */
  statsOf(player?: string, appId?: string): Promise<FrameworkPlatformGameStats>;
  /**
   * Full game record; resolves `null` for an unknown game id (the engine's
   * getGame asserts, which hosts surface as a null read or, on hosts that
   * throw on FAULT reads, as a rejection).
   */
  getGame(
    gameId: string | number | bigint,
    appId?: string,
  ): Promise<FrameworkPlatformGameSnapshot | null>;
}

// ─── internals ──────────────────────────────────────────────────────────────

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const SEALED_OP_LOG_RE = /^([0-9a-f]{2})+$/;

// The engine event vocabulary (appId always in slot 0 — every slot index is
// the clone lane's index + 1).
const EVENT_GAME_STARTED = "GameStarted";
const EVENT_FINALIZING = "Finalizing";
const EVENT_CREDIT_WITHDRAWN = "CreditWithdrawn";
const GAME_STARTED_GAME_ID_SLOT = 1; // GameStarted(appId, gameId, …)
const FINALIZING_REQUEST_ID_SLOT = 3; // Finalizing(appId, gameId, player, requestId)
const CREDIT_WITHDRAWN_AMOUNT_SLOT = 2; // CreditWithdrawn(appId, account, amount)

const WAIT_TIMEOUT_MS_DEFAULT = 30_000;

/** Positive-integer gameId normalization (decimal string for the Integer arg). */
function normalizeGameId(gameId: string | number | bigint, what: string): string {
  const id = parseBigInt(gameId);
  if (id <= 0n) throw new Error(`${what} must be a positive integer game id`);
  return id.toString();
}

/** getGame row decode; null for a FAULTed (unknown gameId) read. */
function decodeGameSnapshot(raw: unknown, gameId: string): FrameworkPlatformGameSnapshot | null {
  if (raw === null || raw === undefined) return null;
  const statusCode = Number(parseBigInt(mapField(raw, "status")));
  return {
    gameId,
    statusCode,
    status: rewardGameStatusOf(statusCode),
    player: parseHash160(mapField(raw, "player")),
    difficulty: Number(parseBigInt(mapField(raw, "difficulty"))),
    entryFixed8: parseBigInt(mapField(raw, "entry")),
    rewardFixed8: parseBigInt(mapField(raw, "reward")),
    startTime: Number(parseBigInt(mapField(raw, "startTime"))),
    commitment: String(mapField(raw, "commitment") ?? ""),
    dealtAt: Number(parseBigInt(mapField(raw, "dealtAt"))),
    deadline: Number(parseBigInt(mapField(raw, "deadline"))),
    undos: Number(parseBigInt(mapField(raw, "undos"))),
    payoutFixed8: parseBigInt(mapField(raw, "payout")),
    solveMs: Number(parseBigInt(mapField(raw, "solveMs"))),
    answerHash: String(mapField(raw, "answerHash") ?? ""),
    score: Number(parseBigInt(mapField(raw, "ringsHit"))),
    raw,
  };
}

// ─── factory ────────────────────────────────────────────────────────────────

export function createPlatformGameSurface(
  deps: PlatformGameSurfaceDeps,
): FrameworkPlatformGameSurface {
  const { chain } = deps;
  const config = deps.config;

  const isConfigValid = Boolean(
    config && HASH160_RE.test(String(config.gameHash ?? "").trim()),
  );

  const requireConfig = (): FrameworkPlatformGameConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "platformGame",
        "Platform game engine is not configured on this host — set MiniAppFrameworkOptions.platformGame " +
          "(the network's deployed PlatformGame gameHash)",
      );
    }
    if (!HASH160_RE.test(String(config.gameHash ?? "").trim())) {
      throw new FrameworkCapabilityError(
        "platformGame",
        "platformGame config is missing a valid gameHash (0x + 40 hex chars of the deployed PlatformGame contract)",
      );
    }
    return config;
  };

  const gameHashOf = (cfg: FrameworkPlatformGameConfig): string =>
    String(cfg.gameHash).trim().toLowerCase();

  /** One engine read, auto-targeted at the configured contract (§6 item 4). */
  const read = (
    operation: string,
    args: Array<{ type: string; value: unknown }> = [],
  ): Promise<unknown> => {
    const cfg = requireConfig();
    return chain.read(operation, args, { scriptHash: gameHashOf(cfg) });
  };

  const readFixed8 = async (
    operation: string,
    args: Array<{ type: string; value: unknown }>,
  ): Promise<bigint> => parseBigInt(await read(operation, args));

  /** The auto-threaded tenant key: the host appId unless overridden (reads). */
  const resolveAppId = (appId?: string): string => {
    const resolved = String(appId ?? deps.appId ?? "").trim();
    if (!resolved) {
      throw new Error("appId is required (no host app id and none passed)");
    }
    return resolved;
  };

  /** Neo address or Hash160 argument, defaulting to the connected wallet. */
  const resolvePlayer = (player?: string): string => {
    const raw = String(player ?? "").trim();
    if (raw) return accountToHash160(raw);
    const connected = String(chain.address.get() ?? "").trim();
    if (!connected) {
      throw new Error("player is required (no wallet connected and none passed)");
    }
    return accountToHash160(connected);
  };

  const startGame = guardedWrite(
    deps.guards,
    WRITE_PRIMARY,
    async (player: string, difficulty: number): Promise<FrameworkPlatformGameStartResult> => {
      const cfg = requireConfig();
      const playerHash = accountToHash160(player);
      const normalized = Number(difficulty);
      if (!Number.isInteger(normalized) || normalized < 0) {
        throw new Error("difficulty must be a non-negative integer");
      }
      const appId = resolveAppId();
      const tx = await chain.invoke(
        "startGame",
        [
          { type: "String", value: appId },
          { type: "Hash160", value: playerHash },
          { type: "Integer", value: String(normalized) },
        ],
        {
          scriptHash: gameHashOf(cfg),
          waitForEvent: EVENT_GAME_STARTED,
          waitTimeoutMs: cfg.waitTimeoutMs?.start ?? WAIT_TIMEOUT_MS_DEFAULT,
        },
      );

      let gameId = tx.event != null
        ? String(parseBigInt(eventStateValue(tx.event, GAME_STARTED_GAME_ID_SLOT)) || "")
        : "";
      if (!gameId || gameId === "0") {
        // Hosts without an invoke-event lane: the active-game pointer is the
        // same truth the event carries (startGame marks the game active).
        gameId = String(
          parseBigInt(
            await chain.read(
              "activeGameOf",
              [
                { type: "String", value: appId },
                { type: "Hash160", value: playerHash },
              ],
              { scriptHash: gameHashOf(cfg) },
            ),
          ) || "0",
        );
      }
      if (!gameId || gameId === "0") {
        throw new Error("Game start transaction did not expose an active game id");
      }
      return { tx, gameId, player, playerHash };
    },
  );

  const finalizeGame = guardedWrite(
    deps.guards,
    WRITE_PRIMARY,
    async (
      player: string,
      sealedOpLogHex: string,
    ): Promise<FrameworkPlatformGameFinalizeResult> => {
      const cfg = requireConfig();
      const playerHash = accountToHash160(player);
      const sealed = String(sealedOpLogHex ?? "").trim();
      if (!SEALED_OP_LOG_RE.test(sealed)) {
        throw new Error("sealedOpLogHex must be non-empty even-length lowercase hex");
      }
      const tx = await chain.invoke(
        "finalizeGame",
        [
          { type: "String", value: resolveAppId() },
          { type: "Hash160", value: playerHash },
          { type: "String", value: sealed },
        ],
        {
          scriptHash: gameHashOf(cfg),
          waitForEvent: EVENT_FINALIZING,
          waitTimeoutMs: cfg.waitTimeoutMs?.finalize ?? WAIT_TIMEOUT_MS_DEFAULT,
        },
      );
      const requestId = tx.event != null
        ? String(parseBigInt(eventStateValue(tx.event, FINALIZING_REQUEST_ID_SLOT)) || "")
        : "";
      return { tx, requestId };
    },
  );

  const expireGame = guardedWrite(
    deps.guards,
    WRITE_PRIMARY,
    async (gameId: string | number | bigint): Promise<FrameworkPlatformGameTx> => {
      const cfg = requireConfig();
      return chain.invoke(
        "expireGame",
        [
          { type: "String", value: resolveAppId() },
          { type: "Integer", value: normalizeGameId(gameId, "expireGame") },
        ],
        { scriptHash: gameHashOf(cfg) },
      );
    },
  );

  const withdraw = guardedWrite(
    deps.guards,
    WRITE_PRIMARY,
    async (): Promise<FrameworkPlatformGameWithdrawResult> => {
      const cfg = requireConfig();
      const appId = resolveAppId();
      const account = chain.address.get() || (await chain.ensureWallet());
      const accountHash = accountToHash160(account);
      // Skip the doomed broadcast: the engine asserts credit > 0, so a zero
      // balance would only buy a FAULT (same no-credit lane as the clone SDK).
      const credit = parseBigInt(
        await chain.read(
          "creditOf",
          [
            { type: "String", value: appId },
            { type: "Hash160", value: accountHash },
          ],
          { scriptHash: gameHashOf(cfg) },
        ),
      );
      if (credit <= 0n) return { skipped: true, reason: "no-credit" };
      const tx = await chain.invoke(
        "withdraw",
        [
          { type: "String", value: appId },
          { type: "Hash160", value: accountHash },
        ],
        {
          scriptHash: gameHashOf(cfg),
          waitForEvent: EVENT_CREDIT_WITHDRAWN,
          waitTimeoutMs: cfg.waitTimeoutMs?.withdraw ?? WAIT_TIMEOUT_MS_DEFAULT,
        },
      );
      const amountFixed8 = tx.event != null
        ? parseBigInt(eventStateValue(tx.event, CREDIT_WITHDRAWN_AMOUNT_SLOT))
        : 0n;
      return { skipped: false, tx, amountFixed8 };
    },
  );

  return {
    get available(): boolean {
      return isConfigValid;
    },
    startGame,
    finalizeGame,
    expireGame,
    withdraw,
    // Read members are `async` so argument/config denials REJECT (never
    // throw synchronously) — the same lane semantics as app.registry.
    freePool: async (appId?: string) =>
      readFixed8("freePool", [{ type: "String", value: resolveAppId(appId) }]),
    poolBalance: async (appId?: string) =>
      readFixed8("poolBalance", [{ type: "String", value: resolveAppId(appId) }]),
    reservedPool: async (appId?: string) =>
      readFixed8("reservedPool", [{ type: "String", value: resolveAppId(appId) }]),
    heldForApp: async (appId?: string) =>
      readFixed8("heldForApp", [{ type: "String", value: resolveAppId(appId) }]),
    creditOf: async (player?: string, appId?: string) =>
      readFixed8("creditOf", [
        { type: "String", value: resolveAppId(appId) },
        { type: "Hash160", value: resolvePlayer(player) },
      ]),
    activeGameOf: async (player?: string, appId?: string) =>
      String(
        parseBigInt(
          await read("activeGameOf", [
            { type: "String", value: resolveAppId(appId) },
            { type: "Hash160", value: resolvePlayer(player) },
          ]),
        ) || "0",
      ),
    statsOf: async (player?: string, appId?: string): Promise<FrameworkPlatformGameStats> => {
      const raw = await read("statsOf", [
        { type: "String", value: resolveAppId(appId) },
        { type: "Hash160", value: resolvePlayer(player) },
      ]);
      return {
        played: Number(parseBigInt(mapField(raw, "played"))),
        solved: Number(parseBigInt(mapField(raw, "solved"))),
        totalWonFixed8: parseBigInt(mapField(raw, "totalWon")),
      };
    },
    getGame: async (gameId: string | number | bigint, appId?: string) => {
      const id = normalizeGameId(gameId, "getGame");
      const raw = await read("getGame", [
        { type: "String", value: resolveAppId(appId) },
        { type: "Integer", value: id },
      ]);
      return decodeGameSnapshot(raw, id);
    },
  };
}
