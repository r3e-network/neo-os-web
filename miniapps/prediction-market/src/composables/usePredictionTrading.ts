import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { PredictionMarket, MarketOrder, MarketPosition, TradeParams } from "@/types";

export type { MarketOrder, MarketPosition, TradeParams };

export function usePredictionTrading(APP_ID: string) {
  const { address, invokeContract } = useWallet() as WalletSDK;
  const { processPayment, isLoading: isTrading } = usePaymentFlow(APP_ID);
  const { ensure: ensureContractAddress } = useContractAddress((key: string) => {
    if (key === "wrongChain") return "Wrong chain";
    if (key === "contractUnavailable") return "Contract unavailable";
    return key;
  });

  const yourOrders = ref<MarketOrder[]>([]);
  const yourPositions = ref<MarketPosition[]>([]);
  const error = ref<string | null>(null);

  const portfolioValue = computed(() => {
    return yourPositions.value.reduce((sum, pos) => {
      // This will be calculated with current market prices
      return sum + pos.shares * pos.avgPrice;
    }, 0);
  });

  const totalPnL = computed(() => {
    return yourPositions.value.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  });

  const executeTrade = async (market: PredictionMarket, params: TradeParams, t: Function): Promise<boolean> => {
    error.value = null;

    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const cost = params.shares * params.price;

      const { receiptId, invoke } = await processPayment(String(cost), `trade:${market.id}:${params.outcome}`);

      if (!receiptId) throw new Error(t("receiptMissing"));

      const result = await invoke(
        params.outcome === "yes" ? "BuyYes" : "BuyNo",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: String(market.id) },
          { type: "Integer", value: String(params.shares) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      // Update local positions
      const existingPos = yourPositions.value.find((p) => p.marketId === market.id && p.outcome === params.outcome);

      if (existingPos) {
        const totalShares = existingPos.shares + params.shares;
        const totalCost = existingPos.shares * existingPos.avgPrice + params.shares * params.price;
        existingPos.avgPrice = totalCost / totalShares;
        existingPos.shares = totalShares;
      } else {
        yourPositions.value.push({
          marketId: market.id,
          outcome: params.outcome,
          shares: params.shares,
          avgPrice: params.price,
        });
      }

      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("tradeFailed"));
      return false;
    }
  };

  const cancelOrder = async (orderId: number, t: Function): Promise<boolean> => {
    error.value = null;

    try {
      const contract = await ensureContractAddress();

      await invokeContract({
        scriptHash: contract,
        operation: "CancelOrder",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(orderId) },
        ],
      });

      yourOrders.value = yourOrders.value.filter((o) => o.id !== orderId);
      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("cancelFailed"));
      return false;
    }
  };

  const claimWinnings = async (marketId: number, t: Function): Promise<boolean> => {
    error.value = null;

    try {
      const contract = await ensureContractAddress();

      await invokeContract({
        scriptHash: contract,
        operation: "ClaimWinnings",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(marketId) },
        ],
      });

      // Remove position after claiming
      yourPositions.value = yourPositions.value.filter((p) => p.marketId !== marketId);
      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("claimFailed"));
      return false;
    }
  };

  const createMarket = async (marketData: Record<string, unknown>, t: Function): Promise<boolean> => {
    error.value = null;

    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const { receiptId, invoke } = await processPayment(
        "10", // 10 GAS to create market
        `create:${String(marketData.question ?? "").slice(0, 20)}`
      );

      if (!receiptId) throw new Error(t("receiptMissing"));

      await invoke(
        "CreateMarket",
        [
          { type: "Hash160", value: address.value },
          { type: "String", value: String(marketData.question ?? "") },
          { type: "String", value: String(marketData.description ?? "") },
          { type: "String", value: String(marketData.category ?? "") },
          { type: "Integer", value: String(marketData.endTime ?? 0) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("createFailed"));
      return false;
    }
  };

  return {
    yourOrders,
    yourPositions,
    portfolioValue,
    totalPnL,
    isTrading,
    error,
    executeTrade,
    cancelOrder,
    claimWinnings,
    createMarket,
  };
}
