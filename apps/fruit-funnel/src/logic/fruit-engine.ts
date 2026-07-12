export const FRUIT_COLORS = ["apple", "orange", "lemon", "grape", "berry", "peach"] as const;
export type FruitColor = (typeof FRUIT_COLORS)[number];

export const LANE_COUNT = 6;
export const TOKENS_PER_LANE = 8;
export const TOTAL_TOKENS = LANE_COUNT * TOKENS_PER_LANE;
export const TOTAL_PAIRS = TOTAL_TOKENS / 2;
export const PAIRS_PER_COLOR = TOTAL_PAIRS / FRUIT_COLORS.length;
export const CHANNEL_CAPACITY = 7;
export const ROUND_TIME_MS = 240_000;
export const MAX_UNDOS = 5;
export const SNAPSHOT_VERSION = 1 as const;

export const FRUIT_ENGINE_MESSAGE_KEYS = [
  "statusReady",
  "statusFruitReleased",
  "statusPairCleared",
  "statusPaused",
  "statusAutoPaused",
  "statusRecoveredPaused",
  "statusResumed",
  "statusWon",
  "statusChannelFull",
  "statusTimeUp",
  "statusUndone",
  "statusNothingToUndo",
  "statusUndoUnavailable",
  "statusUnknownLane",
  "statusLaneEmpty",
  "statusCannotResume",
] as const;
export type FruitEngineMessageKey = (typeof FRUIT_ENGINE_MESSAGE_KEYS)[number];

export type FruitPhase = "playing" | "paused" | "won" | "lost" | "timeout";

export interface FruitToken {
  id: string;
  color: FruitColor;
  lane: number;
  pair: number;
}

export interface FruitHistoryFrame {
  lanes: FruitToken[][];
  channel: FruitToken[];
  phase: FruitPhase;
  moves: number;
  matchedPairs: number;
  score: number;
  streak: number;
  remainingMs: number;
}

export type FruitActionKind =
  | "ready"
  | "released"
  | "matched"
  | "undo"
  | "pause"
  | "resume"
  | "recovered"
  | "restart"
  | "blocked"
  | "won"
  | "lost"
  | "timeout";

export interface FruitAction {
  nonce: number;
  kind: FruitActionKind;
  tokenId?: string;
  lane?: number;
  color?: FruitColor;
  clearedIds?: [string, string];
}

export interface FruitSnapshot {
  version: typeof SNAPSHOT_VERSION;
  seed: number;
  level: number;
  lanes: FruitToken[][];
  channel: FruitToken[];
  phase: FruitPhase;
  moves: number;
  matchedPairs: number;
  score: number;
  streak: number;
  remainingMs: number;
  lastTickAt: number;
  savedAt: number;
  history: FruitHistoryFrame[];
  lastAction: FruitAction;
  messageKey: FruitEngineMessageKey;
}

export interface FruitDeal {
  seed: number;
  lanes: FruitToken[][];
  witness: Array<[FruitToken, FruitToken]>;
}

export interface FruitMoveResult {
  ok: boolean;
  action: FruitActionKind;
  messageKey?: FruitEngineMessageKey;
  token?: FruitToken;
  cleared?: [FruitToken, FruitToken];
}

const PHASES = new Set<FruitPhase>(["playing", "paused", "won", "lost", "timeout"]);
const ACTIONS = new Set<FruitActionKind>([
  "ready", "released", "matched", "undo", "pause", "resume", "recovered",
  "restart", "blocked", "won", "lost", "timeout",
]);
const MESSAGE_KEYS = new Set<FruitEngineMessageKey>(FRUIT_ENGINE_MESSAGE_KEYS);
const BLOCKED_MESSAGE_KEYS = new Set<FruitEngineMessageKey>([
  "statusPaused",
  "statusChannelFull",
  "statusTimeUp",
  "statusNothingToUndo",
  "statusUndoUnavailable",
  "statusUnknownLane",
  "statusLaneEmpty",
  "statusCannotResume",
]);

function normalizeSeed(seed: number): number {
  const value = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 1;
  return value || 1;
}

