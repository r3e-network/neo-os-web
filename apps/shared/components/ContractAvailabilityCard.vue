<script setup lang="ts">
import NeoCard from "./NeoCard.vue";

interface Props {
  title: string;
  description: string;
  compact?: boolean;
  eyebrowKey?: string;
  t?: (key: string) => string;
}

const props = withDefaults(defineProps<Props>(), {
  eyebrowKey: "onChainStatus",
});
</script>

<template>
  <NeoCard
    variant="erobo"
    class="contract-availability-card"
    :class="{ 'contract-availability-card--compact': compact }"
    :aria-label="title"
  >
    <span class="contract-availability-card__eyebrow">{{ props.t ? props.t(props.eyebrowKey) : props.eyebrowKey }}</span>
    <h3 class="contract-availability-card__title">{{ title }}</h3>
    <p class="contract-availability-card__description">{{ description }}</p>
  </NeoCard>
</template>

<style lang="scss" scoped>
.contract-availability-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 55%),
    rgba(10, 14, 24, 0.68);
}

.contract-availability-card--compact {
  min-height: auto;
}

.contract-availability-card__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.7;
}

.contract-availability-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.contract-availability-card__description {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.82;
}
</style>
