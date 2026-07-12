import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const GAMES = [
  "aim-master",
  "burn-league",
  "color-clash",
  "curve-arrow",
  "dice-game",
  "flappy-dash",
  "fogplay",
  "game-2048",
  "gas-lucky-pool",
  "jump-rush",
  "last-survivor",
  "merge-kingdom",
  "on-chain-tarot",
  "pet-potion",
  "red-envelope",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

// Live deployment audit (2026-07-10): these reward paths are intentionally
// hidden until their oracle/runtime/pool or contract binding is repaired.
const GAMEFI_MAINTENANCE_GAMES = [
  "aim-master",
  "color-clash",
  "curve-arrow",
  "dice-game",
  "flappy-dash",
  "fogplay",
  "game-2048",
  "gas-lucky-pool",
  "jump-rush",
  "last-survivor",
  "merge-kingdom",
  "on-chain-tarot",
  "pet-potion",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

const GUEST_UI_GUARDS = [
  { app: "aim-master", guard: "!isGuest && creditGas > 0" },
  { app: "burn-league", guard: "!guest && prepaidCredit > 0" },
  { app: "color-clash", guard: "!isGuest && credit > 0" },
  { app: "curve-arrow", guard: "!isGuest && creditGas > 0" },
  { app: "dice-game", guard: "!isGuest && directCredit > 0 && !isEvmChain" },
  { app: "flappy-dash", guard: "!isGuest && creditGas > 0" },
  { app: "fogplay", guard: "!isGuest && hasCredit" },
  { app: "game-2048", guard: "!isGuest && creditGas > 0" },
  { app: "gas-lucky-pool", guard: "actions={{}}" },
  { app: "jump-rush", guard: "!isGuest && creditGas > 0" },
  { app: "last-survivor", guard: "!isGuest && prepaidCredit > 0" },
  { app: "merge-kingdom", guard: "!isGuest && creditGas > 0" },
  { app: "on-chain-tarot", guard: "!isGuest && prepaidCredit > 0" },
  { app: "pet-potion", guard: "!isGuest && credit > 0" },
  { app: "red-envelope", guard: "!isGuest && prepaidCredit > 0" },
  { app: "sheep-solitaire", guard: "const canWithdraw = !isGuest && credit > 0" },
  { app: "snake-bounty", guard: "!isGuest && creditGas > 0" },
  { app: "sudoku", guard: "!isGuest && hasCredit" },
] as const;

const GUEST_LOCAL_ACTIONS = [
  { app: "aim-master", action: "startGame", delegate: "guest.startGame" },
  { app: "aim-master", action: "aimHit", delegate: "guest.aimHit" },
  { app: "aim-master", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "aim-master", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "aim-master", action: "expireGame", delegate: "guest.expireGame" },
  { app: "aim-master", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "burn-league", action: "burn", delegate: "guest.stoke" },
  { app: "color-clash", action: "startGame", delegate: "guest.startGame" },
  { app: "color-clash", action: "recordPress", delegate: "guest.recordPress" },
  { app: "color-clash", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "color-clash", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "color-clash", action: "expireGame", delegate: "guest.expireGame" },
  { app: "color-clash", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "curve-arrow", action: "startGame", delegate: "guest.startGame" },
  { app: "curve-arrow", action: "selectDifficulty", delegate: "guest.selectDifficulty" },
  { app: "curve-arrow", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "curve-arrow", action: "recordShot", delegate: "guest.recordShot" },
  { app: "curve-arrow", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "curve-arrow", action: "expireGame", delegate: "guest.expireGame" },
  { app: "curve-arrow", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "dice-game", action: "placeDiceBet", delegate: "guest.placeDiceBet" },
  { app: "dice-game", action: "fundGameCredit", delegate: "guest.fundGameCredit" },
  { app: "dice-game", action: "withdrawCredit", delegate: "guest.withdrawCredit" },
  { app: "dice-game", action: "recheckSettlement", delegate: "guest.recheckSettlement" },
  { app: "flappy-dash", action: "startGame", delegate: "guest.startGame" },
  { app: "flappy-dash", action: "recordFlap", delegate: "guest.recordFlap" },
  { app: "flappy-dash", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "flappy-dash", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "flappy-dash", action: "expireGame", delegate: "guest.expireGame" },
  { app: "flappy-dash", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "fogplay", action: "placeBet", delegate: "guest.placeBet" },
  { app: "game-2048", action: "startGame", delegate: "guest.startGame" },
  { app: "game-2048", action: "playMove", delegate: "guest.playMove" },
  { app: "game-2048", action: "submitRun", delegate: "guest.submitRun" },
  { app: "game-2048", action: "useUndo", delegate: "guest.useUndo" },
  { app: "game-2048", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "game-2048", action: "expireGame", delegate: "guest.expireGame" },
  { app: "game-2048", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "gas-lucky-pool", action: "createPool", delegate: "guest.draw" },
  { app: "jump-rush", action: "startGame", delegate: "guest.startGame" },
  { app: "jump-rush", action: "recordJump", delegate: "guest.recordJump" },
  { app: "jump-rush", action: "submitRun", delegate: "guest.submitRun" },
  { app: "jump-rush", action: "useUndo", delegate: "guest.useUndo" },
  { app: "jump-rush", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "jump-rush", action: "expireGame", delegate: "guest.expireGame" },
  { app: "jump-rush", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "last-survivor", action: "buyKeys", delegate: "guest.buyKeys" },
  { app: "last-survivor", action: "settleRound", delegate: "guest.settleRound" },
  { app: "last-survivor", action: "refreshRound", delegate: "guest.refresh" },
  { app: "last-survivor", action: "withdrawCredit", delegate: "guest.withdraw" },
  { app: "merge-kingdom", action: "startGame", delegate: "guest.startGame" },
  { app: "merge-kingdom", action: "recordMove", delegate: "guest.recordMove" },
  { app: "merge-kingdom", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "merge-kingdom", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "merge-kingdom", action: "expireGame", delegate: "guest.expireGame" },
  { app: "merge-kingdom", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "on-chain-tarot", action: "draw", delegate: "guest.draw" },
  { app: "on-chain-tarot", action: "refreshReadingState", delegate: "guest.refresh" },
  { app: "on-chain-tarot", action: "withdrawCredit", delegate: "guest.withdrawCredit" },
  { app: "pet-potion", action: "startGame", delegate: "guest.startGame" },
  { app: "pet-potion", action: "recordAction", delegate: "guest.recordAction" },
  { app: "pet-potion", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "pet-potion", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "pet-potion", action: "expireGame", delegate: "guest.expireGame" },
  { app: "pet-potion", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "red-envelope", action: "createEnvelope", delegate: "guest.createEnvelope" },
  { app: "red-envelope", action: "claimEnvelope", delegate: "guest.claimEnvelope" },
  { app: "red-envelope", action: "reclaimEnvelope", delegate: "guest.reclaimEnvelope" },
  { app: "red-envelope", action: "withdrawCredit", delegate: "guest.withdrawCredit" },
  { app: "red-envelope", action: "shareEnvelope", delegate: "guest.shareEnvelope" },
  { app: "sheep-solitaire", action: "startGame", delegate: "guest.startGame" },
  { app: "sheep-solitaire", action: "pickCard", delegate: "guest.pickCard" },
  { app: "sheep-solitaire", action: "submitRun", delegate: "guest.submitRun" },
  { app: "sheep-solitaire", action: "useUndo", delegate: "guest.useUndo" },
  { app: "sheep-solitaire", action: "useShuffle", delegate: "guest.useShuffle" },
  { app: "sheep-solitaire", action: "useRemove3", delegate: "guest.useRemove3" },
  { app: "sheep-solitaire", action: "returnToLobby", delegate: "guest.returnToLobby" },
  { app: "sheep-solitaire", action: "expireGame", delegate: "guest.expireGame" },
  { app: "sheep-solitaire", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "snake-bounty", action: "startGame", delegate: "guest.startGame" },
  { app: "snake-bounty", action: "selectDifficulty", delegate: "guest.selectDifficulty" },
  { app: "snake-bounty", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "snake-bounty", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "snake-bounty", action: "expireGame", delegate: "guest.expireGame" },
  { app: "snake-bounty", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
  { app: "sudoku", action: "startGame", delegate: "guest.startGame" },
  { app: "sudoku", action: "selectDifficulty", delegate: "guest.selectDifficulty" },
  { app: "sudoku", action: "recordMove", delegate: "guest.recordMove" },
  { app: "sudoku", action: "submitSolution", delegate: "guest.submitSolution" },
  { app: "sudoku", action: "useUndo", delegate: "guest.useUndo" },
  { app: "sudoku", action: "retryDeal", delegate: "guest.retryDeal" },
  { app: "sudoku", action: "expireGame", delegate: "guest.expireGame" },
  { app: "sudoku", action: "refreshLeaderboard", delegate: "guest.refreshLeaderboard" },
] as const;

const GUEST_LOCAL_NOOP_ACTIONS = [
  {
    app: "curve-arrow",
    action: "withdrawWinnings",
    reason: "guest play has no on-chain credit to withdraw",
  },
  {
    app: "sheep-solitaire",
    action: "retryDeal",
    reason: "the Phaser board already owns the local guest deal; gamefi retry only re-seals a committed chain session",
  },
  {
    app: "snake-bounty",
    action: "recordMove",
    reason: "the Phaser scene simulates guest snake movement locally; gamefi move telemetry is chain-session-only",
  },
] as const;

function pathOf(app: string, file: string): string {
  return resolve(repoRoot, "apps", app, "src", file);
}

function read(app: string, file: string): string {
  return readFileSync(pathOf(app, file), "utf8");
}

function compact(source: string): string {
  return source.replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const GAMEFI_TOUCH_PATTERN =
  /\b(?:app|ctx|framework|deps)\.(?:chain|oracle|funds|game\.reward)\b|\b(?:app|ctx\.framework)\.wallet\b|\brewardGame\.|\b(?:startRewardGame|finalizeRewardGame)\b|\bensureWallet\s*\(|\binvoke(?:WithPayment|Multiple)?\s*\(|\bpayAndCall\s*\(|\bprepayAndCall\s*\(|\breceiptPay\s*\(/;

function firstGamefiTouchIndex(source: string): number {
  return source.search(GAMEFI_TOUCH_PATTERN);
}

function actionBlock(source: string, action: string): string {
  const marker = new RegExp(
    `(?:ctx\\.framework\\.|app\\.)actions\\.register\\(\\s*["']${escapeRegExp(action)}["']`,
  );
  const match = marker.exec(source);
  if (!match) return "";
  const start = match.index;
  const rest = source.slice(start + 1);
  const nextAction = rest.search(/(?:ctx\.framework\.|app\.)actions\.register\(\s*["']/);
  const nextReturn = rest.search(/\n\s*return\s*\{/);
  const endCandidates = [nextAction, nextReturn].filter((index) => index >= 0);
  const end = endCandidates.length > 0
    ? start + 1 + Math.min(...endCandidates)
    : source.length;
  return source.slice(start, end);
}

function actionImplementation(source: string, action: string): string {
  const registered = actionBlock(source, action);
  if (!registered) return "";

  const handlerMatch = registered.match(
    /actions\.register\(\s*["'][^"']+["']\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/,
  );
  const handlerName = handlerMatch?.[1];
  if (!handlerName) return registered;

  const registrationIndex = source.indexOf(registered);
  const beforeRegistration = source.slice(0, registrationIndex);
  const declarationIndex = Math.max(
    beforeRegistration.lastIndexOf(`const ${handlerName} = async`),
    beforeRegistration.lastIndexOf(`const ${handlerName} = (`),
    beforeRegistration.lastIndexOf(`async function ${handlerName}`),
    beforeRegistration.lastIndexOf(`function ${handlerName}`),
  );
  if (declarationIndex < 0) return registered;

  return source.slice(declarationIndex, registrationIndex + registered.length);
}

describe("game guest/gamefi mode adoption", () => {
  it("covers every game with a guest UI guard", () => {
    expect(GUEST_UI_GUARDS.map(({ app }) => app).sort()).toEqual([...GAMES].sort());
  });

  it.each(GAMES)("opts %s into the two-mode launcher", (app) => {
    const manifest = read(app, "manifest.ts");
    expect(
      /supportsGuest:\s*true/.test(manifest) ||
        /modes:\s*\{[^}]*guest:\s*true[^}]*\}/s.test(manifest),
    ).toBe(true);
  });

  it.each(GAMEFI_MAINTENANCE_GAMES)("keeps %s Earn GAS hidden while its live path is unavailable", (app) => {
    const manifest = read(app, "manifest.ts");
    expect(
      /supportsGameFi:\s*false/.test(manifest) ||
        /modes:\s*\{[^}]*gamefi:\s*false[^}]*\}/s.test(manifest),
    ).toBe(true);
  });

  it("defaults every disabled GameFi Phaser surface to guest before bridge state arrives", () => {
    const appsRoot = resolve(repoRoot, "apps");
    for (const app of readdirSync(appsRoot)) {
      const manifestPath = resolve(appsRoot, app, "src/manifest.ts");
      const playAreaPath = resolve(appsRoot, app, "src/PhaserPlayArea.tsx");
      if (!existsSync(manifestPath) || !existsSync(playAreaPath)) continue;

      const manifest = readFileSync(manifestPath, "utf8");
      const gameFiDisabled =
        /supportsGameFi:\s*false/.test(manifest) ||
        /modes:\s*\{[^}]*gamefi:\s*false[^}]*\}/s.test(manifest);
      if (!gameFiDisabled) continue;

      const playArea = readFileSync(playAreaPath, "utf8");
      const modeFallbacks = [...playArea.matchAll(
        /str\(["'](?:appMode|mode)["'],\s*["']([^"']+)["']\)/g,
      )].map((match) => match[1]);
      if (modeFallbacks.length === 0) continue;

      expect(modeFallbacks, `${app} must fail closed to guest`).toEqual(
        modeFallbacks.map(() => "guest"),
      );
    }
  });

  it.each(GAMES)("keeps %s guest play on a local guest engine", (app) => {
    const main = read(app, "main.tsx");

    expect(existsSync(pathOf(app, "logic/guest-engine.ts"))).toBe(true);
    expect(main).toMatch(/from\s+["']\.\/logic\/guest-engine["']/);
    expect(main).toMatch(/app\.mode\.guestLeaderboard|storage:\s*app\.storage\.local/);
    expect(main).toContain("app.mode.onChange");
    expect(main).toContain("app.mode.isGuest()");
  });

  it.each(GAMES)("exposes %s mode to the Phaser wrapper", (app) => {
    const main = read(app, "main.tsx");
    const playArea = read(app, "PhaserPlayArea.tsx");
    const stateReturn = main.slice(main.lastIndexOf("state:"));

    expect(main).toMatch(/createObservable(?:<[^>]+>)?\(app\.mode\.get\(\)\)/);
    expect(stateReturn).toMatch(/\b(appMode|mode)\b/);
    const expectedFallback = (GAMEFI_MAINTENANCE_GAMES as readonly string[]).includes(app)
      ? "guest"
      : "gamefi";
    expect(playArea).toMatch(
      new RegExp(`str\\(["'](?:appMode|mode)["'],\\s*["']${expectedFallback}["']\\)`),
    );
    expect(playArea).toMatch(/\bisGuest\b|\bguest\b/);
  });

  it.each(GUEST_UI_GUARDS)("keeps $app asset recovery chrome out of guest mode", ({ app, guard }) => {
    const playArea = compact(read(app, "PhaserPlayArea.tsx"));

    expect(playArea).toContain(guard);
  });

  it.each(GUEST_LOCAL_ACTIONS)(
    "routes $app $action through the local guest engine before GameFi work",
    ({ app, action, delegate }) => {
      const main = read(app, "main.tsx");
      const block = stripComments(actionImplementation(main, action));
      const guestIndex = block.indexOf("app.mode.isGuest()");
      const delegateIndex = block.indexOf(delegate);
      const branchReturnIndex = block.indexOf("return", delegateIndex);
      const firstGamefiTouch = firstGamefiTouchIndex(block);

      expect(block).not.toBe("");
      expect(guestIndex).toBeGreaterThanOrEqual(0);
      expect(delegateIndex).toBeGreaterThan(guestIndex);
      expect(branchReturnIndex).toBeGreaterThan(delegateIndex);
      if (firstGamefiTouch >= 0) {
        expect(firstGamefiTouch).toBeGreaterThan(branchReturnIndex);
      }
    },
  );

  it.each(GUEST_LOCAL_NOOP_ACTIONS)(
    "keeps $app $action as a guest-mode local no-op because $reason",
    ({ app, action }) => {
      const main = read(app, "main.tsx");
      const block = compact(stripComments(actionBlock(main, action)));
      const guestIndex = block.indexOf("app.mode.isGuest()");
      const branchReturnIndex = block.indexOf("return", guestIndex);
      const firstGamefiTouch = firstGamefiTouchIndex(block);

      expect(block).not.toBe("");
      expect(guestIndex).toBeGreaterThanOrEqual(0);
      expect(branchReturnIndex).toBeGreaterThan(guestIndex);
      if (firstGamefiTouch >= 0) {
        expect(firstGamefiTouch).toBeGreaterThan(branchReturnIndex);
      }
    },
  );

  it("keeps disabled OneGate claim aliases fail-closed without forging a local payout", () => {
    const main = read("gas-lucky-pool", "main.tsx");
    const handlerStart = main.indexOf("const handleClaim = async");
    const handlerEnd = main.indexOf('ctx.framework.actions.register("claimPool"', handlerStart);
    const handler = main.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handler).toContain("!GAS_LUCKY_ONEGATE_CLAIM_ENABLED");
    expect(handler).toContain('ctx.setStatus(ctx.t("gameFiMaintenanceBody"), "warning")');
    expect(handler).not.toContain("guest.draw(");
    expect(main).toContain('ctx.framework.actions.register("claimPool", handleClaim)');
    expect(main).toContain('ctx.framework.actions.register("claimOneGateVault", handleClaim)');
  });

  it.each(GAMES)("%s guest engine stays local-only and chain-free", (app) => {
    const engine = stripComments(read(app, "logic/guest-engine.ts"));

    expect(engine).toMatch(/guestLeaderboard|GUEST_[A-Z0-9_]+_KEY/);
    expect(engine).not.toMatch(/from\s+["']@framework\/gamefi["']/);
    expect(engine).not.toMatch(/\b(?:app|ctx|framework|deps)\.chain\b/);
    expect(engine).not.toMatch(/\b(?:app|ctx|framework|deps)\.oracle\b/);
    expect(engine).not.toMatch(/\b(?:app|ctx|framework|deps)\.funds\b/);
    expect(engine).not.toMatch(/\b(?:app|ctx|framework|deps)\.game\.reward\b/);
    expect(engine).not.toMatch(/\bensureWallet\s*\(/);
    expect(engine).not.toMatch(/\binvoke(?:WithPayment|Multiple)?\s*\(/);
    expect(engine).not.toMatch(/\bpayAndCall\s*\(/);
    expect(engine).not.toMatch(/\bprepayAndCall\s*\(/);
    expect(engine).not.toMatch(/\breceiptPay\s*\(/);
  });
});