function cryptoSeed(): number {
  try {
    if (!globalThis.crypto?.getRandomValues) {
      return ((Date.now() ^ 0x9e3779b9) >>> 0) || 1;
    }
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] || 1;
  } catch {
    return ((Date.now() ^ 0x9e3779b9) >>> 0) || 1;
  }
}

function seededRandom(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target] as T, items[index] as T];
  }
  return items;
}

function cloneToken(token: FruitToken): FruitToken {
  return { ...token };
}

function cloneLanes(lanes: FruitToken[][]): FruitToken[][] {
  return lanes.map((lane) => lane.map(cloneToken));
}

function cloneHistory(history: FruitHistoryFrame[]): FruitHistoryFrame[] {
  return history.map((frame) => ({
    ...frame,
    lanes: cloneLanes(frame.lanes),
    channel: frame.channel.map(cloneToken),
  }));
}

function pairColors(random: () => number): FruitColor[] {
  const colors: FruitColor[] = [];
  for (const color of FRUIT_COLORS) {
    for (let pair = 0; pair < PAIRS_PER_COLOR; pair += 1) colors.push(color);
  }
  return shuffle(colors, random);
}

function lanePairSchedule(random: () => number): Array<[number, number]> {
  const schedule: Array<[number, number]> = [];
  for (let round = 0; round < TOKENS_PER_LANE; round += 1) {
    const order = shuffle(Array.from({ length: LANE_COUNT }, (_, index) => index), random);
    for (let index = 0; index < LANE_COUNT; index += 2) {
      schedule.push([order[index] as number, order[index + 1] as number]);
    }
  }
  return schedule;
}

/**
 * Creates an exact 48-fruit deal with a constructive witness.
 *
 * Each of eight rounds is a perfect matching across the six vines. Building
 * the witness backwards makes the next certified pair visible at the heads of
 * its two vines. Every seed therefore has a replayable zero-overflow solution,
 * while players may deliberately deviate and manage the seven-slot chute.
 */
export function createFruitDeal(seed: number): FruitDeal {
  const safeSeed = normalizeSeed(seed);
  const random = seededRandom(safeSeed ^ 0x4f1bbcdc);
  const colors = pairColors(random);
  const schedule = lanePairSchedule(random);
  const lanes = Array.from({ length: LANE_COUNT }, () => [] as FruitToken[]);
  const witness: Array<[FruitToken, FruitToken]> = Array.from({ length: TOTAL_PAIRS });

  for (let pair = TOTAL_PAIRS - 1; pair >= 0; pair -= 1) {
    const color = colors[pair];
    const lanePair = schedule[pair];
    if (!color || !lanePair) throw new Error("Fruit deal construction failed");
    const left: FruitToken = { id: `${safeSeed}:${pair}:a`, color, lane: lanePair[0], pair };
    const right: FruitToken = { id: `${safeSeed}:${pair}:b`, color, lane: lanePair[1], pair };
    lanes[left.lane]?.unshift(left);
    lanes[right.lane]?.unshift(right);
    witness[pair] = [cloneToken(left), cloneToken(right)];
  }

  if (lanes.some((lane) => lane.length !== TOKENS_PER_LANE)) {
    throw new Error("Fruit deal did not balance the orchard vines");
  }

  return { seed: safeSeed, lanes, witness };
}

export function verifyFruitWitness(deal: FruitDeal): boolean {
  const lanes = cloneLanes(deal.lanes);
  const channel: FruitToken[] = [];
  const cleared = new Set<string>();

  for (const [first, second] of deal.witness) {
    for (const expected of [first, second]) {
      const lane = lanes[expected.lane];
      const actual = lane?.shift();
      if (!actual || actual.id !== expected.id || actual.color !== expected.color) return false;
      channel.push(actual);
    }
    const right = channel.at(-1);
    const left = channel.at(-2);
    if (!left || !right || left.color !== right.color) return false;
    cleared.add(left.id);
    cleared.add(right.id);
    channel.splice(-2, 2);
    if (channel.length >= CHANNEL_CAPACITY) return false;
  }

  return lanes.every((lane) => lane.length === 0) && channel.length === 0 && cleared.size === TOTAL_TOKENS;
}

function generatedTokenMap(deal: FruitDeal): Map<string, FruitToken> {
  return new Map(deal.lanes.flat().map((token) => [token.id, token]));
}

