import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
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
  const { address, connect, invokeContract, invokeRead, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment } = usePaymentFlow(APP_ID);

  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);

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
      const contract = await getContractAddress();
      if (!contract) return;

      const [sessionsRes, paidRes] = await Promise.all([
        invokeRead({ scriptHash: contract, operation: "totalSessions", args: [] }),
        invokeRead({ scriptHash: contract, operation: "totalPaid", args: [] }),
      ]);

      const totalSessions = Number(parseInvokeResult(sessionsRes) || 0);
      const totalPaid = BigInt(parseInvokeResult(paidRes) || 0);

      stats.value = { totalSessions, totalPaid };
    } catch (_e: unknown) {
      // Stats load failure is non-critical
    }
  };

  const startGame = async (boxCount: number): Promise<string | null> => {
    loading.value = true;
    error.value = null;

    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(msg("connectWallet", "Wallet not connected"));
      }

      const contract = await getContractAddress();
      if (!contract) throw new Error(msg("contractUnavailable", "Contract not available"));

      const cost = (boxCount * 0.1).toFixed(1);
      const { receiptId, invoke } = await processPayment(cost, `turtle:${boxCount}`);

      if (!receiptId) throw new Error(msg("receiptMissing", "Payment failed"));

      const result = await invoke(
        "StartGame",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: String(boxCount) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

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

      const contract = await getContractAddress();
      if (!contract) return false;

      await invokeContract({
        scriptHash: contract,
        operation: "SettleGame",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: session.value.id },
        ],
      });

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
    connect,
    loadStats,
    startGame,
    settleGame,
  };
}
