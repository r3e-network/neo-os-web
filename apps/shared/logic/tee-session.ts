/**
 * Generic Morpheus confidential-session client — the ONE client that every
 * migrated game (sudoku, game-2048, flappy-dash, snake-bounty, aim-master,
 * color-clash, merge-kingdom, pet-potion) uses to talk to the GENERIC oracle
 * session host. It replaces the bespoke per-game `/api/morpheus/game/*` clients.
 *
 * TRUST-SURFACE SPLIT (see GENERIC_ORACLE_MIGRATION.md §Trust-surface split):
 *   - The interactive loop (`teeSessionStart` / `teeSessionStep`) is a DIRECT
 *     enclave session on the generic `/api/morpheus/session/{start,step}` routes,
 *     parameterized by (app_id, engine_hash). It has NO on-chain effect and
 *     preserves reveal-per-move + real-time timing fully. The engine to run is
 *     picked by the worker from its operator-whitelisted (appId, engineHash)
 *     registry; the client only supplies the identity + the whitelisted hash.
 *   - Terminal settlement is a SINGLE kernel request. The client seals the
 *     accumulated op-log to the oracle public key (identical envelope to
 *     private-transfer) with `teeSessionSealOpLog`, then the game dispatches a
 *     `finalizeGame` action that calls the contract `FinalizeGame(gameId,
 *     sealedOpLogHex)`. The contract turns that into
 *     `SubmitMiniAppRequestFromIntegration(...,'game.session','session.finalize',
 *     sealedOpLog)`; the worker's `/session/finalize` re-derives the score via
 *     `engine.replay(problemSecret, opLog)` and the kernel credits the payout
 *     through `onMiniAppResult`. Settlement is therefore observed ON-CHAIN
 *     (GetGame status / the Solved-event leaderboard poll), never trusted from
 *     the enclave's own score signature.
 *
 * The `op` on every step and in the op-log is a GENERIC `{ type, ... }` object
 * validated by the engine (per-game constants live in the engine descriptor).
 * Each game keeps only a thin typed op union that structurally matches this.
 */
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { encryptJsonWithOraclePublicKey } from "@shared/utils/morpheus-confidential-envelope";

/** Base path of the generic Morpheus session routes (platform-proxied). */
const SESSION_BASE = "/api/morpheus/session";
/** Oracle public-key endpoint used to seal the finalize op-log payload. */
const ORACLE_PUBLIC_KEY_PATH = "/api/morpheus/oracle/public-key";
const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";

/**
 * A generic session op. Every op is a plain `{ type, ... }` object the engine
 * validates; the extra fields are per-game (e.g. `dir`, `color`, `cell`). Undo
 * is the one op the generic host understands directly (`{ type: "undo" }`).
 */
export type TeeSessionOp = { type: string } & Record<string, unknown>;

/**
 * The identity + engine pin that keys a confidential session. `engineHash` is
 * the operator-whitelisted sha-256 of the app's reviewed engine wrapper; the
 * worker rejects a request whose supplied hash does not match its manifest.
 */
export interface TeeIdentity {
  appId: string;
  engineHash: string;
  network: "testnet" | "mainnet";
  contractHash: string;
  gameId: string;
  player: string;
  difficulty: number;
}

/** The static session config the start route returns (from the engine descriptor). */
export interface TeeSessionConfig {
  limitMs: number;
  minSolveMs: number;
  maxUndos: number;
  revealPolicy: string;
  /** The per-difficulty score target (present only for engines that surface one). */
  target?: number;
  raw: Record<string, unknown>;
}

/** The result of opening a confidential session (`/session/start`). */
export interface TeeStartResult {
  /** sha-256 commitment of the enclave problem canonical (32 bytes hex). */
  commitment: string;
  /** The enclave signing public key (informational; NOT a settlement authority). */
  publicKey: string;
  /** The session token gating step/finalize for this identity. */
  sessionToken: string;
  /** The start view, disclosing only what the engine's revealPolicy permits. */
  view: Record<string, unknown>;
  config: TeeSessionConfig;
}

/** The flat per-step response (`/session/step`): engine view fields at top level. */
export interface TeeStepResult {
  seq: number;
  opCount: number;
  resumed: boolean;
  view: Record<string, unknown>;
}

/** The sealed op-log ready to hand to the contract's FinalizeGame. */
export interface TeeSealedOpLog {
  /** Lowercase hex of the ciphertext envelope — the `sealedOpLogHex` arg. */
  sealedOpLogHex: string;
}