function tokenInvariant(value: unknown, generated: Map<string, FruitToken>): value is FruitToken {
  if (!value || typeof value !== "object") return false;
  const token = value as FruitToken;
  const expected = generated.get(token.id);
  return Boolean(
    expected && expected.color === token.color && expected.lane === token.lane && expected.pair === token.pair,
  );
}

type RestorableCore = Pick<
  FruitSnapshot,
  "lanes" | "channel" | "phase" | "moves" | "matchedPairs" | "score" | "streak" | "remainingMs"
>;

function coreInvariant(value: unknown, seed: number, allowHistoryPhase = false): value is RestorableCore {
  if (!value || typeof value !== "object") return false;
  const state = value as RestorableCore;
  if (!Array.isArray(state.lanes) || state.lanes.length !== LANE_COUNT) return false;
  if (!Array.isArray(state.channel) || state.channel.length > CHANNEL_CAPACITY) return false;
  if (!PHASES.has(state.phase) || (allowHistoryPhase && state.phase !== "playing")) return false;
  if (!Number.isInteger(state.moves) || state.moves < 0 || state.moves > TOTAL_TOKENS + MAX_UNDOS * 4) return false;
  if (!Number.isInteger(state.matchedPairs) || state.matchedPairs < 0 || state.matchedPairs > TOTAL_PAIRS) return false;
  if (!Number.isInteger(state.score) || state.score < 0) return false;
  if (!Number.isInteger(state.streak) || state.streak < 0 || state.streak > TOTAL_PAIRS) return false;
  if (!Number.isFinite(state.remainingMs) || state.remainingMs < 0 || state.remainingMs > ROUND_TIME_MS) return false;

  const deal = createFruitDeal(seed);
  const generated = generatedTokenMap(deal);
  const seen = new Set<string>();
  let laneTokenCount = 0;
  for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
    const lane = state.lanes[laneIndex];
    if (!Array.isArray(lane) || lane.length > TOKENS_PER_LANE) return false;
    laneTokenCount += lane.length;
    const expectedSuffix = deal.lanes[laneIndex]?.slice(TOKENS_PER_LANE - lane.length) ?? [];
    if (expectedSuffix.length !== lane.length) return false;
    for (let tokenIndex = 0; tokenIndex < lane.length; tokenIndex += 1) {
      const token = lane[tokenIndex];
      const expected = expectedSuffix[tokenIndex];
      if (!token || !expected || token.id !== expected.id) return false;
      if (!tokenInvariant(token, generated) || token.lane !== laneIndex || seen.has(token.id)) return false;
      seen.add(token.id);
    }
  }
  for (let index = 0; index < state.channel.length; index += 1) {
    const token = state.channel[index];
    if (!token) return false;
    if (!tokenInvariant(token, generated) || seen.has(token.id)) return false;
    if (index > 0 && state.channel[index - 1]?.color === token.color) return false;
    seen.add(token.id);
  }

  const removedTokens = TOTAL_TOKENS - laneTokenCount;
  if (state.moves !== removedTokens) return false;
  if (state.moves !== state.channel.length + state.matchedPairs * 2) return false;
  if (seen.size + state.matchedPairs * 2 !== TOTAL_TOKENS) return false;

  if (state.matchedPairs === 0 && state.streak !== 0) return false;
  if (state.streak > state.matchedPairs) return false;
  const minimumScore = state.matchedPairs * 120;
  const maximumMatchScore = state.matchedPairs * 100
    + state.matchedPairs * (state.matchedPairs + 1) * 10;
  const maximumTimeBonus = Math.ceil(ROUND_TIME_MS / 1_000) * 5;
  if (state.score < minimumScore) return false;
  if (state.score > maximumMatchScore + (state.phase === "won" ? maximumTimeBonus : 0)) return false;
  if (state.phase === "won" ? state.score % 5 !== 0 : state.score % 20 !== 0) return false;

  const solved = laneTokenCount === 0 && state.channel.length === 0
    && state.matchedPairs === TOTAL_PAIRS;
  if (state.phase === "won" ? !solved : solved) return false;
  if (state.phase === "lost" ? state.channel.length !== CHANNEL_CAPACITY : state.channel.length >= CHANNEL_CAPACITY) {
    return false;
  }
  if (state.phase === "timeout" ? state.remainingMs !== 0 : state.remainingMs <= 0) return false;
  return true;
}

