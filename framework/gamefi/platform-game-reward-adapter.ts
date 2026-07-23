import type { FrameworkPlatformGameSurface } from "../platform-game-surface";
import { eventStateValue } from "../utils/chain-events";
import {
  RewardGameError,
  rewardGameMethods,
} from "./reward-game-sdk";
import type {
  RewardGameChain,
  RewardGameConfig,
  RewardGameContractArg,
  RewardGameInvokeOptions,
  RewardGameTxResult,
} from "./reward-game-sdk";

export interface PlatformGameRewardAdapterDeps {
  appId: string;
  engineHash: string;
  config: RewardGameConfig;
  chain: Pick<
    RewardGameChain,
    "address" | "ensureWallet" | "detectNetwork" | "listEvents"
  >;
  platformGame: FrameworkPlatformGameSurface;
}

function argValue(args: RewardGameContractArg[], index: number, operation: string): string {
  const value = args[index]?.value;
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new RewardGameError("BAD_ARGUMENT", `${operation} argument ${index} is required`);
  }
  return String(value);
}

function withoutTenantSlot(event: unknown): unknown {
  if (Array.isArray(event)) return event.slice(1);
  if (!event || typeof event !== "object") return event;
  const state = (event as { state?: unknown }).state;
  if (!Array.isArray(state)) return event;
  return { ...event, state: state.slice(1) };
}

export function platformGameEventsForApp(events: unknown[], appId: string): unknown[] {
  return events
    .filter((event) => String(eventStateValue(event, 0) ?? "") === appId)
    .map(withoutTenantSlot);
}

function snapshotAsCloneRow(snapshot: Awaited<ReturnType<FrameworkPlatformGameSurface["getGame"]>>) {
  if (!snapshot) return null;
  return {
    status: snapshot.statusCode,
    difficulty: snapshot.difficulty,
    commitment: snapshot.commitment,
    dealtAt: snapshot.dealtAt,
    deadline: snapshot.deadline,
    undos: snapshot.undos,
    payout: snapshot.payoutFixed8,
    solveMs: snapshot.solveMs,
    ringsHit: snapshot.score,
  };
}

/**
 * Present the shared appId-first PlatformGame engine through the clone-shaped
 * RewardGameChain consumed by app.game.reward. The adapter is intentionally
 * strict: it never turns a missing prepaid entry into an invoke-with-payment,
 * and a Finalizing acknowledgement is never exposed as a Solved event.
 */
export function createPlatformGameRewardChain(
  deps: PlatformGameRewardAdapterDeps,
): RewardGameChain {
  const methods = rewardGameMethods(deps.config);
  const player = async (): Promise<string> => {
    const connected = deps.chain.address.get();
    return connected || deps.chain.ensureWallet();
  };

  const read = async (
    operation: string,
    args: RewardGameContractArg[] = [],
  ): Promise<unknown> => {
    if (operation === methods.freePool) return deps.platformGame.freePool();
    if (operation === methods.creditOf) {
      return deps.platformGame.creditOf(argValue(args, 0, operation));
    }
    if (operation === methods.activeGameOf) {
      return deps.platformGame.activeGameOf(argValue(args, 0, operation));
    }
    if (operation === methods.getGame) {
      const snapshot = await deps.platformGame.getGame(argValue(args, 0, operation));
      return snapshotAsCloneRow(snapshot);
    }
    if (operation === methods.statsOf) {
      const stats = await deps.platformGame.statsOf(argValue(args, 0, operation));
      return {
        played: stats.played,
        solved: stats.solved,
        totalWon: stats.totalWonFixed8,
      };
    }
    throw new RewardGameError(
      "UNSUPPORTED_METHOD",
      `${operation} is not part of the shared PlatformGame reward ABI`,
    );
  };

  const invoke = async (
    operation: string,
    args: RewardGameContractArg[],
    _options?: RewardGameInvokeOptions,
  ): Promise<RewardGameTxResult> => {
    if (operation === methods.startGame) {
      const started = await deps.platformGame.startGame(
        argValue(args, 0, operation),
        Number(argValue(args, 1, operation)),
      );
      return {
        ...started.tx,
        event: [{ type: "Integer", value: started.gameId }],
      };
    }
    if (operation === methods.finalizeGame) {
      const gameId = argValue(args, 0, operation);
      const account = await player();
      const activeGameId = await deps.platformGame.activeGameOf(account);
      if (activeGameId !== gameId) {
        throw new RewardGameError(
          "ACTIVE_GAME_MISMATCH",
          `Cannot finalize game ${gameId}; the shared engine reports active game ${activeGameId}`,
        );
      }
      const finalized = await deps.platformGame.finalizeGame(
        account,
        argValue(args, 1, operation),
      );
      return { ...finalized.tx, event: undefined };
    }
    if (operation === methods.expireGame) {
      return deps.platformGame.expireGame(argValue(args, 0, operation));
    }
    if (operation === methods.withdraw) {
      const withdrawn = await deps.platformGame.withdraw();
      if (withdrawn.skipped) {
        throw new RewardGameError("NO_CREDIT", "No shared PlatformGame credit to withdraw");
      }
      return withdrawn.tx;
    }
    throw new RewardGameError(
      "UNSUPPORTED_METHOD",
      `${operation} is not part of the shared PlatformGame reward ABI`,
    );
  };

  return {
    address: deps.chain.address,
    contractAddress: { get: () => deps.engineHash },
    ensureWallet: () => deps.chain.ensureWallet(),
    detectNetwork: () => deps.chain.detectNetwork(),
    read,
    invoke,
    invokeWithPayment: async () => {
      throw new RewardGameError(
        "CREDIT_LOW",
        "Shared PlatformGame entries must be prepaid before startGame",
      );
    },
    ...(deps.chain.listEvents
      ? {
          listEvents: async (
            eventName: string,
            options?: { limit?: number; offset?: number },
          ) => {
            const events = await deps.chain.listEvents?.(eventName, options) ?? [];
            return platformGameEventsForApp(events, deps.appId);
          },
        }
      : {}),
  };
}