/** The enclave's own decode of the finalize result (optimistic UI only). */
export interface TeeFinalizePreview {
  problemHash: string;
  answerHash: string;
  elapsedMs: number;
  undos: number;
  score: number;
  difficulty: number;
  /** Any per-game score field the engine surfaces (e.g. pipes_passed, tile_achieved). */
  scoreField: Record<string, unknown>;
}

export type TeeSessionPhase = "start" | "step" | "seal" | "finalize";

export class TeeSessionError extends Error {
  readonly phase: TeeSessionPhase;
  readonly status: number;

  constructor(phase: TeeSessionPhase, status: number, message: string) {
    super(message);
    this.name = "TeeSessionError";
    this.phase = phase;
    this.status = status;
  }
}

function formatSessionError(status: number, parsed: Record<string, unknown>) {
  const detail = String(parsed.message ?? parsed.detail ?? "").trim();
  const code = String(parsed.error ?? "").trim();
  if (detail && code && detail !== code) return `${detail} (${code})`;
  if (detail) return detail;
  if (code) return code;
  return String(status);
}

/** Map the wallet-detected network id onto the session host's network name. */
export function morpheusNetworkOf(detected: string): "testnet" | "mainnet" {
  return String(detected || "").toLowerCase().includes("mainnet") ? "mainnet" : "testnet";
}

function identityBody(identity: TeeIdentity): Record<string, unknown> {
  return {
    app_id: identity.appId,
    engine_hash: identity.engineHash,
    network: identity.network,
    contract_hash: identity.contractHash,
    game_id: identity.gameId,
    player: identity.player,
    difficulty: identity.difficulty,
  };
}

async function postSession(
  phase: TeeSessionPhase,
  route: string,
  body: Record<string, unknown>,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = fetcher === globalThis.fetch
      ? await fetchWithTimeout(`${SESSION_BASE}/${route}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetcher(`${SESSION_BASE}/${route}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "session request failed");
    throw new TeeSessionError(phase, 0, message);
  }
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const reason = formatSessionError(response.status, parsed);
    throw new TeeSessionError(phase, response.status, reason);
  }
  return parsed;
}

function parseConfig(raw: unknown): TeeSessionConfig {
  const cfg = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // The engine descriptor's startConfigKey is dynamic (target_exp, target_pipes,
  // target_seq, …). Surface whichever `target_*` value the host returned.
  let target: number | undefined;
  for (const [key, value] of Object.entries(cfg)) {
    if (key.startsWith("target_")) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) target = numeric;
    }
  }
  return {
    limitMs: Number(cfg.limit_ms ?? 0),
    minSolveMs: Number(cfg.min_solve_ms ?? 0),
    maxUndos: Number(cfg.max_undos ?? 0),
    revealPolicy: String(cfg.reveal_policy ?? ""),
    target,
    raw: cfg,
  };
}

/**
 * Open (or idempotently re-open) a confidential session. `start` is a pure
 * function of the enclave problem secret, so repeated calls for the same
 * identity return the same commitment / start view — reloads never lose the
 * puzzle. NO on-chain effect.
 */
