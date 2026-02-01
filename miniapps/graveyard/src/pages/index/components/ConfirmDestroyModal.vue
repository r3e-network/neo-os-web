<template>
  <view v-if="show" class="confirm-overlay" @click="$emit('cancel')">
    <view class="confirm-modal" @click.stop>
      <view class="confirm-skull">💀</view>
      <text class="confirm-title">{{ t("confirmTitle") }}</text>
      <text class="confirm-text">{{ t("confirmText") }}</text>
      <view class="confirm-hash">{{ assetHash }}</view>
      <view class="confirm-actions">
        <NeoButton variant="secondary" @click="$emit('cancel')">
          {{ t("cancel") }}
        </NeoButton>
        <NeoButton variant="danger" @click="$emit('confirm')">
          {{ t("confirmDestroy") }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  show: boolean;
  assetHash: string;
  t: (key: string) => string;
}>();

defineEmits(["cancel", "confirm"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--grave-overlay, rgba(0, 0, 0, 0.9));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: $space-4;
}
.confirm-modal {
  background: var(--bg-card, white);
  border: 6px solid var(--border-color, black);
  padding: $space-10;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 20px 20px 0 var(--shadow-color, black);
  color: var(--text-primary, black);
}
.confirm-skull {
  font-size: 80px;
  display: block;
  margin-bottom: $space-6;
}
.confirm-title {
  font-size: 28px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  margin-bottom: $space-4;
  color: var(--text-primary, black);
  font-style: italic;
}
.confirm-text {
  font-size: 14px;
  font-weight: $font-weight-black;
  margin-bottom: $space-6;
  text-transform: uppercase;
}
.confirm-hash {
  font-family: $font-mono;
  font-size: 12px;
  background: var(--bg-elevated, #f0f0f0);
  padding: $space-4;
  border: 3px solid var(--border-color, black);
  word-break: break-all;
  margin-bottom: $space-8;
  font-weight: $font-weight-bold;
  color: var(--text-primary, black);
}
.confirm-actions {
  display: flex;
  gap: $space-6;
}
</style>
