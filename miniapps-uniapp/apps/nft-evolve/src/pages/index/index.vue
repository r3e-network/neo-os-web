<template>
  <view class="app-container">
    <view class="header">
      <text class="title">NFT Evolve</text>
      <text class="subtitle">Level up your NFTs</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your NFTs</text>
      <view v-for="nft in nfts" :key="nft.id" class="nft-item" @click="selected = nft">
        <text class="nft-icon">{{ nft.icon }}</text>
        <view class="nft-info">
          <text class="nft-name">{{ nft.name }}</text>
          <text class="nft-level">Level {{ nft.level }}</text>
        </view>
        <view class="xp-bar">
          <view class="xp-fill" :style="{ width: nft.xp + '%' }"></view>
        </view>
      </view>
    </view>
    <uni-popup ref="popup" type="center" v-if="selected">
      <view class="evolve-modal">
        <text class="modal-title">Evolve {{ selected?.name }}?</text>
        <text class="modal-cost">Cost: {{ selected?.level * 5 }} GAS</text>
        <view class="modal-btns">
          <view class="cancel-btn" @click="selected = null"><text>Cancel</text></view>
          <view class="evolve-btn" @click="evolve"><text>Evolve</text></view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-nftevolve";
const { payGAS } = usePayments(APP_ID);

const nfts = ref([
  { id: "1", name: "Fire Dragon", icon: "🐉", level: 3, xp: 75 },
  { id: "2", name: "Ice Phoenix", icon: "🦅", level: 2, xp: 40 },
]);
const selected = ref<any>(null);
const status = ref<{ msg: string; type: string } | null>(null);

const evolve = async () => {
  if (!selected.value) return;
  try {
    await payGAS(String(selected.value.level * 5), `evolve:${selected.value.id}`);
    selected.value.level++;
    selected.value.xp = 0;
    status.value = { msg: `${selected.value.name} evolved!`, type: "success" };
    selected.value = null;
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
}
.card-title {
  color: $color-nft;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
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
.nft-level {
  color: $color-nft;
  font-size: 0.85em;
}
.xp-bar {
  width: 60px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}
.xp-fill {
  height: 100%;
  background: $color-nft;
}
.evolve-modal {
  background: $color-bg-secondary;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}
.modal-title {
  font-size: 1.2em;
  font-weight: bold;
  display: block;
  margin-bottom: 8px;
}
.modal-cost {
  color: $color-nft;
  display: block;
  margin-bottom: 16px;
}
.modal-btns {
  display: flex;
  gap: 12px;
}
.cancel-btn {
  flex: 1;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  text-align: center;
}
.evolve-btn {
  flex: 1;
  padding: 12px;
  background: $color-nft;
  border-radius: 10px;
  text-align: center;
  font-weight: bold;
}
</style>