export async function teeSessionStart(
  identity: TeeIdentity,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<TeeStartResult> {
  const raw = await postSession("start", "start", identityBody(identity), fetcher);
  const commitment = String(raw.commitment ?? "");
  const sessionToken = String(raw.session_token ?? "");
  if (!/^[0-9a-f]{64}$/i.test(commitment)) {
    throw new TeeSessionError("start", 200, "session start returned a malformed commitment");
  }
  if (!sessionToken) {
    throw new TeeSessionError("start", 200, "session start returned no session token");
  }
  return {
    commitment,
    publicKey: String(raw.public_key ?? ""),
    sessionToken,
    view: (raw.view && typeof raw.view === "object" ? raw.view : {}) as Record<string, unknown>,
    config: parseConfig(raw.config),
  };
}

/**
 * Apply one op to the live session. The response spreads the engine's view
 * fields at the top level (per-move reveal, updated board, live stats, …); this
 * normalizes it into `{ seq, opCount, resumed, view }`. Pass `replay` (the full
 * accepted op-log so far) so a worker restart / cache eviction can rebuild the
 * session deterministically.
 */
export async function teeSessionStep(
  identity: TeeIdentity,
  sessionToken: string,
  seq: number,
  op: TeeSessionOp,
  replay?: TeeSessionOp[],
  fetcher: typeof fetch = globalThis.fetch,
): Promise<TeeStepResult> {
  const raw = await postSession(
    "step",
    "step",
    {
      ...identityBody(identity),
      session_token: sessionToken,
      seq,
      op,
      ...(replay ? { replay } : {}),
    },
    fetcher,
  );
  const { seq: _seq, op_count: opCount, resumed, ...view } = raw as Record<string, unknown>;
  return {
    seq: Number(raw.seq ?? seq),
    opCount: Number(opCount ?? 0),
    resumed: resumed === true,
    view,
  };
}

/**
 * Build the sealed op-log payload for terminal settlement. The op-log fully
 * determines the score via `engine.replay`, so the kernel re-derivation is
 * reproducible. The payload is sealed to the oracle public key with the SAME
 * confidential envelope private-transfer uses (X25519-HKDF-SHA256-AES-256-GCM),
 * then hex-encoded so it can cross the contract ABI as the `sealedOpLogHex`
 * string argument of `FinalizeGame(gameId, sealedOpLogHex)`.
 */
export async function teeSessionSealOpLog(
  identity: TeeIdentity,
  opLog: TeeSessionOp[],
  fetcher: typeof fetch = globalThis.fetch,
): Promise<TeeSealedOpLog> {
  let keyBody: Record<string, unknown>;
  try {
    const response = fetcher === globalThis.fetch
      ? await fetchWithTimeout(
          `${ORACLE_PUBLIC_KEY_PATH}?network=${encodeURIComponent(identity.network)}`,
          { headers: { accept: "application/json" } },
        )
      : await fetcher(
          `${ORACLE_PUBLIC_KEY_PATH}?network=${encodeURIComponent(identity.network)}`,
          { headers: { accept: "application/json" } },
        );
    keyBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || !keyBody.public_key) {
      throw new Error(String(keyBody.error ?? "Morpheus oracle public key is unavailable"));
    }
    if (keyBody.algorithm && keyBody.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM) {
      throw new Error(`Unsupported Morpheus encryption algorithm: ${keyBody.algorithm}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "seal key fetch failed");
    throw new TeeSessionError("seal", 0, message);
  }

  const payload = {
    kind: "miniapp.game.session.finalize.v1",
    app_id: identity.appId,
    engine_hash: identity.engineHash,
    target_chain: "neo_n3",
    network: identity.network,
    contract_hash: identity.contractHash,
    game_id: identity.gameId,
    player: identity.player,
    difficulty: identity.difficulty,
    op_log: opLog,
  };

  try {
    const ciphertext = await encryptJsonWithOraclePublicKey(String(keyBody.public_key), payload);
    return { sealedOpLogHex: base64ToHex(ciphertext) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "seal failed");
    throw new TeeSessionError("seal", 0, message);
  }
}

/**
 * Optimistic finalize preview: call `/session/finalize` directly so the UI can
 * show the enclave's derived score BEFORE the on-chain settlement lands. This is
 * NEVER the settlement authority — the contract's onMiniAppResult (kernel
 * verified) is. Pass `replay` (the sealed op-log's plain ops) so the enclave can
 * rebuild a session it may have evicted.
 */
export async function teeSessionFinalizePreview(
  identity: TeeIdentity,
  sessionToken: string,
  replay: TeeSessionOp[],
  answer?: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<TeeFinalizePreview> {
  const raw = await postSession(
    "finalize",
    "finalize",
    {
      ...identityBody(identity),
      session_token: sessionToken,
      replay,
      ...(answer !== undefined ? { answer } : {}),
    },
    fetcher,
  );
  const {
    problem_hash,
    answer_hash,
    elapsed_ms,
    undos,
    score,
    difficulty,
    result_bytes_base64: _rb,
    callback_encoding: _ce,
    public_key: _pk,
    output_hash: _oh,
    signature: _sig,
    verification: _v,
    ...scoreField
  } = raw as Record<string, unknown>;
  return {
    problemHash: String(problem_hash ?? ""),
    answerHash: String(answer_hash ?? ""),
    elapsedMs: Number(elapsed_ms ?? 0),
    undos: Number(undos ?? 0),
    score: Number(score ?? 0),
    difficulty: Number(difficulty ?? identity.difficulty),
    scoreField,
  };
}

/** Lowercase-hex encode a base64 string (for the contract's HexToBytes reader). */
function base64ToHex(base64: string): string {
  const binary = globalThis.atob(String(base64 || ""));
  let out = "";
  for (let index = 0; index < binary.length; index += 1) {
    out += binary.charCodeAt(index).toString(16).padStart(2, "0");
  }
  return out;
}
