import type { TeeSessionOp } from "@framework/logic/tee-session";

export interface CardView {
  id: number;
  symbol: number;
  layer: number;
  col?: number;
  row?: number;
  exposed: boolean;
  picked: boolean;
}

export type SheepSessionOp = (
  | { type: "pick"; cardId: number }
  | { type: "undo" }
  | { type: "shuffle" }
  | { type: "remove3" }
) & TeeSessionOp;

export interface SheepSessionView {
  cards: CardView[];
  slots: CardView[];
  matched: boolean;
  won: boolean;
  gameOver: boolean;
  shuffleLeft: number;
  remove3Left: number;
}

function parseCards(value: unknown, field: string): CardView[] {
  if (!Array.isArray(value)) throw new Error(`TEE session omitted ${field} cards`);
  const seen = new Set<number>();
  return value.map((value) => {
    if (!value || typeof value !== "object") {
      throw new Error(`TEE session returned a malformed ${field} card`);
    }
    const raw = value as Record<string, unknown>;
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
      !Number.isSafeInteger(card.id) || card.id < 0 || seen.has(card.id) ||
      !Number.isSafeInteger(card.symbol) || card.symbol < 0 || card.symbol > 14 ||
      !Number.isSafeInteger(card.layer) || card.layer < 0 || card.layer > 2 ||
      (card.col !== undefined && (!Number.isSafeInteger(card.col) || card.col < 0 || card.col > 5)) ||
      (card.row !== undefined && (!Number.isSafeInteger(card.row) || card.row < 0 || card.row > 4))
    ) {
      throw new Error(`TEE session returned a malformed ${field} card`);
    }
    seen.add(card.id);
    return card;
  });
}

function remainingUse(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`TEE session returned an invalid ${field}`);
  }
  return parsed;
}

export function parseSheepSessionView(
  value: unknown,
  options: { requireResultFlags?: boolean } = {},
): SheepSessionView {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const matched = raw.matched ?? false;
  const won = raw.won ?? false;
  const gameOver = raw.gameOver ?? raw.game_over ?? false;
  if (
    options.requireResultFlags &&
    (typeof raw.matched !== "boolean" ||
      typeof raw.won !== "boolean" ||
      (typeof raw.gameOver !== "boolean" && typeof raw.game_over !== "boolean"))
  ) {
    throw new Error("TEE session omitted authoritative result flags");
  }
  return {
    cards: parseCards(raw.cards, "board"),
    slots: parseCards(raw.slots, "tray"),
    matched: matched === true,
    won: won === true,
    gameOver: gameOver === true,
    shuffleLeft: remainingUse(raw.shuffleLeft ?? raw.shuffle_left, "shuffle count"),
    remove3Left: remainingUse(raw.remove3Left ?? raw.remove3_left, "remove-3 count"),
  };
}
