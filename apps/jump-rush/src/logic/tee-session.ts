import type { Platform } from "./jump-engine";
import { ruleOf } from "./game-rules";

/**
 * Client for the Morpheus TEE game-session service (miniapp-jump-rush).
 *
 * The platform layout is generated INSIDE the enclave. The client receives the
 * authoritative x/width/gap objects needed to render and replay each jump,
 * while the solution stays in the TEE.
 * `start` is deterministic and idempotent — recalling it for the same
 * (app, network, contract, game, player, difficulty) identity rebuilds the
 * same session, so reloads never lose the layout. Jumps stream to the TEE for
 * telemetry + undo accounting; `finalize` verifies the jump sequence inside
 * the enclave and returns the settlement signature the contract checks.
 */
export interface TeeIdentity {
  appId: string;
  network: "testnet" | "mainnet";
  contractHash: string;
  gameId: string;
  player: string;
  difficulty: number;
}

export interface TeeStartResult {
  commitment: string;
  bindSignature: string;
  publicKey: string;
  sessionToken: string;
  view: { platforms: Platform[] };
}

export interface TeeSettlement {
  problemHash: string;
  answerHash: string;
  elapsedMs: number;
  undos: number;
  settleSignature: string;
}

export type TeeOp =
  | { type: "jump"; chargeLevel: number }
  | { type: "undo" };

const HEX_32 = /^[0-9a-f]{64}$/i;
const HEX_64 = /^[0-9a-f]{128}$/i;

function validOpaque(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

function parsePlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return [];
  const parsed: Platform[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const x = Number(raw.x);
    const width = Number(raw.width);
    const gap = Number(raw.gap);
    if (!Number.isFinite(x) || !Number.isFinite(width) || !Number.isFinite(gap)) return [];
    if (x < 0 || width <= 0 || gap < 0) return [];
    parsed.push({ x, width, gap });
  }
  return parsed;
}

function identityBody(identity: TeeIdentity): Record<string, unknown> {
  return {
    app_id: identity.appId,
    network: identity.network,
    contract_hash: identity.contractHash,
    game_id: identity.gameId,
    player: identity.player,
    difficulty: identity.difficulty,
  };
}

function formatTeeError(status: number, parsed: Record<string, unknown>) {
  const detail = String(parsed.message ?? parsed.detail ?? "").trim();
  const code = String(parsed.error ?? "").trim();
  if (detail && code && detail !== code) return `${detail} (${code})`;
  if (detail) return detail;
  if (code) return code;
  return String(status);
}

async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/morpheus/game/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const reason = formatTeeError(response.status, parsed);
    throw new Error(`tee ${path} failed: ${reason}`);
  }
  return parsed;
}

export async function teeStart(identity: TeeIdentity): Promise<TeeStartResult> {
  const raw = await post("start", identityBody(identity));
  const view = (raw.view ?? {}) as Record<string, unknown>;
  const platforms = parsePlatforms(view.platforms);
  const result: TeeStartResult = {
    commitment: String(raw.commitment ?? ""),
    bindSignature: String(raw.bind_signature ?? ""),
    publicKey: String(raw.public_key ?? ""),
    sessionToken: String(raw.session_token ?? ""),
    view: { platforms },
  };
  if (!HEX_32.test(result.commitment) || !HEX_64.test(result.bindSignature)) {
    throw new Error("tee start returned a malformed commitment envelope");
  }
  if (!validOpaque(result.publicKey, 16, 1024) || !validOpaque(result.sessionToken, 16, 4096)) {
    throw new Error("tee start returned malformed session credentials");
  }
  if (platforms.length < ruleOf(identity.difficulty).targetJumps + 1) {
    throw new Error("tee start returned a malformed platform view");
  }
  return result;
}

export async function teeMove(
  identity: TeeIdentity,
  sessionToken: string,
  seq: number,
  op: TeeOp,
  replay?: TeeOp[],
): Promise<Record<string, unknown>> {
  return post("move", {
    ...identityBody(identity),
    session_token: sessionToken,
    seq,
    op,
    ...(replay ? { replay } : {}),
  });
}

export async function teeFinalize(
  identity: TeeIdentity,
  sessionToken: string,
): Promise<TeeSettlement> {
  const raw = await post("finalize", {
    ...identityBody(identity),
    session_token: sessionToken,
  });
  const settlement: TeeSettlement = {
    problemHash: String(raw.problem_hash ?? ""),
    answerHash: String(raw.answer_hash ?? ""),
    elapsedMs: Number(raw.elapsed_ms ?? 0),
    undos: Number(raw.undos ?? 0),
    settleSignature: String(raw.settle_signature ?? ""),
  };
  if (
    !HEX_32.test(settlement.problemHash) ||
    !HEX_32.test(settlement.answerHash) ||
    !HEX_64.test(settlement.settleSignature) ||
    !Number.isSafeInteger(settlement.elapsedMs) ||
    settlement.elapsedMs < 0 ||
    !Number.isSafeInteger(settlement.undos) ||
    settlement.undos < 0
  ) {
    throw new Error("tee finalize returned a malformed settlement");
  }
  return settlement;
}

/** Map the wallet-detected network id onto the TEE service's network name. */
export function morpheusNetworkOf(detected: string): "testnet" | "mainnet" {
  const normalized = String(detected || "").toLowerCase();
  if (normalized.includes("mainnet")) return "mainnet";
  if (normalized.includes("testnet")) return "testnet";
  throw new Error("unsupported or unknown Neo network");
}
