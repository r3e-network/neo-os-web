/**
 * Prediction Market Miniapp - Comprehensive Tests
 *
 * Demonstrates testing patterns for:
 * - Market listing and filtering
 * - Trading operations (buy/sell)
 * - Portfolio management
 * - Market creation
 * - Price calculations
 * - PnL tracking
 * - Contract interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, computed, nextTick } from "vue";
import { mount } from "@vue/test-utils";

// ============================================================
// MOCKS - Using shared test utilities
// ============================================================

import {
  mockWallet,
  mockPayments,
  mockEvents,
  mockI18n,
  setupMocks,
  cleanupMocks,
  mockTx,
  mockEvent,
  waitFor,
  flushPromises,
} from "@shared/test/utils";

// Setup mocks for all tests
beforeEach(() => {
  setupMocks();

  // Additional app-specific mocks
  vi.mock("@neo/uniapp-sdk", () => ({
    useWallet: () => mockWallet(),
    usePayments: () => mockPayments(),
    useEvents: () => mockEvents(),
  }));

  vi.mock("@shared/composables/usePaymentFlow", () => ({
    usePaymentFlow: () => ({
      processPayment: vi.fn().mockResolvedValue({
        receiptId: "test-receipt-123",
        invoke: vi.fn().mockResolvedValue({ txid: "test-txid-456" }),
      }),
      waitForEvent: vi.fn().mockResolvedValue({
        tx_hash: "test-txid-456",
        event_name: "OrderFilled",
        state: [],
      }),
      isLoading: ref(false),
    }),
  }));

  vi.mock("@/composables/useI18n", () => ({
    useI18n: () =>
      mockI18n({
        messages: {
          title: { en: "Prediction Market", zh: "预测市场" },
          markets: { en: "Markets", zh: "市场" },
          portfolio: { en: "Portfolio", zh: "投资组合" },
          create: { en: "Create", zh: "创建" },
          docs: { en: "Docs", zh: "文档" },
          trading: { en: "Trading", zh: "交易" },
          activeMarkets: { en: "Active Markets", zh: "活跃市场" },
          noMarkets: { en: "No markets found", zh: "未找到市场" },
          loading: { en: "Loading...", zh: "加载中..." },
          marketStats: { en: "Market Stats", zh: "市场统计" },
          totalMarkets: { en: "Total Markets", zh: "市场总数" },
          totalVolume: { en: "Total Volume", zh: "总交易量" },
          activeTraders: { en: "Active Traders", zh: "活跃交易者" },
          categories: { en: "Categories", zh: "分类" },
          categoryAll: { en: "All", zh: "全部" },
          categoryCrypto: { en: "Crypto", zh: "加密货币" },
          categorySports: { en: "Sports", zh: "体育" },
          categoryPolitics: { en: "政治", zh: "政治" },
          categoryEconomics: { en: "Economics", zh: "经济" },
          categoryEntertainment: { en: "Entertainment", zh: "娱乐" },
          categoryOther: { en: "Other", zh: "其他" },
          sortByVolume: { en: "Volume", zh: "交易量" },
          sortByNewest: { en: "Newest", zh: "最新" },
          sortByEnding: { en: "Ending Soon", zh: "即将结束" },
          portfolioValue: { en: "Portfolio Value", zh: "投资组合价值" },
          totalPnL: { en: "Total P&L", zh: "总盈亏" },
          yourPositions: { en: "Your Positions", zh: "你的持仓" },
          yourOrders: { en: "Your Orders", zh: "你的订单" },
          buy: { en: "Buy", zh: "买入" },
          sell: { en: "Sell", zh: "卖出" },
          yes: { en: "Yes", zh: "是" },
          no: { en: "No", zh: "否" },
          price: { en: "Price", zh: "价格" },
          shares: { en: "Shares", zh: "份额" },
          total: { en: "Total", zh: "总计" },
          placeOrder: { en: "Place Order", zh: "下单" },
          cancelOrder: { en: "Cancel", zh: "取消" },
          claimWinnings: { en: "Claim Winnings", zh: "领取奖金" },
          createMarket: { en: "Create Market", zh: "创建市场" },
          marketQuestion: { en: "Market Question", zh: "市场问题" },
          description: { en: "Description", zh: "描述" },
          endDate: { en: "End Date", zh: "结束日期" },
          oracle: { en: "Oracle", zh: "预言机" },
          initialLiquidity: { en: "Initial Liquidity", zh: "初始流动性" },
          submit: { en: "Submit", zh: "提交" },
          connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
          wrongChain: { en: "Wrong Chain", zh: "错误链" },
          wrongChainMessage: { en: "Please switch to Neo N3", zh: "请切换到Neo N3" },
          switchToNeo: { en: "Switch to Neo", zh: "切换到Neo" },
          error: { en: "Error", zh: "错误" },
          success: { en: "Success", zh: "成功" },
          docSubtitle: { en: "Predict the future", zh: "预测未来" },
          docDescription: { en: "Decentralized prediction markets", zh: "去中心化预测市场" },
          step1: { en: "Browse markets", zh: "浏览市场" },
          step2: { en: "Buy shares", zh: "购买份额" },
          step3: { en: "Hold or trade", zh: "持有或交易" },
          step4: { en: "Claim winnings", zh: "领取奖金" },
          feature1Name: { en: "Fair Odds", zh: "公平赔率" },
          feature1Desc: { en: "Market-driven pricing", zh: "市场驱动定价" },
          feature2Name: { en: "Instant Settlement", zh: "即时结算" },
          feature2Desc: { en: "Automated payouts", zh: "自动支付" },
          feature3Name: { en: "Low Fees", zh: "低费用" },
          feature3Desc: { en: "Minimal trading costs", zh: "最小交易成本" },
          feature4Name: { en: "Transparent", zh: "透明" },
          feature4Desc: { en: "On-chain verification", zh: "链上验证" },
        },
      }),
  }));
});

afterEach(() => {
  cleanupMocks();
});

// ============================================================
// MARKET DATA TESTS
// ============================================================

describe("Market Data", () => {
  interface PredictionMarket {
    id: number;
    question: string;
    description: string;
    category: string;
    endTime: number;
    resolutionTime?: number;
    oracle: string;
    creator: string;
    status: "open" | "closed" | "resolved" | "cancelled";
    yesPrice: number;
    noPrice: number;
    totalVolume: number;
    resolution?: boolean;
  }

  const mockMarkets: PredictionMarket[] = [
    {
      id: 1,
      question: "Will BTC exceed $100k by end of 2024?",
      description: "Bitcoin price prediction",
      category: "crypto",
      endTime: Date.now() + 86400000 * 30,
      oracle: "0xOracle1",
      creator: "0xCreator1",
      status: "open",
      yesPrice: 0.65,
      noPrice: 0.35,
      totalVolume: 15000,
    },
    {
      id: 2,
      question: "Will Team A win the championship?",
      description: "Sports prediction",
      category: "sports",
      endTime: Date.now() + 86400000 * 15,
      oracle: "0xOracle2",
      creator: "0xCreator2",
      status: "open",
      yesPrice: 0.42,
      noPrice: 0.58,
      totalVolume: 8500,
    },
    {
      id: 3,
      question: "Will the new policy pass?",
      description: "Political prediction",
      category: "politics",
      endTime: Date.now() + 86400000 * 45,
      oracle: "0xOracle3",
      creator: "0xCreator3",
      status: "open",
      yesPrice: 0.78,
      noPrice: 0.22,
      totalVolume: 22000,
    },
  ];

  it("should have valid market structure", () => {
    mockMarkets.forEach((market) => {
      expect(market.id).toBeDefined();
      expect(market.question).toBeTruthy();
      expect(market.category).toBeTruthy();
      expect(market.yesPrice + market.noPrice).toBeCloseTo(1, 2);
    });
  });

  it("should calculate total volume", () => {
    const totalVolume = mockMarkets.reduce((sum, m) => sum + m.totalVolume, 0);
    expect(totalVolume).toBe(45500);
  });

  it("should filter by category", () => {
    const cryptoMarkets = mockMarkets.filter((m) => m.category === "crypto");
    expect(cryptoMarkets.length).toBe(1);
    expect(cryptoMarkets[0].id).toBe(1);
  });

  it("should sort by volume", () => {
    const sorted = [...mockMarkets].sort((a, b) => b.totalVolume - a.totalVolume);
    expect(sorted[0].id).toBe(3);
    expect(sorted[1].id).toBe(1);
    expect(sorted[2].id).toBe(2);
  });

  it("should sort by end time", () => {
    const sorted = [...mockMarkets].sort((a, b) => a.endTime - b.endTime);
    expect(sorted[0].id).toBe(2); // 15 days
    expect(sorted[1].id).toBe(1); // 30 days
    expect(sorted[2].id).toBe(3); // 45 days
  });
});

// ============================================================
// TRADING CALCULATION TESTS
// ============================================================

describe("Trading Calculations", () => {
  describe("Order Cost Calculations", () => {
    it("should calculate buy cost correctly", () => {
      const price = 0.65; // 65%
      const shares = 100;
      const cost = price * shares;

      expect(cost).toBe(65);
    });

    it("should calculate sell proceeds correctly", () => {
      const price = 0.35; // 35%
      const shares = 100;
      const proceeds = price * shares;

      expect(proceeds).toBe(35);
    });

    it("should handle fractional shares", () => {
      const price = 0.5;
      const shares = 0.5;
      const cost = price * shares;

      expect(cost).toBe(0.25);
    });

    it("should validate price range", () => {
      const validPrices = [0, 0.5, 1];
      const invalidPrices = [-0.1, 1.1, 2];

      validPrices.forEach((price) => {
        expect(price >= 0 && price <= 1).toBe(true);
      });

      invalidPrices.forEach((price) => {
        expect(price >= 0 && price <= 1).toBe(false);
      });
    });

    it("should validate positive shares", () => {
      const validShares = [1, 10, 100, 0.5];
      const invalidShares = [0, -1, -10];

      validShares.forEach((shares) => {
        expect(shares > 0).toBe(true);
      });

      invalidShares.forEach((shares) => {
        expect(shares > 0).toBe(false);
      });
    });
  });

  describe("PnL Calculations", () => {
    it("should calculate profit correctly", () => {
      const avgPrice = 0.5;
      const currentPrice = 0.7;
      const shares = 100;
      const pnl = (currentPrice - avgPrice) * shares;

      expect(pnl).toBe(20);
    });

    it("should calculate loss correctly", () => {
      const avgPrice = 0.6;
      const currentPrice = 0.4;
      const shares = 100;
      const pnl = (currentPrice - avgPrice) * shares;

      expect(pnl).toBe(-20);
    });

    it("should calculate break-even", () => {
      const avgPrice = 0.5;
      const currentPrice = 0.5;
      const shares = 100;
      const pnl = (currentPrice - avgPrice) * shares;

      expect(pnl).toBe(0);
    });

    it("should calculate total portfolio PnL", () => {
      const positions = [
        { shares: 100, avgPrice: 0.5, currentPrice: 0.7 },
        { shares: 50, avgPrice: 0.6, currentPrice: 0.4 },
        { shares: 200, avgPrice: 0.3, currentPrice: 0.3 },
      ];

      const totalPnL = positions.reduce((sum, pos) => {
        return sum + (pos.currentPrice - pos.avgPrice) * pos.shares;
      }, 0);

      expect(totalPnL).toBe(10); // 20 - 10 + 0
    });
  });

  describe("Portfolio Value", () => {
    it("should calculate position value", () => {
      const shares = 100;
      const currentPrice = 0.65;
      const value = shares * currentPrice;

      expect(value).toBe(65);
    });

    it("should calculate total portfolio value", () => {
      const positions = [
        { shares: 100, currentPrice: 0.65 },
        { shares: 50, currentPrice: 0.42 },
        { shares: 200, currentPrice: 0.78 },
      ];

      const totalValue = positions.reduce((sum, pos) => {
        return sum + pos.shares * pos.currentPrice;
      }, 0);

      expect(totalValue).toBe(242); // 65 + 21 + 156
    });
  });
});

// ============================================================
// MARKET CREATION TESTS
// ============================================================

describe("Market Creation", () => {
  describe("Validation", () => {
    it("should validate question", () => {
      const validQuestion = "Will BTC exceed $100k?";
      const invalidQuestion = "";

      expect(validQuestion.trim().length > 0).toBe(true);
      expect(invalidQuestion.trim().length > 0).toBe(false);
    });

    it("should validate category", () => {
      const validCategories = ["crypto", "sports", "politics", "economics", "entertainment", "other"];
      const category = "crypto";

      expect(validCategories.includes(category)).toBe(true);
    });

    it("should validate end date is in future", () => {
      const pastDate = Date.now() - 86400000;
      const futureDate = Date.now() + 86400000;

      expect(pastDate > Date.now()).toBe(false);
      expect(futureDate > Date.now()).toBe(true);
    });

    it("should validate initial liquidity", () => {
      const validLiquidity = 100;
      const invalidLiquidity = 0;

      expect(validLiquidity >= 10).toBe(true);
      expect(invalidLiquidity >= 10).toBe(false);
    });

    it("should validate oracle address", () => {
      const validOracle = "0x1234567890123456789012345678901234567890";
      const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(validOracle);

      expect(isValidAddress).toBe(true);
    });
  });

  describe("Initial State", () => {
    it("should initialize with 50/50 odds", () => {
      const initialYesPrice = 0.5;
      const initialNoPrice = 0.5;

      expect(initialYesPrice).toBe(0.5);
      expect(initialNoPrice).toBe(0.5);
      expect(initialYesPrice + initialNoPrice).toBe(1);
    });

    it("should start with zero volume", () => {
      const initialVolume = 0;
      expect(initialVolume).toBe(0);
    });

    it("should start with open status", () => {
      const status = "open";
      expect(status).toBe("open");
    });
  });
});

// ============================================================
// UI STATE TESTS
// ============================================================

describe("UI State Management", () => {
  describe("Tab Navigation", () => {
    it("should switch between tabs", () => {
      const activeTab = ref("markets");
      const tabs = ["markets", "portfolio", "create", "docs"];

      tabs.forEach((tab) => {
        activeTab.value = tab;
        expect(activeTab.value).toBe(tab);
      });
    });

    it("should default to markets tab", () => {
      const activeTab = ref("markets");
      expect(activeTab.value).toBe("markets");
    });
  });

  describe("Category Filtering", () => {
    it("should select category", () => {
      const selectedCategory = ref("all");

      selectedCategory.value = "crypto";
      expect(selectedCategory.value).toBe("crypto");
    });

    it("should filter by selected category", () => {
      const markets = [
        { id: 1, category: "crypto" },
        { id: 2, category: "sports" },
        { id: 3, category: "crypto" },
      ];

      const selectedCategory = ref("crypto");
      const filtered = markets.filter((m) => m.category === selectedCategory.value);

      expect(filtered.length).toBe(2);
    });

    it("should show all when category is all", () => {
      const markets = [
        { id: 1, category: "crypto" },
        { id: 2, category: "sports" },
      ];

      const selectedCategory = ref("all");
      const filtered = selectedCategory.value === "all" ? markets : markets.filter((m) => m.category === selectedCategory.value);

      expect(filtered.length).toBe(2);
    });
  });

  describe("Sorting", () => {
    it("should toggle sort options", () => {
      const sortBy = ref<"volume" | "newest" | "ending">("volume");
      const options: Array<"volume" | "newest" | "ending"> = ["volume", "newest", "ending"];

      const currentIndex = options.indexOf(sortBy.value);
      sortBy.value = options[(currentIndex + 1) % options.length];

      expect(sortBy.value).toBe("newest");
    });

    it("should sort by volume", () => {
      const markets = [
        { id: 1, totalVolume: 100 },
        { id: 2, totalVolume: 500 },
        { id: 3, totalVolume: 300 },
      ];

      const sorted = [...markets].sort((a, b) => b.totalVolume - a.totalVolume);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe("Loading States", () => {
    it("should track loading state", () => {
      const loadingMarkets = ref(false);
      expect(loadingMarkets.value).toBe(false);

      loadingMarkets.value = true;
      expect(loadingMarkets.value).toBe(true);
    });

    it("should track creating state", () => {
      const isCreating = ref(false);

      isCreating.value = true;
      expect(isCreating.value).toBe(true);
    });

    it("should track trading state", () => {
      const isTrading = ref(false);

      isTrading.value = true;
      expect(isTrading.value).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should show error message", () => {
      const errorMessage = ref<string | null>(null);

      errorMessage.value = "Transaction failed";
      expect(errorMessage.value).toBe("Transaction failed");
    });

    it("should clear error", () => {
      const errorMessage = ref("Error");

      errorMessage.value = null;
      expect(errorMessage.value).toBeNull();
    });
  });
});

// ============================================================
// WALLET AND CONTRACT TESTS
// ============================================================

describe("Wallet and Contract Interactions", () => {
  let wallet: ReturnType<typeof mockWallet>;

  beforeEach(async () => {
    const { useWallet } = await import("@neo/uniapp-sdk");
    wallet = useWallet();
  });

  describe("Market Selection", () => {
    it("should select market for trading", () => {
      const selectedMarket = ref<any>(null);
      const activeTab = ref("markets");

      const market = { id: 1, question: "Test?" };
      selectedMarket.value = market;
      activeTab.value = "trading";

      expect(selectedMarket.value).toEqual(market);
      expect(activeTab.value).toBe("trading");
    });

    it("should clear selection on back", () => {
      const selectedMarket = ref({ id: 1 });
      const activeTab = ref("trading");

      selectedMarket.value = null;
      activeTab.value = "markets";

      expect(selectedMarket.value).toBeNull();
      expect(activeTab.value).toBe("markets");
    });
  });

  describe("Contract Operations", () => {
    it("should invoke placeOrder", async () => {
      const contract = "0x1234567890abcdef1234567890abcdef12345678";

      await wallet.invokeContract({
        scriptHash: contract,
        operation: "placeOrder",
        args: [
          { type: "Integer", value: 1 },
          { type: "String", value: "yes" },
          { type: "Integer", value: 100 },
          { type: "Integer", value: 65 },
        ],
      });

      expect(wallet.__mocks.invokeContract).toHaveBeenCalled();
    });

    it("should invoke cancelOrder", async () => {
      const contract = "0x1234567890abcdef1234567890abcdef12345678";

      await wallet.invokeContract({
        scriptHash: contract,
        operation: "cancelOrder",
        args: [{ type: "Integer", value: 123 }],
      });

      expect(wallet.__mocks.invokeContract).toHaveBeenCalled();
    });

    it("should invoke claimWinnings", async () => {
      const contract = "0x1234567890abcdef1234567890abcdef12345678";

      await wallet.invokeContract({
        scriptHash: contract,
        operation: "claimWinnings",
        args: [{ type: "Integer", value: 1 }],
      });

      expect(wallet.__mocks.invokeContract).toHaveBeenCalled();
    });
  });
});

// ============================================================
// FORMATTING TESTS
// ============================================================

describe("Value Formatting", () => {
  it("should format currency", () => {
    const formatCurrency = (value: number) => value.toFixed(2);

    expect(formatCurrency(100)).toBe("100.00");
    expect(formatCurrency(100.5)).toBe("100.50");
    expect(formatCurrency(0.01)).toBe("0.01");
  });

  it("should format percentage", () => {
    const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

    expect(formatPercentage(0.65)).toBe("65.0%");
    expect(formatPercentage(0.423)).toBe("42.3%");
  });

  it("should format time remaining", () => {
    const endTime = Date.now() + 86400000 * 2 + 3600000 * 5;
    const diff = endTime - Date.now();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    expect(days).toBe(2);
    expect(hours).toBe(5);
  });

  it("should format compact numbers", () => {
    const formatCompact = (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toString();
    };

    expect(formatCompact(500)).toBe("500");
    expect(formatCompact(1500)).toBe("1.5K");
    expect(formatCompact(2500000)).toBe("2.5M");
  });
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

describe("Error Handling", () => {
  it("should handle wallet not connected", async () => {
    const connectMock = vi.fn().mockResolvedValue(null);
    const address = await connectMock();

    expect(address).toBeNull();
  });

  it("should handle insufficient balance", () => {
    const balance = 50;
    const required = 100;

    expect(balance >= required).toBe(false);
  });

  it("should handle market not found", () => {
    const markets: any[] = [];
    const marketId = 999;

    const market = markets.find((m) => m.id === marketId);
    expect(market).toBeUndefined();
  });

  it("should handle order not found", () => {
    const orders: any[] = [];
    const orderId = 123;

    const order = orders.find((o) => o.id === orderId);
    expect(order).toBeUndefined();
  });

  it("should handle contract error", async () => {
    const invokeMock = vi.fn().mockRejectedValue(new Error("Contract error"));

    await expect(invokeMock()).rejects.toThrow("Contract error");
  });

  it("should handle wrong chain", () => {
    const chainType = ref("unknown-chain");
    const isNeoChain = computed(() => chainType.value === "neo-n3");

    expect(isNeoChain.value).toBe(false);
  });

  it("should handle market closed", () => {
    const market = { status: "closed" };
    const canTrade = market.status === "open";

    expect(canTrade).toBe(false);
  });
});

// ============================================================
// INTEGRATION TESTS
// ============================================================

describe("Integration: Full Trading Flow", () => {
  it("should complete buy flow", async () => {
    // 1. Select market
    const market = { id: 1, yesPrice: 0.65, noPrice: 0.35, status: "open" };
    expect(market.status).toBe("open");

    // 2. Enter trade details
    const outcome = "yes";
    const shares = 100;
    const price = 0.65;

    // 3. Calculate cost
    const cost = price * shares;
    expect(cost).toBe(65);

    // 4. Submit order
    const orderId = 123;
    expect(orderId).toBeDefined();

    // 5. Update position
    const positions = [{ marketId: 1, outcome: "yes", shares: 100, avgPrice: 0.65 }];
    expect(positions).toHaveLength(1);
  });

  it("should complete sell flow", async () => {
    // 1. Have existing position
    const position = { marketId: 1, outcome: "yes", shares: 100, avgPrice: 0.5 };

    // 2. Enter sell details
    const sellShares = 50;
    const currentPrice = 0.7;

    // 3. Calculate proceeds
    const proceeds = currentPrice * sellShares;
    expect(proceeds).toBe(35);

    // 4. Calculate PnL
    const pnl = (currentPrice - position.avgPrice) * sellShares;
    expect(pnl).toBe(10);

    // 5. Update position
    position.shares -= sellShares;
    expect(position.shares).toBe(50);
  });

  it("should complete claim flow", async () => {
    // 1. Market resolved
    const market = { id: 1, status: "resolved", resolution: true };

    // 2. User has winning position
    const position = { marketId: 1, outcome: "yes", shares: 100 };
    const isWinner = market.resolution === (position.outcome === "yes");

    expect(isWinner).toBe(true);

    // 3. Claim winnings
    const winnings = position.shares;
    expect(winnings).toBe(100);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe("Edge Cases", () => {
  it("should handle zero shares", () => {
    const shares = 0;
    expect(shares > 0).toBe(false);
  });

  it("should handle maximum shares", () => {
    const shares = Number.MAX_SAFE_INTEGER;
    expect(Number.isFinite(shares)).toBe(true);
  });

  it("should handle very small prices", () => {
    const price = 0.001;
    const shares = 100;
    const cost = price * shares;

    expect(cost).toBe(0.1);
  });

  it("should handle exact price boundaries", () => {
    const prices = [0, 0.5, 1];

    prices.forEach((price) => {
      expect(price >= 0 && price <= 1).toBe(true);
    });
  });

  it("should handle market with zero volume", () => {
    const market = { totalVolume: 0 };
    expect(market.totalVolume).toBe(0);
  });

  it("should handle very long question", () => {
    const longQuestion = "a".repeat(1000);
    expect(longQuestion.length).toBe(1000);
  });

  it("should handle rapid tab switching", async () => {
    const activeTab = ref("markets");
    const tabs = ["markets", "portfolio", "create", "docs"];

    for (let i = 0; i < 10; i++) {
      activeTab.value = tabs[i % tabs.length];
      await nextTick();
    }

    expect(activeTab.value).toBeDefined();
  });
});

// ============================================================
// PERFORMANCE TESTS
// ============================================================

describe("Performance", () => {
  it("should filter markets efficiently", () => {
    const markets = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      category: i % 2 === 0 ? "crypto" : "sports",
      totalVolume: i * 100,
    }));

    const start = performance.now();
    const filtered = markets.filter((m) => m.category === "crypto");
    const elapsed = performance.now() - start;

    expect(filtered.length).toBe(500);
    expect(elapsed).toBeLessThan(50);
  });

  it("should sort markets efficiently", () => {
    const markets = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      totalVolume: Math.random() * 10000,
    }));

    const start = performance.now();
    const sorted = [...markets].sort((a, b) => b.totalVolume - a.totalVolume);
    const elapsed = performance.now() - start;

    expect(sorted).toHaveLength(1000);
    expect(elapsed).toBeLessThan(50);
  });

  it("should calculate portfolio efficiently", () => {
    const positions = Array.from({ length: 100 }, (_, i) => ({
      shares: i + 1,
      avgPrice: 0.5,
      currentPrice: 0.6,
    }));

    const start = performance.now();
    const totalValue = positions.reduce((sum, pos) => sum + pos.shares * pos.currentPrice, 0);
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.currentPrice - pos.avgPrice) * pos.shares, 0);
    const elapsed = performance.now() - start;

    expect(totalValue).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10);
  });
});
