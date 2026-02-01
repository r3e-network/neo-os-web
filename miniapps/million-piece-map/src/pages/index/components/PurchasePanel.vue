<template>
  <NeoCard variant="erobo-neo">
    <TileInfo
      :selected-tile="selectedTile"
      :selected-x="selectedX"
      :selected-y="selectedY"
      :is-owned="isOwned"
      :tile-price="tilePrice"
      :t="t"
    />
    <NeoButton
      variant="primary"
      size="lg"
      block
      :loading="isPurchasing"
      :disabled="isOwned"
      @click="$emit('purchase')"
      class="purchase-btn"
    >
      {{ isPurchasing ? t("claiming") : isOwned ? t("alreadyClaimed") : t("claimNow") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import TileInfo from "./TileInfo.vue";

defineProps<{
  selectedTile: number;
  selectedX: number;
  selectedY: number;
  isOwned: boolean;
  tilePrice: number;
  isPurchasing: boolean;
  t: (key: string) => string;
}>();

defineEmits(["purchase"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.purchase-btn {
  margin-top: 16px;
}

:global(.theme-million-piece) :deep(.neo-button) {
  border-radius: 4px !important;
  font-family: "Times New Roman", serif !important;
  text-transform: uppercase;
  font-weight: 800 !important;
  letter-spacing: 0.1em;

  &.variant-primary {
    background: var(--map-red) !important;
    color: var(--map-button-text) !important;
    border: 2px solid var(--map-border) !important;
    box-shadow: 4px 4px 0 var(--map-border) !important;

    &:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 var(--map-border) !important;
    }
  }
}
</style>
