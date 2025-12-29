<template>
  <view class="container">
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
        <text class="stat-value">{{ formatAmount(bNeoBalance) }}</text>
      </view>
      <view class="stat-card">
        <text class="stat-label">Your NEO</text>
        <text class="stat-value">{{ formatAmount(neoBalance) }}</text>
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
        <text class="balance-hint">Balance: {{ formatAmount(neoBalance) }} NEO</text>
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
        <text class="balance-hint">Balance: {{ formatAmount(bNeoBalance) }} bNEO</text>
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
    <view v-if="statusMessage" class="status" :class="statusType">
      <text>{{ statusMessage }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";

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
const statusMessage = ref("");
const statusType = ref<"success" | "error">("success");
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
function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function showStatus(message: string, type: "success" | "error") {
  statusMessage.value = message;
  statusType.value = type;
  setTimeout(() => (statusMessage.value = ""), 5000);
}

async function loadBalances() {
  try {
    const address = await getAddress();
    if (!address) return;

    const neo = await getBalance("NEO");
    const bneo = await getBalance(BNEO_CONTRACT);
    neoBalance.value = neo || 0;
    bNeoBalance.value = bneo || 0;
  } catch (e) {
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

<style lang="scss" scoped>
.container {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
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
  font-size: 24px;
  font-weight: 700;
  color: #00d4aa;
}

.subtitle {
  display: block;
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.apy-card {
  background: linear-gradient(135deg, #00d4aa20 0%, #00d4aa10 100%);
  border: 1px solid #00d4aa40;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  margin-bottom: 20px;
}

.apy-label {
  display: block;
  font-size: 12px;
  color: #00d4aa;
  margin-bottom: 4px;
}

.apy-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #00d4aa;
}

.tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}

.tab {
  flex: 1;
  padding: 12px;
  text-align: center;
  border-radius: 8px;
  color: #888;
  transition: all 0.2s;
}

.tab.active {
  background: #00d4aa;
  color: #0f0f1a;
  font-weight: 600;
}

.panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.input-group {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  font-size: 14px;
  color: #888;
  margin-bottom: 8px;
}

.input-row {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 24px;
  color: #fff;
  outline: none;
}

.token-label {
  font-size: 16px;
  color: #888;
  margin-left: 8px;
}

.balance-hint {
  display: block;
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.receive-info {
  background: rgba(0, 212, 170, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.receive-label {
  font-size: 14px;
  color: #888;
}

.receive-value {
  font-size: 16px;
  font-weight: 600;
  color: #00d4aa;
}

.action-btn {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.stake-btn {
  background: #00d4aa;
  color: #0f0f1a;
}

.unstake-btn {
  background: #ff6b6b;
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.status.success {
  background: rgba(0, 212, 170, 0.2);
  color: #00d4aa;
}

.status.error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}
</style>