function noActionDetails(action: FruitAction): boolean {
  return action.tokenId === undefined
    && action.lane === undefined
    && action.color === undefined
    && action.clearedIds === undefined;
}

function actionInvariant(snapshot: FruitSnapshot): boolean {
  const action = snapshot.lastAction;
  const deal = createFruitDeal(snapshot.seed);
  const generated = generatedTokenMap(deal);
  const liveIds = new Set([
    ...snapshot.lanes.flat().map((token) => token.id),
    ...snapshot.channel.map((token) => token.id),
  ]);
  const token = action.tokenId ? generated.get(action.tokenId) : undefined;
  const tokenDetailsMatch = Boolean(
    token && token.lane === action.lane && token.color === action.color,
  );
  const messageIs = (...keys: FruitEngineMessageKey[]) => keys.includes(snapshot.messageKey);

  switch (action.kind) {
    case "ready":
      return action.nonce === 0 && snapshot.phase === "playing"
        && snapshot.moves === 0 && messageIs("statusReady") && noActionDetails(action);
    case "released":
      return action.nonce > 0 && snapshot.phase === "playing" && tokenDetailsMatch
        && snapshot.channel.at(-1)?.id === action.tokenId
        && action.clearedIds === undefined && messageIs("statusFruitReleased");
    case "matched": {
      if (action.nonce <= 0 || snapshot.phase !== "playing" || !tokenDetailsMatch
        || !Array.isArray(action.clearedIds) || action.clearedIds.length !== 2
        || !messageIs("statusPairCleared")) return false;
      const [leftId, rightId] = action.clearedIds;
      const left = generated.get(leftId);
      const right = generated.get(rightId);
      return Boolean(
        left && right && leftId !== rightId && left.color === right.color
        && action.color === right.color && action.clearedIds.includes(action.tokenId as string)
        && !liveIds.has(leftId) && !liveIds.has(rightId),
      );
    }
    case "won":
      return action.nonce > 0 && snapshot.phase === "won" && tokenDetailsMatch
        && !liveIds.has(action.tokenId as string) && action.clearedIds === undefined
        && messageIs("statusWon");
    case "lost":
      return action.nonce > 0 && snapshot.phase === "lost" && tokenDetailsMatch
        && snapshot.channel.at(-1)?.id === action.tokenId
        && action.clearedIds === undefined && messageIs("statusChannelFull");
    case "pause":
      return action.nonce > 0 && snapshot.phase === "paused" && noActionDetails(action)
        && messageIs("statusPaused", "statusAutoPaused");
    case "resume":
      return action.nonce > 0 && snapshot.phase === "playing" && noActionDetails(action)
        && messageIs("statusResumed");
    case "undo":
      return action.nonce > 0 && snapshot.phase === "playing" && noActionDetails(action)
        && messageIs("statusUndone");
    case "timeout":
      return action.nonce > 0 && snapshot.phase === "timeout" && noActionDetails(action)
        && messageIs("statusTimeUp");
    case "restart":
      return action.nonce > 0 && snapshot.phase === "playing" && snapshot.moves === 0
        && noActionDetails(action) && messageIs("statusReady");
    case "blocked":
      return action.nonce > 0 && noActionDetails(action) && BLOCKED_MESSAGE_KEYS.has(snapshot.messageKey);
    case "recovered":
      if (action.nonce <= 0 || snapshot.phase === "playing" || !noActionDetails(action)) return false;
      if (snapshot.phase === "paused") return messageIs("statusRecoveredPaused");
      if (snapshot.phase === "won") return messageIs("statusWon");
      if (snapshot.phase === "lost") return messageIs("statusChannelFull");
      return snapshot.phase === "timeout" && messageIs("statusTimeUp");
  }
}

