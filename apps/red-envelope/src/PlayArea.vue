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

:global(body) {
  background: var(--bg-primary);
}

.red-envelope-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
}

@media (max-width: 480px) {
  .hero-container {
    min-height: 250px;
    padding: 16px 12px;
  }
}
</style>
