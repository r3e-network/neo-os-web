<template>
  <div class="proof-play-area">
    <ProofHero :t="t" :total-proofs="totalProofs" :your-proofs="yourProofs" />

    <ProofQuickStats :t="t" :total-proofs="totalProofs" :your-proofs="yourProofs" />

    <!-- Proof List -->
    <div class="proof-list-container">
      <div v-if="totalProofs === 0" class="empty-state">
        <span>{{ t("noProofs", { fallback: "No proofs yet" }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Timestamp Proof
 *
 * Renders the stamp-seal hero section with proof counts,
 * quick stats, and the proof list display.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import ProofHero from "./components/ProofHero.vue";
import ProofQuickStats from "./components/ProofQuickStats.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const totalProofs = computed(() => Number(props.state.totalProofs?.value ?? 0));
const yourProofs = computed(() => Number(props.state.yourProofs?.value ?? 0));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&display=swap');

.proof-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Merriweather', Georgia, serif;
  background: linear-gradient(170deg, #1E3A5F 0%, #162D4A 40%, #0F2035 100%);
  color: #CBD5E1;
  border-radius: 12px;
  border: 1px solid rgba(212, 168, 83, 0.2);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.proof-play-area::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border: 2px solid rgba(212, 168, 83, 0.06);
  border-radius: 50%;
  pointer-events: none;
}

.proof-play-area::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  border: 1px solid rgba(212, 168, 83, 0.04);
  border-radius: 50%;
  pointer-events: none;
}

.proof-list-container {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 168, 83, 0.12);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(4px);
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: rgba(203, 213, 225, 0.4);
  font-size: 14px;
  font-style: italic;
}
</style>
