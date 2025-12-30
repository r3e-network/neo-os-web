<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Melting Asset</text>
      <text class="subtitle">NFTs that decay over time</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your Melting NFTs</text>
      <view v-for="nft in nfts" :key="nft.id" class="nft-item">
        <text class="nft-icon">{{ nft.icon }}</text>
        <view class="nft-info">
          <text class="nft-name">{{ nft.name }}</text>
          <text class="nft-decay">{{ nft.health }}% integrity</text>
        </view>
        <view class="health-bar">
          <view class="health-fill" :style="{ width: nft.health + '%', background: getHealthColor(nft.health) }"></view>
        </view>
        <view class="restore-btn" @click="restore(nft)">
          <text>🔧</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Mint New Asset</text>
      <text class="info-text">New assets start at 100% and decay 1% per hour</text>
      <view class="mint-btn" @click="mint" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Minting..." : "Mint Asset (8 GAS)" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-meltingasset";
const { payGAS, isLoading } = usePayments(APP_ID);

interface Asset {
  id: string;
  name: string;
  icon: string;
  health: number;
  lastUpdate: number;
}

const nfts = ref<Asset[]>([
  { id: "1", name: "Ice Sculpture", icon: "🧊", health: 65, lastUpdate: Date.now() },
  { id: "2", name: "Sand Castle", icon: "🏰", health: 42, lastUpdate: Date.now() },
]);
const status = ref<{ msg: string; type: string } | null>(null);

const getHealthColor = (health: number) => {
  if (health > 70) return "#22c55e";
  if (health > 40) return "#f59e0b";
  return "#ef4444";
};

const updateDecay = () => {
  nfts.value.forEach((nft) => {
    const elapsed = Date.now() - nft.lastUpdate;
    const decay = Math.floor(elapsed / 3600000);
    nft.health = Math.max(0, nft.health - decay);
    nft.lastUpdate = Date.now();
  });
};

const restore = async (nft: Asset) => {
  try {
    status.value = { msg: "Restoring...", type: "loading" };
    await payGAS("3", `restore:${nft.id}`);
    nft.health = Math.min(100, nft.health + 25);
    nft.lastUpdate = Date.now();
    status.value = { msg: "Asset restored!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const mint = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Minting...", type: "loading" };
    await payGAS("8", `mint:${Date.now()}`);
    const icons = ["🧊", "🏰", "🌸", "🍦", "❄️"];
    nfts.value.push({
      id: Date.now().toString(),
      name: "New Asset",
      icon: icons[Math.floor(Math.random() * icons.length)],
      health: 100,
      lastUpdate: Date.now(),
    });
    status.value = { msg: "Asset minted!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

let timer: number;
onMounted(() => {
  timer = setInterval(updateDecay, 60000);
});
onUnmounted(() => clearInterval(timer));
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
.nft-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.nft-icon {
  font-size: 2em;
  margin-right: 12px;
}
.nft-info {
  flex: 1;
}
.nft-name {
  display: block;
  font-weight: bold;
}
.nft-decay {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.health-bar {
  width: 80px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-right: 12px;
}
.health-fill {
  height: 100%;
  transition:
    width 0.3s,
    background 0.3s;
}
.restore-btn {
  width: 36px;
  height: 36px;
  background: rgba($color-nft, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
}
.info-text {
  display: block;
  color: $color-text-secondary;
  font-size: 0.85em;
  margin-bottom: 16px;
  text-align: center;
}
.mint-btn {
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
