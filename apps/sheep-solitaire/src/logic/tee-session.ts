/**
 * Client for the Morpheus TEE game-session service (miniapp-sheep-solitaire).
 *
 * The card layout is generated INSIDE the enclave: the client only receives
 * a CardView[] that reveals which cards are visible. Cards exist in a 3-layer
 * stacking structure where a card on a higher layer blocks access to cards
 * underneath it. The game is won when all cards have been eliminated through
 * the match-3 mechanism.
 */

export interface TeeIdentity {
  appId: string;
  network: "testnet" | "mainnet";
  contractHash: string;
  gameId: string;
  player: string;
  difficulty: number;
}

export interface CardView {
  /** Unique identifier for this card within the game. */
  id: number;
  /** Symbol index (0..cardTypes-1) mapping to emoji. */
  symbol: number;
  /** Layer depth (0=top, 1=middle, 2=bottom). */
  layer: number;
  /** Whether this card is currently exposed (no overlapping card above it). */
  exposed: boolean;
  /** Whether this card has already been picked (removed from pile). */
  picked: boolean;
}

export interface TeeStartResult {
  commitment: string;
  bindSignature: string;
  publicKey: string;
  sessionToken: string;
  /** Visible cards after the TEE generates the layout. */
  cards: CardView[];
}

export interface TeeSettlement {
  problemHash: string;
  answerHash: string;
  elapsedMs: number;
  undos: number;
  settleSignature: string;
}

export type TeeOp =
  | { type: "pick"; cardId: number }
  | { type: "undo" }
  | { type: "shuffle" }
  | { type: "remove3" };

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

function parseCards(value: unknown): CardView[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const raw = v as Record<string, unknown>;
      return {
        id: Number(raw.id ?? -1),
        symbol: Number(raw.symbol ?? 0),
        layer: Number(raw.layer ?? 0),
        exposed: raw.exposed === true,
        picked: raw.picked === true,
      };
    })
    .filter((c) => c.id >= 0);
}

export async function teeStart(identity: TeeIdentity): Promise<TeeStartResult> {
  const raw = await post("start", identityBody(identity));
  const view = (raw.view ?? {}) as Record<string, unknown>;
  const result: TeeStartResult = {
    commitment: String(raw.commitment ?? ""),
    bindSignature: String(raw.bind_signature ?? ""),
    publicKey: String(raw.public_key ?? ""),
    sessionToken: String(raw.session_token ?? ""),
    cards: parseCards(view.cards),
  };
  if (result.commitment.length !== 64 || result.bindSignature.length !== 128) {
    throw new Error("tee start returned a malformed commitment envelope");
  }
  if (result.cards.length === 0) {
    throw new Error("tee start returned an empty card view");
  }
  return result;
}

export interface TeeMoveResult {
  ok: boolean;
  cards: CardView[];
  /** When true, a match-3 elimination happened. */
  matched: boolean;
  /** When true, the game has been won (all cards eliminated). */
  won: boolean;
  /** Remaining shuffle uses (0 or 1 for the entire game). */
  shuffleLeft: number;
  /** Remaining remove3 uses (0 or 1 for the entire game). */
  remove3Left: number;
  /** When true, the game is over (slots full and no match possible). */
  gameOver: boolean;
}

export async function teeMove(
  identity: TeeIdentity,
  sessionToken: string,
  seq: number,
  op: TeeOp,
  replay?: TeeOp[],
): Promise<TeeMoveResult> {
  const raw = await post("move", {
    ...identityBody(identity),
    session_token: sessionToken,
    seq,
    op,
    ...(replay ? { replay } : {}),
  });
  const view = raw.view && typeof raw.view === "object"
    ? raw.view as Record<string, unknown>
    : {};
  return {
    ok: raw.ok !== false,
    cards: parseCards(raw.cards ?? view.cards),
    matched: raw.matched === true,
    won: raw.won === true,
    shuffleLeft: Number(raw.shuffle_left ?? raw.shuffleLeft ?? 1),
    remove3Left: Number(raw.remove3_left ?? raw.remove3Left ?? 1),
    gameOver: raw.game_over === true || raw.gameOver === true,
  };
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
    settlement.problemHash.length !== 64 ||
    settlement.answerHash.length !== 64 ||
    settlement.settleSignature.length !== 128
  ) {
    throw new Error("tee finalize returned a malformed settlement");
  }
  return settlement;
}

/** Map the wallet-detected network id onto the TEE service's network name. */
export function morpheusNetworkOf(detected: string): "testnet" | "mainnet" {
  return String(detected || "").toLowerCase().includes("mainnet") ? "mainnet" : "testnet";
}
