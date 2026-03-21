<template>
  <NeoCard variant="erobo" class="mystical-card">
    <div class="question-input">
      <NeoInput
        :modelValue="question"
        @update:modelValue="$emit('update:question', $event)"
        :placeholder="t('questionPlaceholder')"
      />
    </div>
    <div class="card-spread-container">
      <div class="spread-labels">
        <span class="spread-label-glass">{{ t("past") }}</span>
        <span class="spread-label-glass">{{ t("present") }}</span>
        <span class="spread-label-glass">{{ t("future") }}</span>
      </div>

      <div class="cards-row">
        <template v-if="drawn.length > 0">
          <TarotCard v-for="(card, i) in drawn" :key="card.id ?? i" :card="card" @flip="$emit('flip', i)" />
        </template>
        <template v-else>
          <div v-for="i in 3" :key="`placeholder-${i}`" class="card-placeholder">
            <div class="placeholder-icon">N3</div>
          </div>
        </template>
      </div>
    </div>

    <div class="action-buttons">
      <NeoButton v-if="!hasDrawn" variant="primary" size="lg" block :loading="isLoading" @click="$emit('draw')">
        {{ t("drawCards") }}
      </NeoButton>
      <NeoButton v-else variant="secondary" size="lg" block @click="$emit('reset')">
        {{ t("drawAgain") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput } from "@shared/components";
import TarotCard, { type Card } from "./TarotCard.vue";

defineProps<{
  question: string;
  drawn: Card[];
  hasDrawn: boolean;
  isLoading: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits<{
  (e: "update:question", value: string): void;
  (e: "draw"): void;
  (e: "reset"): void;
  (e: "flip", index: number): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.mystical-card {
  padding: 24px;
}

.question-input {
  margin-bottom: 24px;
}

.spread-labels {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.spread-label-glass {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 99px;
  letter-spacing: 0.1em;
  backdrop-filter: blur(10px);
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
}

.cards-row {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
  min-height: 200px; /* Reserve space for cards */
}

.card-placeholder {
  width: 100px; /* Should match TarotCard width approximately */
  height: 160px;
  border: 2px dashed rgba(155, 81, 224, 0.3);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);

  .placeholder-icon {
    font-size: 24px;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.1);
    letter-spacing: 2px;
  }
}
</style>
