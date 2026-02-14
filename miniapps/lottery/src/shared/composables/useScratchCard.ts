import { computed, ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { parseInvokeResult } from "@shared/utils/neo";

export interface ScratchTicket {
  id: string;
  type: number;
  purchasedAt: number;
  isRevealed: boolean;
  prize?: number;
  seed?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useScratchCard() {
  const { address, invokeContract, invokeRead } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? "Contract address not found" : key,
  );
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const playerTickets = ref<ScratchTicket[]>([]);

  const unscratchedTickets = computed(() => playerTickets.value.filter((ticket) => !ticket.isRevealed));

  const setError = (message: string) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  const getContract = async () => {
    return ensureContractAddress({
      silentChainCheck: true,
      contractUnavailableMessage: "Contract address not found",
    });
  };

  const formatPrize = (prizeRaw: number | string): string => {
    const prize = typeof prizeRaw === "string" ? parseFloat(prizeRaw) : prizeRaw;
    if (prize <= 0) return "0";
    return (prize / 100000000).toFixed(2);
  };

  const getTicket = async (ticketId: string): Promise<ScratchTicket | null> => {
    try {
      const contract = await getContract();

      const result = await invokeRead({
        scriptHash: contract,
        operation: "GetScratchTicket",
        args: [{ type: "Integer", value: ticketId }],
      });

      const parsed = parseInvokeResult(result);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const data = parsed as Record<string, unknown>;
      const id = String(data.id ?? data.Id ?? ticketId);
      const type = Number(data.type ?? data.Type ?? 0);
      const purchasedAt = Number(data.purchasedAt ?? data.PurchasedAt ?? 0);
      const isRevealed = Boolean(data.isRevealed ?? data.IsRevealed ?? false);
      const prize = Number(data.prize ?? data.Prize ?? 0);
      const seed = String(data.seed ?? data.Seed ?? "");

      return {
        id,
        type,
        purchasedAt,
        isRevealed,
        prize: isRevealed ? prize : undefined,
        seed: isRevealed ? seed : undefined,
      };
    } catch (_error: unknown) {
      // Ticket fetch failure handled silently
      return null;
    }
  };

  const getPlayerTicketCount = async (): Promise<number> => {
    if (!address.value) return 0;

    try {
      const contract = await getContract();

      const result = await invokeRead({
        scriptHash: contract,
        operation: "GetPlayerScratchCount",
        args: [{ type: "Hash160", value: address.value }],
      });

      const parsed = parseInvokeResult(result);
      return Number(parsed ?? 0);
    } catch (_error: unknown) {
      // Ticket count fetch failure handled silently
      return 0;
    }
  };

  const loadPlayerTickets = async (): Promise<ScratchTicket[]> => {
    if (!address.value) {
      playerTickets.value = [];
      return [];
    }

    try {
      const count = await getPlayerTicketCount();
      const tickets: ScratchTicket[] = [];

      for (let index = count; index >= 1; index--) {
        const ticket = await getTicket(String(index));
        if (ticket) {
          tickets.push(ticket);
        }
      }

      playerTickets.value = tickets;
      return tickets;
    } catch (_error: unknown) {
      // Ticket load failure handled silently
      playerTickets.value = [];
      return [];
    }
  };

  const buyTicket = async (lotteryType: number): Promise<{ ticketId: string }> => {
    if (!address.value) {
      throw new Error("Wallet not connected");
    }

    isLoading.value = true;
    clearError();

    try {
      const contract = await getContract();

      const result = await invokeContract({
        scriptHash: contract,
        operation: "BuyScratchTicket",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: lotteryType },
          { type: "Integer", value: "0" },
        ],
      });

      const txResult = result as { txid?: string; receiptId?: string; receipt_id?: string };
      if (!txResult?.txid) {
        throw new Error("Transaction failed");
      }

      await loadPlayerTickets();
      const ticketId = txResult.receiptId || txResult.receipt_id || txResult.txid;
      return { ticketId };
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to buy ticket");
      setError(message);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const revealTicket = async (
    ticketId: string
  ): Promise<{
    isWinner: boolean;
    prize: number;
    tier: number;
    revealed: boolean;
  }> => {
    if (!address.value) {
      throw new Error("Wallet not connected");
    }

    isLoading.value = true;
    clearError();

    try {
      const contract = await getContract();

      const result = await invokeContract({
        scriptHash: contract,
        operation: "RevealScratchTicket",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: ticketId },
        ],
      });

      const parsed = parseInvokeResult(result);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid response from contract");
      }

      const data = parsed as Record<string, unknown>;
      const prize = Number(data.prize ?? data.Prize ?? 0);
      const tier = Number(data.tier ?? data.Tier ?? 0);
      const revealed = Boolean(data.revealed ?? data.IsRevealed ?? data.Revealed ?? true);

      playerTickets.value = playerTickets.value.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              isRevealed: revealed,
              prize,
              seed: String(data.seed ?? data.Seed ?? ticket.seed ?? ""),
            }
          : ticket
      );

      return {
        isWinner: prize > 0,
        prize,
        tier,
        revealed,
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to reveal ticket");
      setError(message);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    playerTickets,
    unscratchedTickets,
    setError,
    clearError,
    buyTicket,
    revealTicket,
    getTicket,
    getPlayerTicketCount,
    loadPlayerTickets,
    formatPrize,
  };
}