export function isValidFruitSnapshot(value: unknown): value is FruitSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as FruitSnapshot;
  if (snapshot.version !== SNAPSHOT_VERSION || !Number.isInteger(snapshot.seed) || snapshot.seed <= 0) return false;
  if (!Number.isInteger(snapshot.level) || snapshot.level < 1) return false;
  if (!Number.isFinite(snapshot.lastTickAt) || !Number.isFinite(snapshot.savedAt)) return false;
  if (!MESSAGE_KEYS.has(snapshot.messageKey)) return false;
  if (!snapshot.lastAction || typeof snapshot.lastAction !== "object") return false;
  if (!Number.isInteger(snapshot.lastAction.nonce) || snapshot.lastAction.nonce < 0) return false;
  if (!ACTIONS.has(snapshot.lastAction.kind)) return false;
  if (!coreInvariant(snapshot, snapshot.seed)) return false;
  if (!Array.isArray(snapshot.history) || snapshot.history.length > MAX_UNDOS) return false;
  if (snapshot.history.length > snapshot.moves) return false;
  if (!snapshot.history.every((frame) => coreInvariant(frame, snapshot.seed, true))) return false;
  for (let index = 1; index < snapshot.history.length; index += 1) {
    if (snapshot.history[index]!.moves !== snapshot.history[index - 1]!.moves + 1) return false;
  }
  if (snapshot.history.length > 0 && snapshot.history.at(-1)!.moves !== snapshot.moves - 1) return false;
  return actionInvariant(snapshot);
}

export function findSafeFruitHint(snapshot: FruitSnapshot): number[] {
  if (snapshot.phase !== "playing") return [];
  const ordered = orderedPlayableLanes(snapshot.lanes, snapshot.channel);
  for (const lane of ordered) {
    const moved = simulateFruitRelease(snapshot.lanes, snapshot.channel, lane);
    if (!moved || moved.channel.length >= CHANNEL_CAPACITY) continue;
    const budget = { remaining: 80_000 };
    if (hasCertifiedCompletion(moved.lanes, moved.channel, new Set(), budget)) {
      return [lane];
    }
  }
  return [];
}

function orderedPlayableLanes(lanes: FruitToken[][], channel: FruitToken[]): number[] {
  const topColor = channel.at(-1)?.color;
  const headCounts = new Map<FruitColor, number>();
  for (const lane of lanes) {
    const color = lane[0]?.color;
    if (color) headCounts.set(color, (headCounts.get(color) ?? 0) + 1);
  }
  return lanes
    .map((lane, index) => ({ index, color: lane[0]?.color }))
    .filter((entry): entry is { index: number; color: FruitColor } => Boolean(entry.color))
    .sort((left, right) => {
      const priority = (color: FruitColor) => {
        if (color === topColor) return 0;
        if ((headCounts.get(color) ?? 0) >= 2) return 1;
        return 2;
      };
      return priority(left.color) - priority(right.color) || left.index - right.index;
    })
    .map((entry) => entry.index);
}

function simulateFruitRelease(
  lanes: FruitToken[][],
  channel: FruitToken[],
  laneIndex: number,
): { lanes: FruitToken[][]; channel: FruitToken[] } | null {
  const token = lanes[laneIndex]?.[0];
  if (!token) return null;
  const nextLanes = lanes.map((lane, index) => index === laneIndex ? lane.slice(1) : lane);
  const nextChannel = [...channel, token];
  const left = nextChannel.at(-2);
  const right = nextChannel.at(-1);
  if (left && right && left.color === right.color) nextChannel.splice(-2, 2);
  return { lanes: nextLanes, channel: nextChannel };
}

function hasCertifiedCompletion(
  lanes: FruitToken[][],
  channel: FruitToken[],
  failed: Set<string>,
  budget: { remaining: number },
): boolean {
  if (budget.remaining <= 0) return false;
  budget.remaining -= 1;
  const remaining = lanes.reduce((total, lane) => total + lane.length, 0);
  if (remaining === 0) return channel.length === 0;
  const key = `${lanes.map((lane) => lane.length).join(",")}|${channel.map((token) => token.color).join(",")}`;
  if (failed.has(key)) return false;
  for (const lane of orderedPlayableLanes(lanes, channel)) {
    const moved = simulateFruitRelease(lanes, channel, lane);
    if (!moved || moved.channel.length >= CHANNEL_CAPACITY) continue;
    if (hasCertifiedCompletion(moved.lanes, moved.channel, failed, budget)) return true;
  }
  failed.add(key);
  return false;
}

export class FruitFunnelEngine {
  private state: FruitSnapshot;
  private nonce: number;

