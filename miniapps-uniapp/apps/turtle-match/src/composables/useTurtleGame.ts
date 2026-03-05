import { ref, computed } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export enum TurtleColor {
  Green = 0,
  Red = 1,
  Blue = 2,
  Purple = 3,
  Gold = 4,
}

export interface Turtle {
  id: number;
  color: TurtleColor;
  isRevealed: boolean;
  isMatched: boolean;
}

export interface GameSession {
  id: string;
  boxCount: bigint;
  cost: bigint;
}

export interface GameStats {
  totalSessions: number;
  totalPaid: bigint;
}

export function useTurtleGame(APP_ID: string, t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);

  const { address, ensureWallet, read, invoke, invokeDirectly } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) =>
      key === "contractUnavailable" ? msg("contractUnavailable", "Contract not available") : msg(key, key),
  });

  const loading = ref(false);
  const error = ref<string | null>(null);
  const session = ref<GameSession | null>(null);
  const stats = ref<GameStats | null>(null);
  const isAutoPlaying = ref(false);
  const gamePhase = ref<"idle" | "playing" | "settling" | "complete">("idle");

  const isConnected = computed(() => !!address.value);
  const hasActiveSession = computed(() => !!session.value);

  const loadStats = async () => {
    try {
      const [totalSessions, totalPaid] = await Promise.all([read("totalSessions", []), read("totalPaid", [])]);

      stats.value = {
        totalSessions: Number(totalSessions || 0),
        totalPaid: BigInt((totalPaid as string | number) || 0),
      };
    } catch (_e: unknown) {
      // Stats load failure is non-critical
    }
  };

  const startGame = async (boxCount: number): Promise<string | null> => {
    loading.value = true;
    error.value = null;

    try {
      await ensureWallet();

      const cost = (boxCount * 0.1).toFixed(1);
      const result = await invoke(cost, `turtle:${boxCount}`, "StartGame", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(boxCount) },
      ]);

      const sessionId = result?.txid || String(Date.now());
      session.value = {
        id: sessionId,
        boxCount: BigInt(boxCount),
        cost: BigInt(boxCount) * BigInt(10000000),
      };

      return sessionId;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, msg("statsLoadFailed", "Failed to start game"));
      return null;
    } finally {
      loading.value = false;
    }
  };

  const settleGame = async (): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      if (!session.value || !address.value) return false;

      await invokeDirectly("SettleGame", [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: session.value.id },
      ]);

      session.value = null;
      await loadStats();
      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, msg("sessionLoadFailed", "Failed to settle game"));
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    session,
    stats,
    isConnected,
    hasActiveSession,
    isAutoPlaying,
    gamePhase,
    loadStats,
    startGame,
    settleGame,
  };
}
