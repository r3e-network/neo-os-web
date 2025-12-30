<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Heritage Trust</text>
      <text class="subtitle">Digital inheritance system</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your Trusts</text>
      <view v-for="trust in trusts" :key="trust.id" class="trust-item">
        <text class="trust-icon">{{ trust.icon }}</text>
        <view class="trust-info">
          <text class="trust-name">{{ trust.name }}</text>
          <text class="trust-beneficiary">To: {{ trust.beneficiary }}</text>
        </view>
        <view class="trust-value">
          <text>{{ trust.value }} GAS</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Create Trust</text>
      <uni-easyinput v-model="newTrust.name" placeholder="Trust name" class="input-field" />
      <uni-easyinput v-model="newTrust.beneficiary" placeholder="Beneficiary address" class="input-field" />
      <uni-easyinput v-model="newTrust.value" type="number" placeholder="Amount (GAS)" class="input-field" />
      <view class="info-row">
        <text class="info-icon">ℹ️</text>
        <text class="info-text">Trust activates after 90 days of inactivity</text>
      </view>
      <view class="create-btn" @click="create" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Creating..." : "Create Trust" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-heritagetrust";
const { payGAS, isLoading } = usePayments(APP_ID);

interface Trust {
  id: string;
  name: string;
  beneficiary: string;
  value: number;
  icon: string;
}

const trusts = ref<Trust[]>([
  { id: "1", name: "Family Fund", beneficiary: "NXXx...abc", value: 100, icon: "👨‍👩‍👧" },
  { id: "2", name: "Charity", beneficiary: "NXXx...def", value: 50, icon: "❤️" },
]);
const newTrust = ref({ name: "", beneficiary: "", value: "" });
const status = ref<{ msg: string; type: string } | null>(null);

const create = async () => {
  if (isLoading.value || !newTrust.value.name || !newTrust.value.beneficiary || !newTrust.value.value) return;
  try {
    status.value = { msg: "Creating trust...", type: "loading" };
    await payGAS(newTrust.value.value, `trust:${Date.now()}`);
    trusts.value.push({
      id: Date.now().toString(),
      name: newTrust.value.name,
      beneficiary: newTrust.value.beneficiary,
      value: parseFloat(newTrust.value.value),
      icon: "📜",
    });
    status.value = { msg: "Trust created!", type: "success" };
    newTrust.value = { name: "", beneficiary: "", value: "" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: #fff;
  padding: 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-nft;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}
.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}
.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}
.card-title {
  color: $color-nft;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}
.trust-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.trust-icon {
  font-size: 1.5em;
  margin-right: 12px;
}
.trust-info {
  flex: 1;
}
.trust-name {
  display: block;
  font-weight: bold;
}
.trust-beneficiary {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.trust-value {
  color: $color-nft;
  font-weight: bold;
}
.input-field {
  margin-bottom: 12px;
}
.info-row {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
}
.info-icon {
  font-size: 1.2em;
  margin-right: 8px;
}
.info-text {
  color: $color-text-secondary;
  font-size: 0.85em;
  flex: 1;
}
.create-btn {
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
