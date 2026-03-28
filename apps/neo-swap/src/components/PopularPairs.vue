<template>
  <NeoCard variant="erobo" :title="t('popularPairs')">
    <div class="pair-list">
      <div
        v-for="pair in popularPairs"
        :key="pair.id"
        class="pair-item"
        :class="{ active: selectedPair === pair.id }"
        @click="handleSelectPair(pair.id)"
      >
        <div class="pair-info">
          <span class="pair-name">{{ pair.name }}</span>
          <span class="pair-rate">{{ pair.rate }}</span>
        </div>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { NeoCard } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedPair: string;
  popularPairs: Array<{ id: string; name: string; rate: string }>;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleSelectPair = (pairId: string) => {
  const handler = actions.get("selectPair");
  if (handler) handler(pairId);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/neo-swap-theme.scss" as *;

.pair-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pair-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card-hover, rgba(255, 255, 255, 0.03));
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--border-subtle, rgba(255, 255, 255, 0.08));
  }

  &.active {
    background: var(--swap-accent-soft);
    border-color: var(--swap-accent);
  }
}

.pair-info {
  flex: 1;
}

.pair-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--swap-text);
  display: block;
}

.pair-rate {
  font-size: 12px;
  color: var(--swap-text-muted);
}
</style>
