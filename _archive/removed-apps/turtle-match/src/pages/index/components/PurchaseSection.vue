<template>
  <div class="purchase-section">
    <div class="purchase-grid">
      <GradientCard variant="erobo-neo" class="purchase-card">
        <div class="purchase-section__content">
          <span class="purchase-section__title">{{ t("buyBlindbox") }}</span>
          <span class="purchase-section__price">0.1 GAS / {{ t("box") }}</span>

          <div class="purchase-section__counter">
            <div class="counter-btn" @click="decreaseCount">
              <span class="btn-icon">-</span>
            </div>
            <span class="counter-value">{{ boxCount }}</span>
            <div class="counter-btn" @click="increaseCount">
              <span class="btn-icon">+</span>
            </div>
          </div>

          <div class="purchase-section__total">
            <span class="total-label">{{ t("totalPrice") }}</span>
            <span class="total-value">{{ totalCost }} GAS</span>
          </div>

          <NeoButton variant="primary" size="lg" block @click="$emit('start')" :loading="loading">{{
            t("startGame")
          }}</NeoButton>
        </div>
      </GradientCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GradientCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

interface Props {
  boxCount: number;
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  start: [];
  "update:boxCount": [value: number];
}>();

const totalCost = computed(() => {
  const price = 0.1;
  return (price * props.boxCount).toFixed(1);
});

function increaseCount() {
  if (props.boxCount < 20) emit("update:boxCount", props.boxCount + 1);
}

function decreaseCount() {
  if (props.boxCount > 3) emit("update:boxCount", props.boxCount - 1);
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.purchase-grid {
  padding: 0 20px;
}

.purchase-card {
  border: 1px solid var(--turtle-primary-border);
}

.purchase-section__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
}

.purchase-section__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--turtle-text);
  letter-spacing: 1px;
}

.purchase-section__price {
  font-size: 12px;
  font-weight: 700;
  color: var(--turtle-primary);
  background: var(--turtle-primary-soft);
  padding: 4px 12px;
  border-radius: 20px;
}

.purchase-section__counter {
  display: flex;
  align-items: center;
  gap: 30px;
  background: var(--turtle-panel-bg);
  padding: 8px 16px;
  border-radius: 40px;
  border: 1px solid var(--turtle-panel-border);
}

.counter-btn {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background: linear-gradient(135deg, var(--turtle-primary) 0%, var(--turtle-primary-strong) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--turtle-primary-glow-strong);

  &:active {
    transform: scale(0.95);
  }
}

.btn-icon {
  color: var(--turtle-text);
  font-size: 24px;
  font-weight: 800;
}

.counter-value {
  font-size: 40px;
  font-weight: 900;
  color: var(--turtle-text);
  min-width: 80px;
  text-align: center;
}

.purchase-section__total {
  text-align: center;
}

.total-label {
  font-size: 12px;
  color: var(--turtle-text-muted);
  display: block;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.total-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--turtle-accent);
}

@media (max-width: 767px) {
  .purchase-grid {
    padding: 0 12px;
  }

  .purchase-section__counter {
    gap: 20px;
  }

  .counter-value {
    font-size: 32px;
    min-width: 60px;
  }

  .counter-btn {
    width: 40px;
    height: 40px;
  }
}

@media (min-width: 1024px) {
  .purchase-section__content {
    max-width: 500px;
    margin: 0 auto;
  }
}
</style>