  private constructor(snapshot: FruitSnapshot) {
    this.state = snapshot;
    this.nonce = snapshot.lastAction.nonce;
  }

  static fresh(seed = cryptoSeed(), level = 1, now = Date.now()): FruitFunnelEngine {
    const deal = createFruitDeal(seed);
    if (!verifyFruitWitness(deal)) throw new Error("Fruit deal failed its constructive witness");
    return new FruitFunnelEngine({
      version: SNAPSHOT_VERSION,
      seed: deal.seed,
      level: Math.max(1, Math.floor(level)),
      lanes: cloneLanes(deal.lanes),
      channel: [],
      phase: "playing",
      moves: 0,
      matchedPairs: 0,
      score: 0,
      streak: 0,
      remainingMs: ROUND_TIME_MS,
      lastTickAt: now,
      savedAt: now,
      history: [],
      lastAction: { nonce: 0, kind: "ready" },
      messageKey: "statusReady",
    });
  }

  static restore(value: unknown, now = Date.now()): FruitFunnelEngine | null {
    if (!isValidFruitSnapshot(value)) return null;
    const phase = value.phase === "playing" ? "paused" : value.phase;
    const recoveredMessage: FruitEngineMessageKey = phase === "paused"
      ? "statusRecoveredPaused"
      : phase === "won"
        ? "statusWon"
        : phase === "lost"
          ? "statusChannelFull"
          : "statusTimeUp";
    const snapshot: FruitSnapshot = {
      ...value,
      lanes: cloneLanes(value.lanes),
      channel: value.channel.map(cloneToken),
      history: cloneHistory(value.history),
      phase,
      lastTickAt: now,
      savedAt: now,
      lastAction: { nonce: value.lastAction.nonce + 1, kind: "recovered" },
      messageKey: recoveredMessage,
    };
    return new FruitFunnelEngine(snapshot);
  }

  snapshot(now = Date.now()): FruitSnapshot {
    if (this.state.phase === "playing") this.tick(now);
    this.state.savedAt = now;
    return {
      ...this.state,
      lanes: cloneLanes(this.state.lanes),
      channel: this.state.channel.map(cloneToken),
      history: cloneHistory(this.state.history),
      lastAction: { ...this.state.lastAction, clearedIds: this.state.lastAction.clearedIds ? [...this.state.lastAction.clearedIds] as [string, string] : undefined },
    };
  }

  tapLane(laneIndex: number, now = Date.now()): FruitMoveResult {
    this.tick(now);
    if (this.state.phase !== "playing") {
      const messageKey: FruitEngineMessageKey = this.state.phase === "timeout"
        ? "statusTimeUp"
        : this.state.phase === "lost"
          ? "statusChannelFull"
          : this.state.phase === "paused"
            ? "statusPaused"
            : "statusCannotResume";
      return this.blocked(messageKey);
    }
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= LANE_COUNT) {
      return this.blocked("statusUnknownLane");
    }
    const lane = this.state.lanes[laneIndex];
    const token = lane?.[0];
    if (!lane || !token) return this.blocked("statusLaneEmpty");

    this.pushHistory();
    lane.shift();
    this.state.channel.push(token);
    this.state.moves += 1;

    const right = this.state.channel.at(-1);
    const left = this.state.channel.at(-2);
    let cleared: [FruitToken, FruitToken] | undefined;
    if (left && right && left.color === right.color) {
      cleared = [left, right];
      this.state.channel.splice(-2, 2);
      this.state.matchedPairs += 1;
      this.state.streak += 1;
      this.state.score += 100 + this.state.streak * 20;
      this.record("matched", {
        tokenId: token.id,
        lane: laneIndex,
        color: token.color,
        clearedIds: [left.id, right.id],
      });
      this.state.messageKey = "statusPairCleared";
    } else {
      if (this.state.channel.length > 1) this.state.streak = 0;
      this.record("released", { tokenId: token.id, lane: laneIndex, color: token.color });
      this.state.messageKey = "statusFruitReleased";
    }

