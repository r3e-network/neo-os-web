import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { requireNeoChain } from "@shared/utils/chain";
import type { PredictionMarket } from "./usePredictionMarkets";

export interface MarketOrder {
  id: number;
  marketId: number;
  orderType: "buy" | "sell";
  outcome: "yes" | "no";
  price: number;
  shares: number;
  filled: number;
}

export interface MarketPosition {
  marketId: number;
  outcome: "yes" | "no";
  shares: number;
  avgPrice: number;
  pnl?: number;
}

export interface TradeParams {
  outcome: "yes" | "no";
  shares: number;
  price: number;
}

export function usePredictionTrading(APP_ID: string) {
  const { address, chainType, invokeContract, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment, isLoading: isTrading } = usePaymentFlow(APP_ID);
  
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

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, (key: string) => key)) {
      throw new Error("Wrong chain");
    }
    const contract = await getContractAddress();
    if (!contract) throw new Error("Contract unavailable");
    return contract;
  };

  const executeTrade = async (
    market: PredictionMarket,
    params: TradeParams,
    t: Function
  ): Promise<boolean> => {
    error.value = null;
    
    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const cost = params.shares * params.price;
      
      const { receiptId, invoke } = await processPayment(
        String(cost),
        `trade:${market.id}:${params.outcome}`
      );

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
      const existingPos = yourPositions.value.find(
        (p) => p.marketId === market.id && p.outcome === params.outcome
      );

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
    } catch (e: any) {
      error.value = e.message || t("tradeFailed");
      return false;
    }
  };

  const cancelOrder = async (orderId: number, t: Function): Promise<boolean> => {
    error.value = null;
    
    try {
      const contract = await ensureContractAddress();
      
      await invokeContract({
        contractAddress: contract,
        operation: "CancelOrder",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(orderId) },
        ],
      });

      yourOrders.value = yourOrders.value.filter((o) => o.id !== orderId);
      return true;
    } catch (e: any) {
      error.value = e.message || t("cancelFailed");
      return false;
    }
  };

  const claimWinnings = async (marketId: number, t: Function): Promise<boolean> => {
    error.value = null;
    
    try {
      const contract = await ensureContractAddress();
      
      await invokeContract({
        contractAddress: contract,
        operation: "ClaimWinnings",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(marketId) },
        ],
      });

      // Remove position after claiming
      yourPositions.value = yourPositions.value.filter((p) => p.marketId !== marketId);
      return true;
    } catch (e: any) {
      error.value = e.message || t("claimFailed");
      return false;
    }
  };

  const createMarket = async (marketData: any, t: Function): Promise<boolean> => {
    error.value = null;
    
    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const { receiptId, invoke } = await processPayment(
        "10", // 10 GAS to create market
        `create:${marketData.question?.slice(0, 20)}`
      );

      if (!receiptId) throw new Error(t("receiptMissing"));

      await invoke(
        "CreateMarket",
        [
          { type: "Hash160", value: address.value },
          { type: "String", value: marketData.question },
          { type: "String", value: marketData.description || "" },
          { type: "String", value: marketData.category },
          { type: "Integer", value: String(marketData.endTime) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      return true;
    } catch (e: any) {
      error.value = e.message || t("createFailed");
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
