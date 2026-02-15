import { ref, computed, onMounted, onUnmounted, watch, type Ref } from "vue";
import type { WalletSDK } from "@neo/types";
import { useWallet } from "@neo/uniapp-sdk";
import { toFixedDecimals } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Token } from "@/types";

const TOKENS: Token[] = [
  { symbol: "NEO", hash: BLOCKCHAIN_CONSTANTS.NEO_HASH, balance: 0, decimals: 0 },
  { symbol: "GAS", hash: BLOCKCHAIN_CONSTANTS.GAS_HASH, balance: 0, decimals: 8 },
];

/** Manages token swap operations, balance tracking, and price estimation. */
export function useSwapEngine(t: Ref<(key: string) => string>) {
  const { getAddress, invokeContract, balances, chainType } = useWallet() as WalletSDK;
  const {
    contractAddress: SWAP_ROUTER,
    ensure: ensureRouterAddress,
    ensureSafe: ensureRouterAddressSafe,
  } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t.value("swapRouterUnavailable") : t.value(key)
  );

  const fromToken = ref<Token>({ ...TOKENS[0] });
  const toToken = ref<Token>({ ...TOKENS[1] });
  const fromAmount = ref("");
  const toAmount = ref("");
  const exchangeRate = ref("");
  const rateLoading = ref(false);
  const loading = ref(false);
  const { status, setStatus: showStatus } = useStatusMessage();
  const showSelector = ref(false);
  const selectorTarget = ref<"from" | "to">("from");
  const isSwapping = ref(false);
  let swapAnimTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    balances,
    (newVal) => {
      const neo = newVal["NEO"] || 0;
      const gas = newVal["GAS"] || 0;
      TOKENS[0].balance = Number(neo);
      TOKENS[1].balance = Number(gas);
      if (fromToken.value.symbol === "NEO") fromToken.value.balance = TOKENS[0].balance;
      if (fromToken.value.symbol === "GAS") fromToken.value.balance = TOKENS[1].balance;
      if (toToken.value.symbol === "NEO") toToken.value.balance = TOKENS[0].balance;
      if (toToken.value.symbol === "GAS") toToken.value.balance = TOKENS[1].balance;
    },
    { deep: true, immediate: true }
  );

  const availableTokens = computed(() => TOKENS);
  const hasRate = computed(() => {
    const rate = parseFloat(exchangeRate.value);
    return Number.isFinite(rate) && rate > 0;
  });
  const canSwap = computed(() => {
    const amount = parseFloat(fromAmount.value);
    return hasRate.value && amount > 0 && amount <= fromToken.value.balance;
  });
  const swapButtonText = computed(() => {
    if (loading.value) return t.value("swapping");
    if (!fromAmount.value) return t.value("enterAmount");
    if (rateLoading.value) return t.value("loadingRate");
    if (!hasRate.value) return t.value("rateUnavailable");
    if (parseFloat(fromAmount.value) > fromToken.value.balance) return t.value("insufficientBalance");
    return `${t.value("tabSwap")} ${fromToken.value.symbol} → ${toToken.value.symbol}`;
  });
  const slippage = computed(() => "0.5%");
  const minReceived = computed(() => {
    const amount = parseFloat(toAmount.value) || 0;
    return (amount * 0.995).toFixed(4);
  });

  function setMaxAmount() {
    fromAmount.value = fromToken.value.balance.toString();
    onFromAmountChange();
  }

  async function loadExchangeRate() {
    if (rateLoading.value) return;
    rateLoading.value = true;
    exchangeRate.value = "";
    try {
      const sdk = await import("@neo/uniapp-sdk").then((m) => m.waitForSDK?.() || null);
      if (sdk?.datafeed?.getPrice) {
        const fromPrice = await sdk.datafeed.getPrice(`${fromToken.value.symbol}-USD`);
        const toPrice = await sdk.datafeed.getPrice(`${toToken.value.symbol}-USD`);
        if (fromPrice?.price && toPrice?.price) {
          const rate = parseFloat(fromPrice.price) / parseFloat(toPrice.price);
          if (Number.isFinite(rate) && rate > 0) {
            exchangeRate.value = rate.toFixed(6);
            onFromAmountChange();
            return;
          }
        }
      }
    } catch {
      /* non-critical: exchange rate load */
    } finally {
      rateLoading.value = false;
    }
  }

  async function loadRouter() {
    if (SWAP_ROUTER.value) return;
    await ensureRouterAddressSafe({ silentChainCheck: true });
  }

  function onFromAmountChange() {
    const amount = parseFloat(fromAmount.value) || 0;
    const rate = parseFloat(exchangeRate.value);
    if (!Number.isFinite(rate) || rate <= 0) {
      toAmount.value = "";
      return;
    }
    toAmount.value = (amount * rate).toFixed(4);
  }

  function swapTokens() {
    isSwapping.value = true;
    const temp = fromToken.value;
    fromToken.value = toToken.value;
    toToken.value = temp;
    fromAmount.value = "";
    toAmount.value = "";
    loadExchangeRate();
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
    swapAnimTimer = setTimeout(() => {
      isSwapping.value = false;
      swapAnimTimer = null;
    }, 300);
  }

  function openFromSelector() {
    selectorTarget.value = "from";
    showSelector.value = true;
  }

  function openToSelector() {
    selectorTarget.value = "to";
    showSelector.value = true;
  }

  function closeSelector() {
    showSelector.value = false;
  }

  function selectToken(token: Token) {
    if (selectorTarget.value === "from") {
      if (token.symbol === toToken.value.symbol) swapTokens();
      else fromToken.value = { ...token };
    } else {
      if (token.symbol === fromToken.value.symbol) swapTokens();
      else toToken.value = { ...token };
    }
    closeSelector();
    loadExchangeRate();
  }

  async function executeSwap() {
    if (!canSwap.value || loading.value) return;
    if (!requireNeoChain(chainType, t.value)) return;
    loading.value = true;
    try {
      const amount = parseFloat(fromAmount.value);
      const decimals = fromToken.value.decimals;
      const amountInt = toFixedDecimals(fromAmount.value, decimals);
      const expectedOutput = parseFloat(toAmount.value) || 0;
      const slippageTolerance = 0.005;
      const minOutputAmount = expectedOutput * (1 - slippageTolerance);
      const toDecimals = toToken.value.decimals;
      const minOutputInt = toFixedDecimals(minOutputAmount.toString(), toDecimals);
      const routerAddress =
        SWAP_ROUTER.value ||
        (await ensureRouterAddress({
          silentChainCheck: true,
          contractUnavailableMessage: t.value("swapRouterUnavailable"),
        }));
      const sender = await getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const path = [
        { type: "Hash160", value: fromToken.value.hash },
        { type: "Hash160", value: toToken.value.hash },
      ];
      await invokeContract({
        scriptHash: routerAddress,
        operation: "swapTokenInForTokenOut",
        args: [
          { type: "Hash160", value: sender },
          { type: "Integer", value: amountInt },
          { type: "Integer", value: minOutputInt },
          { type: "Array", value: path },
          { type: "Integer", value: deadline },
        ],
      });
      showStatus(`${t.value("swapSuccess")}: ${amount} ${fromToken.value.symbol}`, "success");
      fromAmount.value = "";
      toAmount.value = "";
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t.value("swapFailed")), "error");
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    loadRouter();
    loadExchangeRate();
  });

  onUnmounted(() => {
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
  });

  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    exchangeRate,
    rateLoading,
    loading,
    status,
    showSelector,
    selectorTarget,
    isSwapping,
    availableTokens,
    canSwap,
    swapButtonText,
    slippage,
    minReceived,
    setMaxAmount,
    loadExchangeRate,
    swapTokens,
    openFromSelector,
    openToSelector,
    closeSelector,
    selectToken,
    executeSwap,
  };
}
