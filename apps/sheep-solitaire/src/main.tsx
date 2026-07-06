import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
} from "@framework/gamefi";
import PhaserPlayArea from "./PhaserPlayArea";
import manifest from "./manifest";
import { messages } from "./locale/messages";
import { ENTRY_MEMO, ruleOf, statusOf, gasDisplay } from "./logic/game-rules";
import { morpheusNetworkOf, teeFinalize, teeMove, teeStart } from "./logic/tee-session";
import type { CardView, TeeIdentity, TeeOp, TeeStartResult } from "./logic/tee-session";

const appId = "miniapp-sheep-solitaire";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "ops:";

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface SolveRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    // Route ad-hoc arg-building / reads / invokes / events through the MiniApp
    // framework SDK. Behaviour-preserving: arg.* builders emit the identical
    // stack items, and readRaw/invoke/events/detectNetwork are raw passthroughs
    // to the same ctx.services.chain the framework wraps.
    const app = ctx.framework;

    // TEE op log via the framework's namespaced local storage. Best-effort:
    // the TEE session is the authority, so persistence failures are swallowed.
    const loadOps = (gameId: string): TeeOp[] => {
      const parsed = app.storage.local.get<TeeOp[]>(OPS_STORAGE_PREFIX + gameId, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    const saveOps = (gameId: string, ops: TeeOp[]): void => {
      try {
        app.storage.local.set(OPS_STORAGE_PREFIX + gameId, ops);
      } catch {
        /* op log is best-effort; the TEE session is the authority */
      }
    };

    const forgetOps = (gameId: string): void => {
      try {
        app.storage.local.delete(OPS_STORAGE_PREFIX + gameId);
      } catch {
        /* nothing to clean */
      }
    };

    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    /** Card pile state: cards visible from the TEE view. */
    const pileCards = createObservable<CardView[]>([]);
    /** Slot bar: cards the player has picked (max 7). */
    const slotCards = createObservable<CardView[]>([]);
    /** Whether a match-3 elimination animation is playing. */
    const isMatching = createObservable(false);
    /** Whether the game was lost (slots full). */
    const isGameOver = createObservable(false);
    /** Shuffle tool uses left (0 or 1). */
    const shuffleLeft = createObservable(1);
    /** Remove 3 tool uses left (0 or 1). */
    const remove3Left = createObservable(1);
    const isPicking = createObservable(false);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const lastStatus = createObservable(ctx.t("statusReady"));

    let session: (TeeStartResult & { identity: TeeIdentity }) | null = null;

    const playerScriptHash = (): string => {
      const player = app.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const buildIdentity = async (gameId: string, difficulty: number): Promise<TeeIdentity> => {
      const playerHash = playerScriptHash();
      const contractHash = app.chain.contractAddress.get();
      if (!playerHash) throw new Error(ctx.t("walletRequiredStatus"));
      if (!contractHash) throw new Error(ctx.t("contractUnavailableStatus"));
      let detected = "";
      try {
        detected = await app.chain.detectNetwork();
      } catch {
        detected = "testnet";
      }
      return {
        appId,
        network: morpheusNetworkOf(detected),
        contractHash: normHash(contractHash) ? `0x${normHash(contractHash)}` : contractHash,
        gameId,
        player: normHash(playerHash) ? `0x${normHash(playerHash)}` : playerHash,
        difficulty,
      };
    };

    const refreshBalances = async (): Promise<void> => {
      try {
        poolFree.set(fromFixed8(parseBigInt(await app.chain.readRaw("freePool", []))));
      } catch {
        /* keep the previous value — reads are best-effort */
      }
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const raw = await app.chain.readRaw("creditOf", [
          app.chain.arg.hash160(playerHash),
        ]);
        credit.set(fromFixed8(parseBigInt(raw)));
      } catch {
        /* keep the previous value */
      }
    };

    const refreshStats = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const stats = await app.chain.readRaw("statsOf", [
          app.chain.arg.hash160(playerHash),
        ]);
        mySolves.set(asNumber(mapField(stats, "solved")));
        myTotalWon.set(fromFixed8(parseBigInt(mapField(stats, "totalWon"))));
      } catch {
        /* stats stay stale */
      }
    };

    /**
     * Rebuild the global ranking from Solved events.
     */
    const loadLeaderboard = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      try {
        const events = await app.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves: (prior?.solves ?? 0) + 1,
            raw: eventStateValue(ev, 1),
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              elapsedMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
            });
          }
        }
        const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
          .map(([address, entry]) => ({
            address,
            totalWon: entry.totalWon,
            solves: entry.solves,
            isUser: playerHash ? addrEq(entry.raw, playerHash) : false,
          }))
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the run stays playable without rankings */
      }
    };

    const applyGameSnapshot = (game: unknown): void => {
      const status = statusOf(asNumber(mapField(game, "status")));
      gameStatus.set(status);
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
    };

    const sendOp = async (op: TeeOp): Promise<ReturnType<typeof teeMove>> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const gameId = session.identity.gameId;
      const ops = loadOps(gameId);
      let result;
      try {
        result = teeMove(session.identity, session.sessionToken, ops.length, op, undefined);
        await result;
      } catch {
        // Session cache miss (worker restarted) — retry once with the full
        // op log so the enclave can rebuild the session deterministically.
        result = teeMove(session.identity, session.sessionToken, ops.length, op, ops);
        await result;
      }
      ops.push(op);
      saveOps(gameId, ops);
      return result;
    };

    /**
     * Seal-and-bind flow: the enclave generates the card layout, returns the
     * visible CardView[] + commitment, and the commitment hash is bound on-chain.
     */
    const sealAndBind = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        session = { ...started, identity };
        const visible = started.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        slotCards.set([]);
        isGameOver.set(false);
        shuffleLeft.set(1);
        remove3Left.set(1);
        commitment.set(started.commitment);
        const result = await app.chain.invoke(
          "bindPuzzle",
          [
            app.chain.arg.integer(gameId),
            app.chain.arg.string(started.commitment),
            app.chain.arg.string(started.bindSignature),
          ],
          { waitForEvent: "PuzzleBound", waitTimeoutMs: 30_000 },
        );
        if (result.event != null) {
          dealtAt.set(asNumber(eventStateValue(result.event, 3)));
          deadline.set(asNumber(eventStateValue(result.event, 4)));
        } else {
          const game = await app.chain.readRaw("getGame", [
            app.chain.arg.integer(gameId),
          ]);
          applyGameSnapshot(game);
        }
        gameStatus.set("dealt");
        undosUsed.set(0);
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to a bound game after a reload. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        if (commitment.get() && started.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = { ...started, identity };
        const visible = started.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        commitment.set(started.commitment);
      } catch {
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      const rule = ruleOf(difficulty);
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const player = await app.chain.ensureWallet();
        const playerHash = addressToScriptHash(player);
        if (!playerHash) throw new Error(ctx.t("walletRequiredStatus"));
        await refreshBalances();
        if (poolFree.get() < fromFixed8(rule.rewardFixed8)) {
          throw new Error(ctx.t("statusPoolLow"));
        }
        const invokeArgs = [
          app.chain.arg.hash160(playerHash),
          app.chain.arg.integer(difficulty),
        ];
        const options = { waitForEvent: "GameStarted", waitTimeoutMs: 30_000 };
        const creditFixed8 = BigInt(Math.round(credit.get() * 1e8));
        const result =
          creditFixed8 >= rule.entryFixed8
            ? await app.chain.invoke("startGame", invokeArgs, options)
            : await app.chain.invokeWithPayment(
                rule.entryFixed8.toString(),
                ENTRY_MEMO,
                "startGame",
                invokeArgs,
                options,
              );
        let gameId =
          result.event != null ? String(parseBigInt(eventStateValue(result.event, 0)) ?? "") : "";
        if (!gameId || gameId === "0") {
          gameId = String(
            parseBigInt(
              await app.chain.readRaw("activeGameOf", [
                app.chain.arg.hash160(playerHash),
              ]),
            ) ?? "0",
          );
        }
        if (!gameId || gameId === "0") throw new Error(ctx.t("startGameUnavailableStatus"));
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
        pileCards.set([]);
        slotCards.set([]);
        isGameOver.set(false);
        shuffleLeft.set(1);
        remove3Left.set(1);
        gameStatus.set("committed");
        lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void sealAndBind(gameId, difficulty);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isStarting.set(false);
      }
    });

    ctx.framework.actions.register("retryDeal", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await sealAndBind(gameId, gameDifficulty.get());
    });

    // Pick a card from the pile into the slot bar.
    ctx.framework.actions.register("pickCard", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { cardId?: unknown };
      const cardId = Number(form.cardId);
      if (!Number.isInteger(cardId) || cardId < 0) return;
      if (!session || gameStatus.get() !== "dealt" || isPicking.get() || isGameOver.get()) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length >= 7) return; // slots full
      isPicking.set(true);
      try {
        const result = await sendOp({ type: "pick", cardId });
        if (!result.ok) return;
        // Update pile and slot from the TEE result
        const visible = result.cards.filter((c) => !c.picked);
        pileCards.set(visible);

        // The TEE manages the slot bar internally; we get back the updated state.
        // For local responsiveness, we can compute which card was picked.
        const pickedCard = result.cards.find((c) => c.id === cardId);
        if (pickedCard && pickedCard.picked) {
          const newSlots = [...currentSlots, pickedCard];
          slotCards.set(newSlots);
        }

        if (result.matched) {
          isMatching.set(true);
          // After a match, the TEE has already removed the matched cards from slots.
          // We update the slot bar to reflect the current TEE state.
          // We need to figure out which cards remain in slots.
          // The TEE doesn't directly return slot state, so we simulate:
          // Remove matched cards (they're still in result.cards as picked)
          const remainingSlots = slotCards.get().filter((sc) => {
            // A card is still in the slot if it's picked but not matched
            // We can check: matched cards are the 3 matching ones just eliminated
            return result.cards.find((rc) => rc.id === sc.id && rc.picked);
          });
          slotCards.set(remainingSlots);
          // Brief delay for match animation
          setTimeout(() => isMatching.set(false), 600);
        }

        if (result.won) {
          gameStatus.set("solved");
          lastStatus.set(ctx.t("statusWonTitle"));
          ctx.setStatus(ctx.t("statusWonTitle"), "success");
        }

        if (result.gameOver) {
          isGameOver.set(true);
          lastStatus.set(ctx.t("gameOverBanner"));
        }

        shuffleLeft.set(result.shuffleLeft);
        remove3Left.set(result.remove3Left);
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
      } finally {
        isPicking.set(false);
      }
    });

    // Paid undo: recorded in the TEE session (no transaction).
    ctx.framework.actions.register("useUndo", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      const currentSlots = slotCards.get();
      if (currentSlots.length === 0) return;
      isUndoing.set(true);
      try {
        const result = await sendOp({ type: "undo" });
        if (!result.ok) return;
        const visible = result.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        slotCards.set([]); // Undo clears all slots back to pile
        const undos = undosUsed.get() + 1;
        undosUsed.set(undos);
        shuffleLeft.set(result.shuffleLeft);
        remove3Left.set(result.remove3Left);
        lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(lastStatus.get(), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isUndoing.set(false);
      }
    });

    // Shuffle: return slot cards back to the pile.
    ctx.framework.actions.register("useShuffle", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || gameStatus.get() !== "dealt" || shuffleLeft.get() <= 0) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length === 0) return;
      try {
        const result = await sendOp({ type: "shuffle" });
        if (!result.ok) return;
        const visible = result.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        slotCards.set([]);
        shuffleLeft.set(result.shuffleLeft);
        remove3Left.set(result.remove3Left);
        ctx.setStatus(ctx.t("shuffleAction", { left: result.shuffleLeft }), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
      }
    });

    // Remove 3: remove any 3 cards from the slot bar.
    ctx.framework.actions.register("useRemove3", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || gameStatus.get() !== "dealt" || remove3Left.get() <= 0) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length === 0) return;
      try {
        const result = await sendOp({ type: "remove3" });
        if (!result.ok) return;
        const visible = result.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        // TEE removes 3 cards from slots; we refresh from result
        slotCards.set([]);
        shuffleLeft.set(result.shuffleLeft);
        remove3Left.set(result.remove3Left);
        ctx.setStatus(ctx.t("remove3Action", { left: result.remove3Left }), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
      }
    });

    ctx.framework.actions.register("submitRun", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        const settlement = await teeFinalize(session.identity, session.sessionToken);
        const result = await app.chain.invoke(
          "settleVerified",
          [
            app.chain.arg.integer(gameId),
            app.chain.arg.string(settlement.problemHash),
            app.chain.arg.string(settlement.answerHash),
            app.chain.arg.integer(settlement.elapsedMs),
            app.chain.arg.integer(settlement.undos),
            app.chain.arg.string(settlement.settleSignature),
          ],
          { waitForEvent: "Solved", waitTimeoutMs: 45_000 },
        );
        const payoutGas =
          result.event != null
            ? fromFixed8(parseBigInt(eventStateValue(result.event, 5)))
            : fromFixed8(0n);
        lastPayout.set(`${payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(settlement.elapsedMs);
        gameStatus.set("solved");
        activeGameId.set("0");
        forgetOps(gameId);
        session = null;
        pileCards.set([]);
        slotCards.set([]);
        lastStatus.set(ctx.t("statusSolved", { payout: payoutGas.toFixed(2) }));
        ctx.setStatus(lastStatus.get(), "success");
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    ctx.framework.actions.register("expireGame", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      try {
        await app.chain.invoke("expireGame", [app.chain.arg.integer(gameId)], {});
        gameStatus.set("expired");
        activeGameId.set("0");
        forgetOps(gameId);
        session = null;
        pileCards.set([]);
        slotCards.set([]);
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      const playerHash = playerScriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.services.notify.guard(async () => {
        await app.chain.ensureWallet();
        await app.chain.invoke(
          "withdraw",
          [app.chain.arg.hash160(playerHash)],
          { waitForEvent: "CreditWithdrawn" },
        );
        await refreshBalances();
      }, "creditWithdrawn");
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        commitment,
        dealtAt,
        deadline,
        undosUsed,
        pileCards,
        slotCards,
        isMatching,
        isGameOver,
        shuffleLeft,
        remove3Left,
        isPicking,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        lastStatus,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [
                  app.chain.arg.hash160(playerHash),
                ]),
              ) ?? "0",
            );
            if (active !== "0") {
              activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [
                app.chain.arg.integer(active),
              ]);
              applyGameSnapshot(game);
              if (gameStatus.get() === "committed") {
                void sealAndBind(active, gameDifficulty.get());
              } else if (gameStatus.get() === "dealt") {
                await resumeSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
    };
  },
});

export { gasDisplay };
