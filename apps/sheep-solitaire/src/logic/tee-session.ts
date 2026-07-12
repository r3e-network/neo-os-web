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
  /** Symbol index (0..cardTypes-1) mapping to the tile art family. */
  symbol: number;
  /** Layer depth (0=top, 1=middle, 2=bottom). */
  layer: number;
  /** Stable grid coordinates used to keep covered tiles visually stationary. */
  col?: number;
  row?: number;
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
  /** Authoritative tray state when the service exposes it (resume-safe). */
  slots?: CardView[];
  shuffleLeft: number;
  remove3Left: number;
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

function parseCards(value: unknown, field: string): CardView[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.map((v) => {
    if (!v || typeof v !== "object") {
      throw new Error(`tee returned a malformed ${field} card`);
    }
    const raw = v as Record<string, unknown>;
    const card: CardView = {
      id: Number(raw.id ?? -1),
      symbol: Number(raw.symbol ?? -1),
      layer: Number(raw.layer ?? -1),
      exposed: raw.exposed === true,
      picked: raw.picked === true,
      ...(raw.col === undefined ? {} : { col: Number(raw.col) }),
      ...(raw.row === undefined ? {} : { row: Number(raw.row) }),
    };
    if (
      !Number.isSafeInteger(card.id) ||
      card.id < 0 ||
      !Number.isSafeInteger(card.symbol) ||
      card.symbol < 0 ||
      card.symbol > 14 ||
      !Number.isSafeInteger(card.layer) ||
      card.layer < 0 ||
      card.layer > 2 ||
      (card.col !== undefined && (!Number.isSafeInteger(card.col) || card.col < 0 || card.col > 5)) ||
      (card.row !== undefined && (!Number.isSafeInteger(card.row) || card.row < 0 || card.row > 4)) ||
      seen.has(card.id)
    ) {
      throw new Error(`tee returned a malformed ${field} card`);
    }
    seen.add(card.id);
    return card;
  });
}

function optionalCards(value: unknown, field: string): CardView[] | undefined {
  return Array.isArray(value) ? parseCards(value, field) : undefined;
}

function remainingUse(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`tee returned an invalid ${field}`);
  }
  return parsed;
}

function isHex(value: string, bytes: number): boolean {
  return new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

export async function teeStart(identity: TeeIdentity): Promise<TeeStartResult> {
  const raw = await post("start", identityBody(identity));
  const view = (raw.view ?? {}) as Record<string, unknown>;
  const result: TeeStartResult = {
    commitment: String(raw.commitment ?? ""),
    bindSignature: String(raw.bind_signature ?? ""),
    publicKey: String(raw.public_key ?? ""),
    sessionToken: String(raw.session_token ?? ""),
    cards: parseCards(view.cards, "board"),
    slots: optionalCards(view.slots, "tray"),
    shuffleLeft: remainingUse(
      raw.shuffle_left ?? raw.shuffleLeft ?? view.shuffle_left ?? view.shuffleLeft,
      "shuffle count",
    ),
    remove3Left: remainingUse(
      raw.remove3_left ?? raw.remove3Left ?? view.remove3_left ?? view.remove3Left,
      "remove-3 count",
    ),
  };
  if (!isHex(result.commitment, 32) || !isHex(result.bindSignature, 64)) {
    throw new Error("tee start returned a malformed commitment envelope");
  }
  if (!result.sessionToken.trim()) {
    throw new Error("tee start returned an empty session token");
  }
  if (result.cards.length === 0) {
    throw new Error("tee start returned an empty card view");
  }
  return result;
}

export interface TeeMoveResult {
  ok: boolean;
  cards: CardView[];
  /** Authoritative tray state when supplied by the enclave response. */
  slots: CardView[];
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
  if (raw.ok !== true) throw new Error("tee move did not confirm the operation");
  const slots = optionalCards(raw.slots ?? view.slots, "tray");
  if (!slots) throw new Error("tee move omitted the authoritative tray");
  const matched = raw.matched ?? view.matched;
  const won = raw.won ?? view.won;
  const gameOver = raw.game_over ?? raw.gameOver ?? view.game_over ?? view.gameOver;
  if (
    typeof matched !== "boolean" ||
    typeof won !== "boolean" ||
    typeof gameOver !== "boolean"
  ) throw new Error("tee move omitted an authoritative result flag");
  return {
    ok: true,
    cards: parseCards(raw.cards ?? view.cards, "board"),
    slots,
    matched,
    won,
    shuffleLeft: remainingUse(
      raw.shuffle_left ?? raw.shuffleLeft ?? view.shuffle_left ?? view.shuffleLeft,
      "shuffle count",
    ),
    remove3Left: remainingUse(
      raw.remove3_left ?? raw.remove3Left ?? view.remove3_left ?? view.remove3Left,
      "remove-3 count",
    ),
    gameOver,
  };
}

export async function teeFinalize(
  identity: TeeIdentity,
  sessionToken: string,
  replay?: TeeOp[],
): Promise<TeeSettlement> {
  const raw = await post("finalize", {
    ...identityBody(identity),
    session_token: sessionToken,
    // The enclave's in-memory session can be evicted or restarted between the
    // winning move and settlement. Its recovery contract explicitly requires
    // the sealed operation log in that case, so carry it on every finalize.
    ...(replay ? { replay } : {}),
  });
  const settlement: TeeSettlement = {
    problemHash: String(raw.problem_hash ?? ""),
    answerHash: String(raw.answer_hash ?? ""),
    elapsedMs: Number(raw.elapsed_ms ?? 0),
    undos: Number(raw.undos ?? 0),
    settleSignature: String(raw.settle_signature ?? ""),
  };
  if (
    !isHex(settlement.problemHash, 32) ||
    !isHex(settlement.answerHash, 32) ||
    !isHex(settlement.settleSignature, 64) ||
    !Number.isSafeInteger(settlement.elapsedMs) ||
    settlement.elapsedMs < 0 ||
    !Number.isSafeInteger(settlement.undos) ||
    settlement.undos < 0 ||
    settlement.undos > 3
  ) {
    throw new Error("tee finalize returned a malformed settlement");
  }
  return settlement;
}

/** Map the wallet-detected network id onto the TEE service's network name. */
export function morpheusNetworkOf(detected: string): "testnet" | "mainnet" {
  const normalized = String(detected || "").trim().toLowerCase();
  if (normalized.includes("mainnet")) return "mainnet";
  if (normalized.includes("testnet")) return "testnet";
  throw new Error("unable to prove the selected Neo network");
}
