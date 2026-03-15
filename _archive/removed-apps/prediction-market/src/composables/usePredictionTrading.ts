import { ref, computed } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { PredictionMarket, MarketOrder, MarketPosition, TradeParams } from "@/types";

export type { MarketOrder, MarketPosition, TradeParams };

export interface UsePredictionTradingReturn {
  yourOrders: ReturnType<typeof ref<MarketOrder[]>>;
  yourPositions: ReturnType<typeof ref<MarketPosition[]>>;
  portfolioValue: ReturnType<typeof computed<number>>;
  totalPnL: ReturnType<typeof computed<number>>;
  isTrading: ReturnType<typeof ref<boolean>>;
  error: ReturnType<typeof ref<string | null>>;
  executeTrade: (market: PredictionMarket, params: TradeParams) => Promise<boolean>;
  cancelOrder: (orderId: number) => Promise<boolean>;
  claimWinnings: (marketId: number) => Promise<boolean>;
  createMarket: (marketData: Record<string, unknown>) => Promise<boolean>;
}

export function usePredictionTrading(APP_ID: string): UsePredictionTradingReturn {
  const { t } = createUseI18n(messages)();
  const {
    address,
    invoke,
    invokeDirectly,
    isProcessing: isTrading,
  } = useContractInteraction({
    appId: APP_ID,
    t,
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

  const executeTrade = async (market: PredictionMarket, params: TradeParams): Promise<boolean> => {
    error.value = null;

    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const cost = params.shares * params.price;

      await invoke(
        String(cost),
        `trade:${market.id}:${params.outcome}`,
        params.outcome === "yes" ? "BuyYes" : "BuyNo",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: String(market.id) },
          { type: "Integer", value: String(params.shares) },
        ]
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

  const cancelOrder = async (orderId: number): Promise<boolean> => {
    error.value = null;

    try {
      await invokeDirectly("CancelOrder", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(orderId) },
      ]);

      yourOrders.value = yourOrders.value.filter((o) => o.id !== orderId);
      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("cancelFailed"));
      return false;
    }
  };

  const claimWinnings = async (marketId: number): Promise<boolean> => {
    error.value = null;

    try {
      await invokeDirectly("ClaimWinnings", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(marketId) },
      ]);

      // Remove position after claiming
      yourPositions.value = yourPositions.value.filter((p) => p.marketId !== marketId);
      return true;
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, t("claimFailed"));
      return false;
    }
  };

  const createMarket = async (marketData: Record<string, unknown>): Promise<boolean> => {
    error.value = null;

    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      await invoke(
        "10", // 10 GAS to create market
        `create:${String(marketData.question ?? "").slice(0, 20)}`,
        "CreateMarket",
        [
          { type: "Hash160", value: address.value },
          { type: "String", value: String(marketData.question ?? "") },
          { type: "String", value: String(marketData.description ?? "") },
          { type: "String", value: String(marketData.category ?? "") },
          { type: "Integer", value: String(marketData.endTime ?? 0) },
        ]
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
