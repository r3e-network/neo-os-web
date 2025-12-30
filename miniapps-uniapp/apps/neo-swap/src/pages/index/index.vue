<template>
  <view class="container">
    <!-- Header -->
    <view class="header">
      <text class="title">Flamingo Swap</text>
      <text class="subtitle">Swap NEO ↔ GAS instantly</text>
    </view>

    <!-- Swap Card -->
    <view class="swap-card">
      <!-- From Token -->
      <view class="token-section">
        <text class="section-label">From</text>
        <view class="token-row">
          <view class="token-select" @click="openFromSelector">
            <text class="token-icon">{{ fromToken.icon }}</text>
            <text class="token-symbol">{{ fromToken.symbol }}</text>
            <text class="dropdown-arrow">▼</text>
          </view>
          <input v-model="fromAmount" type="digit" placeholder="0.0" class="amount-input" @input="onFromAmountChange" />
        </view>
        <text class="balance-text">Balance: {{ formatAmount(fromToken.balance) }}</text>
      </view>

      <!-- Swap Direction Button -->
      <view class="swap-direction" @click="swapTokens">
        <text class="swap-icon">⇅</text>
      </view>

      <!-- To Token -->
      <view class="token-section">
        <text class="section-label">To</text>
        <view class="token-row">
          <view class="token-select" @click="openToSelector">
            <text class="token-icon">{{ toToken.icon }}</text>
            <text class="token-symbol">{{ toToken.symbol }}</text>
            <text class="dropdown-arrow">▼</text>
          </view>
          <input v-model="toAmount" type="digit" placeholder="0.0" class="amount-input" disabled />
        </view>
        <text class="balance-text">Balance: {{ formatAmount(toToken.balance) }}</text>
      </view>
    </view>

    <!-- Price Info -->
    <view class="price-info" v-if="exchangeRate">
      <text class="price-label">Exchange Rate</text>
      <text class="price-value">1 {{ fromToken.symbol }} ≈ {{ exchangeRate }} {{ toToken.symbol }}</text>
    </view>

    <!-- Swap Button -->
    <button class="swap-btn" :disabled="!canSwap || loading" @click="executeSwap">
      <text>{{ swapButtonText }}</text>
    </button>

    <!-- Status -->
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <!-- Token Selector Modal -->
    <view v-if="showSelector" class="modal-overlay" @click="closeSelector">
      <view class="modal-content" @click.stop>
        <text class="modal-title">Select Token</text>
        <view v-for="token in availableTokens" :key="token.symbol" class="token-option" @click="selectToken(token)">
          <text class="token-icon">{{ token.icon }}</text>
          <view class="token-info">
            <text class="token-name">{{ token.symbol }}</text>
            <text class="token-balance">{{ formatAmount(token.balance) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-neo-swap";
const SWAP_ROUTER = "0xf970f4ccecd765b63732b821775dc38c25d74f23";

const { getAddress, invokeContract, getBalance } = useWallet(APP_ID);

interface Token {
  symbol: string;
  icon: string;
  hash: string;
  balance: number;
  decimals: number;
}

const TOKENS: Token[] = [
  { symbol: "NEO", icon: "💚", hash: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", balance: 0, decimals: 0 },
  { symbol: "GAS", icon: "⛽", hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf", balance: 0, decimals: 8 },
];

// State
const fromToken = ref<Token>({ ...TOKENS[0] });
const toToken = ref<Token>({ ...TOKENS[1] });
const fromAmount = ref("");
const toAmount = ref("");
const exchangeRate = ref("");
const loading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
const showSelector = ref(false);
const selectorTarget = ref<"from" | "to">("from");

const availableTokens = computed(() => TOKENS);

const canSwap = computed(() => {
  const amount = parseFloat(fromAmount.value);
  return amount > 0 && amount <= fromToken.value.balance;
});

const swapButtonText = computed(() => {
  if (loading.value) return "Swapping...";
  if (!fromAmount.value) return "Enter amount";
  if (parseFloat(fromAmount.value) > fromToken.value.balance) return "Insufficient balance";
  return `Swap ${fromToken.value.symbol} → ${toToken.value.symbol}`;
});

// Methods
function formatAmount(amount: number): string {
  return amount.toFixed(4);
}

function showStatus(msg: string, type: "success" | "error") {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
}

async function loadBalances() {
  try {
    const neo = await getBalance("NEO");
    const gas = await getBalance("GAS");
    TOKENS[0].balance = neo || 0;
    TOKENS[1].balance = gas || 0;
    fromToken.value = { ...TOKENS[0] };
    toToken.value = { ...TOKENS[1] };
  } catch (e) {
    console.error("Failed to load balances:", e);
  }
}

async function fetchExchangeRate() {
  // Simplified rate - in production would call Flamingo API
  const rate = fromToken.value.symbol === "NEO" ? "8.5" : "0.118";
  exchangeRate.value = rate;
}

function onFromAmountChange() {
  const amount = parseFloat(fromAmount.value) || 0;
  const rate = parseFloat(exchangeRate.value) || 0;
  toAmount.value = (amount * rate).toFixed(4);
}

function swapTokens() {
  const temp = fromToken.value;
  fromToken.value = toToken.value;
  toToken.value = temp;
  fromAmount.value = "";
  toAmount.value = "";
  fetchExchangeRate();
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

  loading.value = true;
  try {
    const amount = parseFloat(fromAmount.value);
    const decimals = fromToken.value.decimals;
    const amountInt = Math.floor(amount * Math.pow(10, decimals));

    await invokeContract({
      scriptHash: SWAP_ROUTER,
      operation: "swap",
      args: [
        { type: "Hash160", value: await getAddress() },
        { type: "Hash160", value: fromToken.value.hash },
        { type: "Hash160", value: toToken.value.hash },
        { type: "Integer", value: amountInt },
        { type: "Integer", value: 0 },
      ],
    });

    showStatus(`Swapped ${amount} ${fromToken.value.symbol}!`, "success");
    fromAmount.value = "";
    toAmount.value = "";
    await loadBalances();
  } catch (e: any) {
    showStatus(e.message || "Swap failed", "error");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBalances();
  fetchExchangeRate();
});
</script>

<style lang="scss" scoped>
$color-flamingo: #ff6b9d;
$color-bg: #0d1117;
$color-card: rgba(255, 255, 255, 0.05);
$color-border: rgba(255, 255, 255, 0.1);

.container {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: $color-flamingo;
}

.subtitle {
  display: block;
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.swap-card {
  background: $color-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.token-section {
  margin-bottom: 8px;
}

.section-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-select {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
}

.token-icon {
  font-size: 20px;
}

.token-symbol {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.dropdown-arrow {
  font-size: 10px;
  color: #888;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 24px;
  color: #fff;
  text-align: right;
  outline: none;
}

.balance-text {
  display: block;
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.swap-direction {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

.swap-icon {
  font-size: 20px;
  color: $color-flamingo;
  cursor: pointer;
  padding: 8px;
  background: rgba($color-flamingo, 0.1);
  border-radius: 50%;
}

.price-info {
  background: $color-card;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
}

.price-label {
  font-size: 13px;
  color: #888;
}

.price-value {
  font-size: 13px;
  color: #fff;
}

.swap-btn {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  background: $color-flamingo;
  color: #fff;
  cursor: pointer;
}

.swap-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-msg {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.status-msg.success {
  background: rgba(0, 212, 170, 0.2);
  color: #00d4aa;
}

.status-msg.error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 16px;
  padding: 20px;
  width: 280px;
}

.modal-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
}

.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
}

.token-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.token-info {
  flex: 1;
}

.token-name {
  display: block;
  font-size: 14px;
  color: #fff;
}

.token-balance {
  display: block;
  font-size: 12px;
  color: #888;
}
</style>
