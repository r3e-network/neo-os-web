<template>
  <view class="swap-container">
    <!-- Animated Background -->
    <view class="animated-bg">
      <view class="glow-orb orb-1"></view>
      <view class="glow-orb orb-2"></view>
      <view class="grid-lines"></view>
    </view>

    <!-- Main Swap Card -->
    <view class="swap-card">
      <SwapForm
        :t="t"
        :token="fromToken"
        v-model="fromAmount"
        :label="t('from')"
        :placeholder="t('enterAmount')"
        show-max
        @select="openFromSelector"
        @max="setMaxAmount"
      />

      <!-- Swap Direction Button -->
      <view class="swap-direction">
        <view :class="['swap-btn', { rotating: isSwapping }]" @click="swapTokens">
          <text class="swap-icon">↓↑</text>
        </view>
      </view>

      <SwapForm
        :t="t"
        :token="toToken"
        v-model="toAmount"
        :label="t('to')"
        :placeholder="t('enterAmount')"
        disabled
        @select="openToSelector"
      />
    </view>

    <!-- Rate Info Card -->
    <PriceChart
      :t="t"
      :exchange-rate="exchangeRate"
      :from-symbol="fromToken.symbol"
      :to-symbol="toToken.symbol"
      :slippage="slippage"
      :min-received="minReceived"
      :loading="rateLoading"
      @refresh="fetchExchangeRate"
    />

    <!-- Swap Action Button -->
    <view
      :class="['action-btn', { disabled: !canSwap || loading, loading: loading }]"
      @click="executeSwap"
    >
      <view v-if="loading" class="btn-loader"></view>
      <text class="btn-text">{{ swapButtonText }}</text>
    </view>

    <!-- Status Message -->
    <view v-if="status" :class="['status-card', status.type]">
      <text class="status-text">{{ status.msg }}</text>
    </view>

    <!-- Token Selector Modal -->
    <TransactionHistory
      :t="t"
      :show="showSelector"
      :tokens="availableTokens"
      :current-symbol="selectorTarget === 'from' ? fromToken.symbol : toToken.symbol"
      @close="closeSelector"
      @select="selectToken"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { toFixedDecimals } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import SwapForm from "./SwapForm.vue";
import PriceChart from "./PriceChart.vue";
import TransactionHistory from "./TransactionHistory.vue";

const props = defineProps<{
  t: (key: string) => string;
}>();

const { getAddress, invokeContract, balances, getContractAddress, chainType } = useWallet() as any;
const SWAP_ROUTER = ref<string | null>(null);

interface Token {
  symbol: string;
  hash: string;
  balance: number;
  decimals: number;
}

const TOKENS: Token[] = [
  { symbol: "NEO", hash: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", balance: 0, decimals: 0 },
  { symbol: "GAS", hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf", balance: 0, decimals: 8 },
];

// State
const fromToken = ref<Token>({ ...TOKENS[0] });
const toToken = ref<Token>({ ...TOKENS[1] });
const fromAmount = ref("");
const toAmount = ref("");
const exchangeRate = ref("");
const rateLoading = ref(false);
const loading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
const showSelector = ref(false);
const selectorTarget = ref<"from" | "to">("from");
const isSwapping = ref(false);

// Watch for balance updates
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
  { deep: true, immediate: true },
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
  if (loading.value) return props.t("swapping");
  if (!fromAmount.value) return props.t("enterAmount");
  if (rateLoading.value) return props.t("loadingRate");
  if (!hasRate.value) return props.t("rateUnavailable");
  if (parseFloat(fromAmount.value) > fromToken.value.balance) return props.t("insufficientBalance");
  return `${props.t("tabSwap")} ${fromToken.value.symbol} → ${toToken.value.symbol}`;
});
const slippage = computed(() => "0.5%");
const minReceived = computed(() => {
  const amount = parseFloat(toAmount.value) || 0;
  return (amount * 0.995).toFixed(4);
});

function showStatus(msg: string, type: "success" | "error") {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
}

function setMaxAmount() {
  fromAmount.value = fromToken.value.balance.toString();
  onFromAmountChange();
}

async function fetchExchangeRate() {
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
  } catch {} finally {
    rateLoading.value = false;
  }
}

async function loadRouter() {
  if (SWAP_ROUTER.value) return;
  try {
    SWAP_ROUTER.value = await getContractAddress();
  } catch {}
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
  fetchExchangeRate();
  setTimeout(() => (isSwapping.value = false), 300);
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
  fetchExchangeRate();
}

async function executeSwap() {
  if (!canSwap.value || loading.value) return;
  if (!requireNeoChain(chainType, props.t)) return;
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
    const routerAddress = SWAP_ROUTER.value || (await getContractAddress());
    if (!routerAddress) throw new Error(props.t("swapRouterUnavailable"));
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
    showStatus(`${props.t("swapSuccess")}: ${amount} ${fromToken.value.symbol}`, "success");
    fromAmount.value = "";
    toAmount.value = "";
  } catch (e: any) {
    showStatus(e?.message || props.t("swapFailed"), "error");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadRouter();
  fetchExchangeRate();
});
</script>

<style lang="scss" scoped>
.swap-container {
  position: relative;
  padding: 20px;
  min-height: 100vh;
  background: var(--swap-bg-gradient);
  overflow: hidden;
}

// Animated Background
.animated-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: var(--swap-orb-one);
  top: -100px;
  right: -100px;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: var(--swap-orb-two);
  bottom: 100px;
  left: -80px;
  animation-delay: -4s;
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--swap-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--swap-grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -30px) scale(1.1); }
}

// Main Swap Card
.swap-card {
  position: relative;
  background: var(--swap-card-bg);
  border: 1px solid var(--swap-card-border);
  border-radius: 24px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 0 40px var(--swap-card-glow),
    inset 0 1px 0 var(--swap-card-inset);
}

// Swap Direction Button
.swap-direction {
  display: flex;
  justify-content: center;
  margin: -20px 0;
  position: relative;
  z-index: 10;
}

.swap-btn {
  width: 48px;
  height: 48px;
  background: var(--swap-orb-one);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 20px var(--swap-accent-glow);

  &:hover {
    transform: scale(1.1) rotate(180deg);
    box-shadow: 0 6px 30px var(--swap-accent-glow-strong);
  }

  &.rotating {
    transform: rotate(180deg);
  }
}

.swap-icon {
  font-size: 20px;
  font-weight: 800;
  color: var(--swap-action-text);
}

// Action Button
.action-btn {
  margin-top: 20px;
  padding: 20px;
  background: var(--swap-action-gradient);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px var(--swap-accent-glow);

  &:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px var(--swap-accent-glow-strong);
  }

  &.disabled {
    background: var(--swap-action-disabled-bg);
    box-shadow: none;
    cursor: not-allowed;

    .btn-text {
      color: var(--swap-action-disabled-text);
    }
  }

  &.loading {
    background: var(--swap-action-loading-bg);
  }
}

.btn-text {
  font-size: 16px;
  font-weight: 800;
  color: var(--swap-action-text);
  letter-spacing: 0.1em;
}

.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid var(--swap-loader-border);
  border-top-color: var(--swap-action-text);
  border-radius: 50%;
  margin-right: 10px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// Status Card
.status-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  text-align: center;

  &.success {
    background: var(--swap-status-success-bg);
    border: 1px solid var(--swap-status-success-border);
  }

  &.error {
    background: var(--swap-status-error-bg);
    border: 1px solid var(--swap-status-error-border);
  }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--swap-text);
}
</style>
