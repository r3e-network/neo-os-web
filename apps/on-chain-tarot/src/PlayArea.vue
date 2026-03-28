<template>
  <div class="tarot-play-area">
    <TarotHero
      :t="t"
      :readings-count="readingsCount"
      :cards-drawn-count="cardsDrawnCount"
      :has-drawn="hasDrawn"
    />

    <GameArea
      v-model:question="localQuestion"
      :drawn="drawn"
      :has-drawn="hasDrawn"
      :is-loading="isLoading"
      :t="t"
      @draw="handleDraw"
      @reset="handleReset"
      @flip="handleFlip"
    />

    <ReadingDisplay v-if="hasDrawn && allFlipped" :reading="reading" role="status" aria-live="polite" />

    <TarotActions
      :t="t"
      :is-loading="isLoading"
      :has-drawn="hasDrawn"
      @draw="handleDraw"
      @reset="handleReset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import GameArea from "./pages/index/components/GameArea.vue";
import ReadingDisplay from "./pages/index/components/ReadingDisplay.vue";
import TarotHero from "./components/TarotHero.vue";
import TarotActions from "./components/TarotActions.vue";
import type { Card } from "./pages/index/components/TarotCard.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const drawn = computed(() => (props.state.drawn?.value ?? []) as Card[]);
const hasDrawn = computed(() => Boolean(props.state.hasDrawn?.value ?? false));
const allFlipped = computed(() => Boolean(props.state.allFlipped?.value ?? false));
const readingsCount = computed(() => Number(props.state.readingsCount?.value ?? 0));
const cardsDrawnCount = computed(() => Number(props.state.cardsDrawnCount?.value ?? 0));
const isLoading = computed(() => Boolean(props.state.isLoading?.value ?? false));
const reading = computed(() => String(props.state.reading?.value ?? ""));

const localQuestion = ref("");
watch(localQuestion, (val) => {
  const handler = actions.get("updateQuestion");
  if (handler) handler(val);
});

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleDraw = async () => {
  const handler = actions.get("draw");
  if (handler) await handler();
};
const handleReset = () => {
  const handler = actions.get("reset");
  if (handler) handler();
  localQuestion.value = "";
};
const handleFlip = (index: number) => {
  const handler = actions.get("flipCard");
  if (handler) handler(index);
};
</script>

<style lang="scss" scoped>
.tarot-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
