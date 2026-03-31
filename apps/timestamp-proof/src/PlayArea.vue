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

.proof-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.proof-list-container {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  font-size: 14px;
}
</style>
