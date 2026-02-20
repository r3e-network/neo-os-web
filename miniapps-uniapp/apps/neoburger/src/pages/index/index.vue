<template>
  <view class="app-container">
    <!-- Header -->
    <view class="header">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="title">NeoBurger</text>
      <text class="subtitle">Liquid Staking for NEO</text>
    </view>

    <!-- Stats Cards -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-label">Your bNEO</text>
        <text class="stat-value">{{ formatNum(bNeoBalance) }}</text>
      </view>
      <view class="stat-card">
        <text class="stat-label">Your NEO</text>
        <text class="stat-value">{{ formatNum(neoBalance) }}</text>
      </view>
    </view>

    <!-- APY Display -->
    <view class="apy-card">
      <text class="apy-label">Current APY</text>
      <text class="apy-value">~{{ apy }}%</text>
    </view>

    <!-- Tab Switcher -->
    <view class="tabs">
      <view class="tab" :class="{ active: activeTab === 'stake' }" @click="activeTab = 'stake'">
        <text>Stake</text>
      </view>
      <view class="tab" :class="{ active: activeTab === 'unstake' }" @click="activeTab = 'unstake'">
        <text>Unstake</text>
      </view>
    </view>

    <!-- Stake Panel -->
    <view v-if="activeTab === 'stake'" class="panel">
      <view class="input-group">
        <text class="input-label">Amount to Stake</text>
        <view class="input-row">
          <input v-model="stakeAmount" type="digit" placeholder="0" class="amount-input" />
          <text class="token-label">NEO</text>
        </view>
        <text class="balance-hint">Balance: {{ formatNum(neoBalance) }} NEO</text>
      </view>

      <view class="receive-info">
        <text class="receive-label">You will receive</text>
        <text class="receive-value">~{{ estimatedBneo }} bNEO</text>
      </view>

      <button class="action-btn stake-btn" :disabled="!canStake || loading" @click="handleStake">
        <text>{{ loading ? "Processing..." : "Stake NEO" }}</text>
      </button>
    </view>

    <!-- Unstake Panel -->
    <view v-if="activeTab === 'unstake'" class="panel">
      <view class="input-group">
        <text class="input-label">Amount to Unstake</text>
        <view class="input-row">
          <input v-model="unstakeAmount" type="digit" placeholder="0" class="amount-input" />
          <text class="token-label">bNEO</text>
        </view>
        <text class="balance-hint">Balance: {{ formatNum(bNeoBalance) }} bNEO</text>
      </view>

      <view class="receive-info">
        <text class="receive-label">You will receive</text>
        <text class="receive-value">~{{ estimatedNeo }} NEO</text>
      </view>

      <button class="action-btn unstake-btn" :disabled="!canUnstake || loading" @click="handleUnstake">
        <text>{{ loading ? "Processing..." : "Unstake bNEO" }}</text>
      </button>
    </view>

    <!-- Status Message -->
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-neoburger";
const BNEO_CONTRACT = "0x48c40d4666f93408be1bef038b6722404d9a4c2a";

const { getAddress, invokeContract, getBalance } = useWallet(APP_ID);

// State
const activeTab = ref<"stake" | "unstake">("stake");
const stakeAmount = ref("");
const unstakeAmount = ref("");
const neoBalance = ref(0);
const bNeoBalance = ref(0);
const loading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
const apy = ref("5.2");

// Computed
const canStake = computed(() => {
  const amount = parseFloat(stakeAmount.value);
  return amount > 0 && amount <= neoBalance.value;
});

const canUnstake = computed(() => {
  const amount = parseFloat(unstakeAmount.value);
  return amount > 0 && amount <= bNeoBalance.value;
});

const estimatedBneo = computed(() => {
  const amount = parseFloat(stakeAmount.value) || 0;
  return (amount * 0.99).toFixed(2);
});

const estimatedNeo = computed(() => {
  const amount = parseFloat(unstakeAmount.value) || 0;
  return (amount * 1.01).toFixed(2);
});

// Methods
const formatNum = (n: number) => formatNumber(n, 2);

function showStatus(msg: string, type: "success" | "error") {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
}

async function loadBalances() {
  try {
    const address = await getAddress();
    if (!address) return;

    const neo = await getBalance("NEO");
    const bneo = await getBalance(BNEO_CONTRACT);
    neoBalance.value = neo || 0;
    bNeoBalance.value = bneo || 0;
  } catch (e: any) {
    console.error("Failed to load balances:", e);
  }
}

