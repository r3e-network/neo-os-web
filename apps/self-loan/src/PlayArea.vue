<template>
  <div class="loan-play-area">
    <!-- ── Wallet Prompt ── -->
    <div v-if="!isConnected" class="wallet-prompt mb-4">
      <NeoCard variant="warning" class="text-center">
        <span class="mb-2 block font-bold">{{ t("connectWalletToUse") }}</span>
        <NeoButton type="button" variant="primary" size="sm" @click="handleAction('connectWallet')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <!-- ── Hero Container ── -->
    <div class="hero-container">
      <CollateralDashboard
        :t="t"
        :collateralDisplay="collateralDisplay"
        :borrowedDisplay="borrowedDisplay"
        :healthFactorDisplay="healthFactorDisplay"
        :healthColor="healthColor"
        :healthArc="healthArc"
      />
      <LtvBar
        :t="t"
        :currentLTVDisplay="currentLTVDisplay"
        :currentLTV="currentLTV"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Composition root for Self-Loan
 *
 * Composes CollateralDashboard (locked/borrowed/gauge) and LtvBar.
 * All computation lives in composables/useSelfLoan.ts.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import CollateralDashboard from "./components/CollateralDashboard.vue";
import LtvBar from "./components/LtvBar.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const collateralDisplay = computed(() => String(props.state.collateralDisplay?.value ?? "0"));
const borrowedDisplay = computed(() => String(props.state.borrowedDisplay?.value ?? "0"));
const healthFactorDisplay = computed(() => String(props.state.healthFactorDisplay?.value ?? t("notAvailable")));
const currentLTVDisplay = computed(() => String(props.state.currentLTVDisplay?.value ?? t("notAvailable")));
const currentLTV = computed(() => Number(props.state.currentLTV?.value ?? 0));
const healthColor = computed(() => String(props.state.healthColor?.value ?? "rgba(255,255,255,0.2)"));
const healthArc = computed(() => Number(props.state.healthArc?.value ?? 0));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleAction = async (name: string) => {
  const handler = actions.get(name);
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.loan-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.wallet-prompt {
  margin-bottom: 16px;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 12px;
  gap: 24px;
  background:
    radial-gradient(ellipse at 30% 50%, rgba(0, 229, 153, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 50%, rgba(99, 102, 241, 0.06) 0%, transparent 50%);
}
</style>
