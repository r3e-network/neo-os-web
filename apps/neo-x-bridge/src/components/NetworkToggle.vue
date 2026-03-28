<template>
  <div class="network-toggle">
    <button
      :class="['toggle-btn', { active: selectedNetwork === 'mainnet' }]"
      @click="$emit('select', 'mainnet')"
    >
      {{ t("mainnet") }}
    </button>
    <button
      :class="['toggle-btn', { active: selectedNetwork === 'testnet' }]"
      @click="$emit('select', 'testnet')"
    >
      {{ t("testnet") }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedNetwork: string;
}>();

defineEmits<{
  select: [network: string];
}>();
</script>

<style lang="scss" scoped>
.network-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.toggle-btn {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.3s ease;

  &.active {
    background: rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);
    color: var(--text-primary);
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toggle-btn {
    transition: none;
  }
}
</style>