    if (this.state.matchedPairs === TOTAL_PAIRS && this.remainingTokens() === 0) {
      this.state.phase = "won";
      this.state.score += Math.ceil(this.state.remainingMs / 1000) * 5;
      this.record("won", { tokenId: token.id, lane: laneIndex, color: token.color });
      this.state.messageKey = "statusWon";
      return { ok: true, action: "won", token: cloneToken(token), cleared };
    }

    if (this.state.channel.length >= CHANNEL_CAPACITY) {
      this.state.phase = "lost";
      this.record("lost", { tokenId: token.id, lane: laneIndex, color: token.color });
      this.state.messageKey = "statusChannelFull";
      return { ok: true, action: "lost", token: cloneToken(token), cleared };
    }

    return { ok: true, action: cleared ? "matched" : "released", token: cloneToken(token), cleared };
  }

  togglePause(now = Date.now()): FruitMoveResult {
    if (this.state.phase === "playing") {
      this.tick(now);
      if (this.state.phase !== "playing") return this.blocked("statusTimeUp");
      this.state.phase = "paused";
      this.record("pause");
      this.state.messageKey = "statusPaused";
      return { ok: true, action: "pause" };
    }
    if (this.state.phase === "paused") {
      this.state.phase = "playing";
      this.state.lastTickAt = now;
      this.record("resume");
      this.state.messageKey = "statusResumed";
      return { ok: true, action: "resume" };
    }
    return this.blocked("statusCannotResume");
  }

  pauseForVisibility(now = Date.now()): boolean {
    if (this.state.phase !== "playing") return false;
    this.tick(now);
    if (this.state.phase !== "playing") return false;
    this.state.phase = "paused";
    this.record("pause");
    this.state.messageKey = "statusAutoPaused";
    return true;
  }

  undo(now = Date.now()): FruitMoveResult {
    this.tick(now);
    if (this.state.phase === "won" || this.state.phase === "timeout") {
      return this.blocked("statusUndoUnavailable");
    }
    const settledRemainingMs = this.state.remainingMs;
    const frame = this.state.history.pop();
    if (!frame) return this.blocked("statusNothingToUndo");
    this.state.lanes = cloneLanes(frame.lanes);
    this.state.channel = frame.channel.map(cloneToken);
    this.state.phase = "playing";
    this.state.moves = frame.moves;
    this.state.matchedPairs = frame.matchedPairs;
    this.state.score = frame.score;
    this.state.streak = frame.streak;
    // Undo repairs the board, never the clock. Otherwise a player could wait
    // after every release and repeatedly reclaim elapsed round time.
    this.state.remainingMs = Math.min(settledRemainingMs, frame.remainingMs);
    this.state.lastTickAt = now;
    this.record("undo");
    this.state.messageKey = "statusUndone";
    return { ok: true, action: "undo" };
  }

  tick(now = Date.now()): boolean {
    if (this.state.phase !== "playing") return false;
    const elapsed = Math.max(0, now - this.state.lastTickAt);
    this.state.lastTickAt = now;
    if (elapsed <= 0) return false;
    this.state.remainingMs = Math.max(0, this.state.remainingMs - elapsed);
    this.state.savedAt = now;
    if (this.state.remainingMs === 0) {
      this.state.phase = "timeout";
      this.record("timeout");
      this.state.messageKey = "statusTimeUp";
    }
    return true;
  }

  private remainingTokens(): number {
    return this.state.lanes.reduce((total, lane) => total + lane.length, 0) + this.state.channel.length;
  }

  private pushHistory(): void {
    this.state.history.push({
      lanes: cloneLanes(this.state.lanes),
      channel: this.state.channel.map(cloneToken),
      phase: this.state.phase,
      moves: this.state.moves,
      matchedPairs: this.state.matchedPairs,
      score: this.state.score,
      streak: this.state.streak,
      remainingMs: this.state.remainingMs,
    });
    if (this.state.history.length > MAX_UNDOS) this.state.history.shift();
  }

  private record(kind: FruitActionKind, details: Omit<FruitAction, "nonce" | "kind"> = {}): void {
    this.nonce += 1;
    this.state.lastAction = { nonce: this.nonce, kind, ...details };
  }

  private blocked(messageKey: FruitEngineMessageKey): FruitMoveResult {
    this.record("blocked");
    this.state.messageKey = messageKey;
    return { ok: false, action: "blocked", messageKey };
  }
}
