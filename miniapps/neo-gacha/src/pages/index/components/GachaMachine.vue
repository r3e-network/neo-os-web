<template>
  <view class="gacha-machine-view">
    <NeoCard variant="erobo" class="machine-meta">
      <text class="machine-title">{{ machine.name }}</text>
      <text class="machine-desc">{{ machine.description }}</text>
      <view class="machine-tags" v-if="tagList.length">
        <text v-for="tag in tagList" :key="tag" class="machine-tag">#{{ tag }}</text>
      </view>
      <view class="machine-stats">
        <text>{{ t("categoryLabel") }}: {{ machine.category || t("general") }}</text>
        <text>{{ t("playsLabel") }}: {{ machine.plays ?? 0 }}</text>
        <text>{{ t("revenueLabel") }}: {{ machine.revenue || "0" }} GAS</text>
      </view>
    </NeoCard>

    <NeoCard v-if="machine.forSale && !isOwner" variant="warning" class="sale-card">
      <view class="sale-row">
        <text class="sale-title">{{ t("machineForSale") }}</text>
        <text class="sale-price">{{ machine.salePrice }} GAS</text>
      </view>
      <NeoButton variant="primary" size="sm" block @click="$emit('buy')">
        {{ t("buyMachine") }}
      </NeoButton>
    </NeoCard>

    <NeoCard v-if="!machine.inventoryReady" variant="danger" class="sale-card">
      <text class="sale-title">{{ t("inventoryEmpty") }}</text>
    </NeoCard>

    <NeoCard variant="erobo-neo" class="machine-display">
      <view class="capsule-container">
        <view class="glass-dome">
          <view class="capsules-pile">
            <!-- Simulated capsules inside -->
            <view v-for="i in 5" :key="i" class="capsule-decoration" :style="getCapsuleStyle(i)">💊</view>
          </view>
        </view>
        <view class="machine-body">
          <view class="coin-slot" :class="{ pulse: !isPlaying }">
            <text class="slot-text">{{ t("playLabel") }} {{ machine.price }} GAS</text>
          </view>
          <view class="dispenser-chute">
            <view v-if="isPlaying" class="falling-capsule">💊</view>
          </view>
        </view>
      </view>

      <view class="machine-controls">
        <NeoButton
          variant="primary"
          size="lg"
          block
          :loading="isPlaying"
          :disabled="!machine.active || !machine.inventoryReady"
          @click="$emit('play')"
          class="play-btn"
        >
          {{ isPlaying ? t("rolling") : t("playNow") }}
        </NeoButton>
        <NeoButton variant="secondary" size="sm" block @click="$emit('back')" class="back-btn">
          {{ t("backToMarket") }}
        </NeoButton>
      </view>
    </NeoCard>

    <NeoCard v-if="errorMessage" variant="danger" class="status-card">
      <text class="status-text">{{ errorMessage }}</text>
    </NeoCard>

    <NeoCard variant="erobo" class="odds-info">
      <text class="section-title">{{ t("machineContents") }}</text>
      <view v-if="items.length === 0" class="empty-items">
        {{ t("noPrizes") }}
      </view>
      <view v-else class="odds-list">
        <view v-for="(item, idx) in items" :key="idx" class="odds-row">
          <view class="item-info">
            <text class="item-icon">{{ item.icon || "🎁" }}</text>
            <view class="item-text">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-meta">{{ formatMeta(item) }}</text>
              <text v-if="!item.available" class="item-stock">{{ t("outOfStock") }}</text>
            </view>
          </view>
          <text class="item-chance">{{ item.displayProbability || 0 }}%</text>
        </view>
      </view>
    </NeoCard>

    <NeoModal :visible="showResult" :title="t('congratulations')" @close="$emit('close-result')">
      <view class="result-content">
        <view class="result-icon-lg">{{ resultItem?.icon || "🎁" }}</view>
        <text class="result-name">{{ resultItem?.name }}</text>
        <text class="result-rarity">{{ resultItem?.rarity || t("prizeLabel") }}</text>
        <NeoButton block variant="primary" @click="$emit('close-result')" class="mt-4">
          {{ t("collect") }}
        </NeoButton>
      </view>
    </NeoModal>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton, NeoModal } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const props = defineProps<{
  machine: Record<string, unknown>;
  isPlaying: boolean;
  showResult: boolean;
  resultItem: Record<string, unknown> | null;
  isOwner?: boolean;
  errorMessage?: string | null;
}>();

defineEmits(["back", "play", "close-result", "buy"]);

const { t } = createUseI18n(messages)();