async function handleStake() {
  if (!canStake.value || loading.value) return;

  loading.value = true;
  try {
    const amount = parseFloat(stakeAmount.value);
    await invokeContract({
      scriptHash: BNEO_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: await getAddress() },
        { type: "Hash160", value: BNEO_CONTRACT },
        { type: "Integer", value: amount * 100000000 },
        { type: "Any", value: null },
      ],
    });
    showStatus(`Staked ${amount} NEO successfully!`, "success");
    stakeAmount.value = "";
    await loadBalances();
  } catch (e: any) {
    showStatus(e.message || "Stake failed", "error");
  } finally {
    loading.value = false;
  }
}

async function handleUnstake() {
  if (!canUnstake.value || loading.value) return;

  loading.value = true;
  try {
    const amount = parseFloat(unstakeAmount.value);
    await invokeContract({
      scriptHash: BNEO_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: await getAddress() },
        { type: "Hash160", value: BNEO_CONTRACT },
        { type: "Integer", value: amount * 100000000 },
        { type: "ByteArray", value: "" },
      ],
    });
    showStatus(`Unstaked ${amount} bNEO successfully!`, "success");
    unstakeAmount.value = "";
    await loadBalances();
  } catch (e: any) {
    showStatus(e.message || "Unstake failed", "error");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBalances();
});
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

.app-container {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(180deg, $color-bg-secondary 0%, $color-bg-dark 100%);
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.logo {
  width: 64px;
  height: 64px;
  margin-bottom: 12px;
}

.title {
  display: block;
  font-size: 1.5em;
  font-weight: bold;
  color: $color-brand;
}

.subtitle {
  display: block;
  font-size: 0.85em;
  color: $color-text-secondary;
  margin-top: 4px;
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  background: $color-bg-card;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.75em;
  color: $color-text-secondary;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 1.25em;
  font-weight: bold;
  color: $color-text-primary;
}

.apy-card {
  background: linear-gradient(135deg, rgba($color-brand, 0.12) 0%, rgba($color-brand, 0.06) 100%);
  border: 1px solid rgba($color-brand, 0.25);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  margin-bottom: 16px;
}

.apy-label {
  display: block;
  font-size: 0.75em;
  color: $color-brand;
  margin-bottom: 4px;
}

.apy-value {
  display: block;
  font-size: 1.75em;
  font-weight: bold;
  color: $color-brand;
}

.tabs {
  display: flex;
  background: $color-bg-card;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}

.tab {
  flex: 1;
  padding: 12px;
  text-align: center;
  border-radius: 8px;
  color: $color-text-secondary;
  transition: all 0.2s ease;
  &:active {
    filter: brightness(0.85);
  }
}

.tab.active {
  background: $color-brand;
  color: $color-bg-dark;
  font-weight: bold;
}

.panel {
  background: $color-bg-card;
  border-radius: 12px;
  padding: 20px;
}

.input-group {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  font-size: 0.85em;
  color: $color-text-secondary;
  margin-bottom: 8px;
}

.input-row {
  display: flex;
  align-items: center;
  background: rgba(#000, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 1.5em;
  color: $color-text-primary;
  outline: none;
}

.token-label {
  font-size: 1em;
  color: $color-text-secondary;
  margin-left: 8px;
}

.balance-hint {
  display: block;
  font-size: 0.75em;
  color: $color-text-muted;
  margin-top: 8px;
}

.receive-info {
  background: rgba($color-brand, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.receive-label {
  font-size: 0.85em;
  color: $color-text-secondary;
}

.receive-value {
  font-size: 1em;
  font-weight: bold;
  color: $color-brand;
}

.action-btn {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  font-size: 1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  &:active {
    filter: brightness(0.85);
  }
}

.stake-btn {
  background: $color-brand;
  color: $color-bg-dark;
}

.unstake-btn {
  background: $color-brand-negative;
  color: $color-text-primary;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-msg {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.85em;
}

.status-msg.success {
  background: rgba($color-brand, 0.2);
  color: $color-brand;
}

.status-msg.error {
  background: rgba($color-brand-negative, 0.2);
  color: $color-brand-negative;
}
</style>
