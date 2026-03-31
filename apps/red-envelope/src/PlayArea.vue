<template>
  <div class="red-envelope-play-area">
    <LuckyOverlay :lucky-message="luckyMessage" @close="handleCloseLucky" />
    <OpeningModal
      :visible="showOpeningModal"
      :envelope="openingEnvelope"
      :is-connected="isConnected"
      :is-opening="isOpening"
      @connect="handleConnect"
      @open="handleOpenEnvelope"
      @close="handleCloseModal"
    />

    <div class="hero-container">
      <RedEnvelopeGraphic :is-opening="!!luckyMessage" />
      <EnvelopeStats
        :envelope-count="envelopeCount"
        :pool-count="poolCount"
        :claim-count="claimCount"
        :t="t"
      />
    </div>

    <!-- Create Form (operation panel inline) -->
    <CreateForm
      :is-loading="isLoading"
      v-model:name="formName"
      v-model:description="formDescription"
      v-model:amount="formAmount"
      v-model:count="formCount"
      v-model:expiryHours="formExpiryHours"
      v-model:minNeoRequired="formMinNeoRequired"
      v-model:minHoldDays="formMinHoldDays"
      v-model:envelopeType="formEnvelopeType"
      @create="handleCreate"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Red Envelope
 *
 * The ONLY custom component for the red-envelope miniapp. Composes
 * RedEnvelopeGraphic, EnvelopeStats, CreateForm, LuckyOverlay, and OpeningModal.
 * Everything else (sidebar, tabs, docs, shell chrome) is rendered by the
 * platform based on manifest.ts configuration.
 */
import { computed, inject, ref } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import LuckyOverlay from "./pages/index/components/LuckyOverlay.vue";
import OpeningModal from "./pages/index/components/OpeningModal.vue";
import CreateForm from "./pages/index/components/CreateForm.vue";
import RedEnvelopeGraphic from "./components/RedEnvelopeGraphic.vue";
import EnvelopeStats from "./components/EnvelopeStats.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// -- State bindings -----------------------------------------------------------
const envelopeCount = computed(() => Number(props.state.envelopeCount?.value ?? 0));
const poolCount = computed(() => Number(props.state.poolCount?.value ?? 0));
const claimCount = computed(() => Number(props.state.claimCount?.value ?? 0));
const luckyMessage = computed(() => (props.state.luckyMessage?.value as string | null) ?? null);
const showOpeningModal = computed(() => Boolean(props.state.showOpeningModal?.value ?? false));
const openingEnvelope = computed(() => props.state.openingEnvelope?.value ?? null);
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const isOpening = computed(() => Boolean(props.state.isOpening?.value ?? false));
const isLoading = computed(() => Boolean(props.state.isLoading?.value ?? false));

// -- Local form state (v-model) -----------------------------------------------
const formName = ref("");
const formDescription = ref("");
const formAmount = ref("");
const formCount = ref("");
const formExpiryHours = ref("");
const formMinNeoRequired = ref("");
const formMinHoldDays = ref("");
const formEnvelopeType = ref("spreading");

// -- Action dispatch ----------------------------------------------------------
const dispatch = (name: string, ...args: unknown[]) => actions.get(name)?.(...args);

const handleCloseLucky = () => dispatch("closeLucky");
const handleConnect = () => dispatch("connect");
const handleOpenEnvelope = () => dispatch("openEnvelope");
const handleCloseModal = () => dispatch("closeModal");
const handleCreate = () =>
  dispatch("create", {
    name: formName.value,
    description: formDescription.value,
    amount: formAmount.value,
    count: formCount.value,
    expiryHours: formExpiryHours.value,
    minNeoRequired: formMinNeoRequired.value,
    minHoldDays: formMinHoldDays.value,
    envelopeType: formEnvelopeType.value,
  });
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "./pages/index/red-envelope-theme.scss" as *;
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700;900&display=swap");

:global(body) {
  background: var(--bg-primary);
}

.red-envelope-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  position: relative;
  overflow: hidden;

  /* Chinese cloud pattern overlay */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(255, 215, 0, 0.06) 0%, transparent 40%),
      radial-gradient(ellipse at 15% 50%, rgba(220, 38, 38, 0.08) 0%, transparent 30%),
      radial-gradient(ellipse at 85% 50%, rgba(220, 38, 38, 0.08) 0%, transparent 30%);
    pointer-events: none;
  }

  /* Gold corner ornaments */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 215, 0, 0.2) 15%,
      rgba(255, 215, 0, 0.6) 30%,
      #ffd700 50%,
      rgba(255, 215, 0, 0.6) 70%,
      rgba(255, 215, 0, 0.2) 85%,
      transparent 100%
    );
  }
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 16px;
  gap: 24px;
  position: relative;
  z-index: 1;
}

/* Lucky red headings with gold accents */
:deep(h1),
:deep(h2),
:deep(h3),
:deep(.hero-title),
:deep(.section-title) {
  font-family: "Noto Serif SC", serif;
  font-weight: 700;
}

:deep(.hero-title),
:deep(h1) {
  color: #ffd700;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
}

/* Envelope stats gold on red */
:deep(.envelope-stats) {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 12px;
  background: rgba(153, 27, 27, 0.15);
}

:deep(.stat-value) {
  font-family: "Noto Serif SC", serif;
  color: #ffd700;
}

/* Create form golden trim */
:deep(.create-form) {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 12px;
  background: rgba(153, 27, 27, 0.08);
  box-shadow: 0 0 30px rgba(220, 38, 38, 0.06);
}

/* Red envelope graphic enhancement */
:deep(.red-envelope-graphic) {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 8px 25px rgba(220, 38, 38, 0.3));
}

/* Lucky overlay festive style */
:deep(.lucky-overlay) {
  font-family: "Noto Serif SC", serif;
}

/* Golden CTA button */
:deep(.neo-btn--primary) {
  font-family: "Noto Serif SC", serif;
  font-weight: 700;
  background: linear-gradient(180deg, #ffd700 0%, #b8860b 100%);
  color: #991b1b;
  border: 2px solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
  text-shadow: none;

  &:hover:not(:disabled) {
    box-shadow: 0 6px 25px rgba(255, 215, 0, 0.35), 0 0 40px rgba(220, 38, 38, 0.1);
    transform: translateY(-1px);
  }
}

/* Form inputs with subtle red tint */
:deep(input),
:deep(select),
:deep(textarea) {
  font-family: "Noto Serif SC", serif;
  border-color: rgba(255, 215, 0, 0.15);
  background: rgba(153, 27, 27, 0.06);

  &:focus {
    border-color: rgba(255, 215, 0, 0.4);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.1);
  }
}

/* Opening modal festive */
:deep(.opening-modal) {
  font-family: "Noto Serif SC", serif;
}

@media (max-width: 480px) {
  .hero-container {
    min-height: 250px;
    padding: 16px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.red-envelope-graphic) {
    filter: none;
  }
}
</style>