const getCapsuleStyle = (i: number) => {
  return {
    left: `${Math.random() * 60 + 20}%`,
    top: `${Math.random() * 60 + 20}%`,
    transform: `rotate(${Math.random() * 360}deg)`,
    animationDelay: `${Math.random() * 2}s`,
  };
};
const items = computed(() => (Array.isArray(props.machine?.items) ? props.machine.items : []));
const tagList = computed(() => (Array.isArray(props.machine?.tagsList) ? props.machine.tagsList : []));

const formatMeta = (item: Record<string, unknown>) => {
  const prizeLabel = t("prizeLabel");
  const rarity = item?.rarity ? String(item.rarity).toUpperCase() : prizeLabel.toUpperCase();
  const assetType = Number(item?.assetType || 0);
  const assetLabel = assetType === 2 ? "NEP-11" : assetType === 1 ? "NEP-17" : prizeLabel.toUpperCase();
  const amount = assetType === 1 ? ` · ${item.amountDisplay || item.amountRaw || 0}` : "";
  return `${rarity} · ${assetLabel}${amount}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.gacha-machine-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.machine-display {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.machine-meta {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.machine-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
}

.machine-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.machine-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.machine-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--gacha-tag-bg);
  color: var(--gacha-tag-text);
  border-radius: 6px;
}

.machine-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-secondary);
}

.sale-card {
  .sale-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-2;
  }
  .sale-title {
    font-weight: 700;
  }
  .sale-price {
    font-weight: 800;
    color: var(--gacha-accent-amber);
  }
}
.capsule-container {
  width: 200px;
  height: 300px;
  margin: 0 auto $spacing-4;
  position: relative;
}

.glass-dome {
  width: 200px;
  height: 200px;
  border-radius: 50% 50% 10% 10%;
  background: radial-gradient(circle at 30% 30%, var(--gacha-dome-sheen), var(--gacha-dome-tint));
  border: 1px solid var(--gacha-dome-border);
  box-shadow: var(--gacha-dome-shadow);
  position: relative;
  overflow: hidden;
  z-index: 2;
}

.capsules-pile {
  position: absolute;
  bottom: 10px;
  width: 100%;
  height: 60%;
}

.capsule-decoration {
  position: absolute;
  font-size: 24px;
  filter: var(--gacha-capsule-shadow);
}

.machine-body {
  height: 100px;
  background: var(--gacha-machine-body-bg);
  margin-top: -10px;
  border-radius: 0 0 12px 12px;
  border: 1px solid var(--gacha-machine-body-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
}

.coin-slot {
  width: 80%;
  height: 30px;
  background: var(--gacha-slot-bg);
  border: 1px solid var(--gacha-slot-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.pulse {
    animation: glow-pulse 2s infinite;
  }
}

.slot-text {
  font-size: 10px;
  color: var(--gacha-slot-text);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.dispenser-chute {
  width: 60px;
  height: 40px;
  background: var(--gacha-chute-bg);
  border-radius: 4px 4px 0 0;
  border: 1px solid var(--gacha-slot-border);
  position: relative;
}

.falling-capsule {
  position: absolute;
  font-size: 32px;
  left: 14px;
  animation: drop-bounce 0.8s ease-out forwards;
}

.machine-controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.play-btn {
  box-shadow: var(--gacha-play-shadow);
}

.status-card {
  .status-text {
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
}

.section-title {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 700;
  margin-bottom: $spacing-3;
  display: block;
}

.odds-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-items {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  padding: $spacing-4 0;
}

.odds-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--gacha-row-bg);
  border-radius: 6px;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-text {
  display: flex;
  flex-direction: column;
}

.item-name {
  color: var(--text-primary);
  font-size: 13px;
}

.item-meta {
  color: var(--text-secondary);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.item-stock {
  color: var(--gacha-danger-text);
  font-size: 10px;
}

.item-chance {
  color: var(--gacha-accent-green);
  font-weight: 700;
  font-size: 13px;
  font-family: $font-mono;
}

.result-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-4;
}

.result-icon-lg {
  font-size: 64px;
  margin-bottom: $spacing-4;
  animation: bounce 1s infinite;
}

.result-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.result-rarity {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--gacha-accent-yellow);
  letter-spacing: 0.1em;
  font-weight: 700;
}

@keyframes drop-bounce {
  0% {
    top: -50px;
    opacity: 0;
  }
  60% {
    top: 10px;
    opacity: 1;
  }
  80% {
    top: 0px;
  }
  100% {
    top: 10px;
  }
}

@keyframes glow-pulse {
  0% {
    border-color: var(--gacha-slot-border);
    box-shadow: none;
  }
  50% {
    border-color: var(--gacha-glow-border);
    box-shadow: var(--gacha-glow-shadow);
  }
  100% {
    border-color: var(--gacha-slot-border);
    box-shadow: none;
  }
}
</style>
