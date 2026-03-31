<template>
  <div class="tarot-play-area">
    <div class="cosmic-bg">
      <div class="star star-1"></div>
      <div class="star star-2"></div>
      <div class="star star-3"></div>
      <div class="star star-4"></div>
      <div class="star star-5"></div>
    </div>

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
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&display=swap");

.tarot-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  position: relative;
  overflow: hidden;
  font-family: "Cinzel", serif;

  /* Deep indigo cosmic background */
  background:
    radial-gradient(ellipse at 50% 20%, rgba(99, 70, 180, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 20% 80%, rgba(49, 46, 129, 0.12) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 70%, rgba(139, 92, 246, 0.08) 0%, transparent 35%);
}

/* Cosmic star field */
.cosmic-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #e8d5b7;
  border-radius: 50%;
  animation: twinkle 3s ease-in-out infinite;

  &::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -1px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(232, 213, 183, 0.4), transparent);
  }
}

.star-1 {
  top: 8%;
  left: 15%;
  animation-delay: 0s;
}

.star-2 {
  top: 22%;
  right: 12%;
  animation-delay: 0.8s;
  width: 3px;
  height: 3px;
}

.star-3 {
  top: 55%;
  left: 8%;
  animation-delay: 1.6s;
}

.star-4 {
  top: 70%;
  right: 20%;
  animation-delay: 2.4s;
  width: 1px;
  height: 1px;
}

.star-5 {
  top: 40%;
  left: 75%;
  animation-delay: 0.4s;
  width: 2px;
  height: 2px;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.5);
  }
}

/* Mystical headings */
:deep(h1),
:deep(h2),
:deep(h3),
:deep(.hero-title),
:deep(.tarot-title) {
  font-family: "Cinzel", serif;
  font-weight: 700;
  color: #e8d5b7;
  text-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
  letter-spacing: 0.08em;
}

/* Tarot hero mystic glow */
:deep(.tarot-hero) {
  position: relative;
  z-index: 1;
}

/* Game area ornate frame */
:deep(.game-area) {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 12px;
  background: rgba(49, 46, 129, 0.08);
  box-shadow:
    0 0 30px rgba(139, 92, 246, 0.06),
    inset 0 0 30px rgba(49, 46, 129, 0.05);
}

/* Reading display mystical */
:deep(.reading-display) {
  position: relative;
  z-index: 1;
  font-family: "Cinzel", serif;
  border: 1px solid rgba(232, 213, 183, 0.15);
  border-radius: 12px;
  background: rgba(49, 46, 129, 0.1);
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.08);
  padding: 20px;

  &::before {
    content: "\2727";
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 20px;
    color: #e8d5b7;
    text-shadow: 0 0 10px rgba(232, 213, 183, 0.6);
  }
}

/* Tarot card flip interaction */
:deep(.tarot-card) {
  transition: transform 0.6s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(139, 92, 246, 0.3);
  }
}

/* Tarot actions */
:deep(.tarot-actions) {
  position: relative;
  z-index: 1;
}

:deep(.neo-btn--primary) {
  font-family: "Cinzel", serif;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #7c3aed 0%, #312e81 100%);
  border: 1px solid rgba(232, 213, 183, 0.2);
  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.25);
  color: #e8d5b7;

  &:hover:not(:disabled) {
    box-shadow: 0 6px 30px rgba(124, 58, 237, 0.4), 0 0 50px rgba(139, 92, 246, 0.12);
    transform: translateY(-1px);
    border-color: rgba(232, 213, 183, 0.35);
  }
}

/* Question input ethereal */
:deep(input[type="text"]),
:deep(textarea) {
  font-family: "Cinzel", serif;
  background: rgba(49, 46, 129, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.2);
  color: #e8d5b7;

  &::placeholder {
    color: rgba(232, 213, 183, 0.35);
    font-style: italic;
  }

  &:focus {
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .star {
    animation: none;
    opacity: 0.6;
  }
  :deep(.tarot-card) {
    transition: none;
  }
}
</style>
