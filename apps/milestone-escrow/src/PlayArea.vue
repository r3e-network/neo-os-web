<template>
  <div class="milestone-escrow-play-area">
    <MilestoneHero
      :t="t"
      :progressPercent="progressPercent"
      :checkpoints="milestoneCheckpoints"
      :activeCount="activeCount"
      :completedCount="completedCount"
    />
    <EscrowBody
      :t="t"
      :contractReady="contractReady"
      :isRefreshing="isRefreshing"
      :hasAddress="hasAddress"
      :creatorEscrows="creatorEscrows"
      :beneficiaryEscrows="beneficiaryEscrows"
      :approvingId="approvingId"
      :cancellingId="cancellingId"
      :claimingId="claimingId"
      :statusLabelFunc="statusLabelFunc"
      :formatAmountFunc="formatAmountFunc"
      :formatAddressFunc="formatAddressFunc"
      @refresh="dispatch('refreshEscrows')"
      @connectWallet="dispatch('connectWallet')"
      @approve="dispatch('approveMilestone', $event)"
      @cancel="dispatch('cancelEscrow', $event)"
      @claim="dispatch('claimMilestone', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Composition root for Milestone Escrow
 *
 * Composes MilestoneHero and EscrowBody sub-components.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import MilestoneHero from "./components/MilestoneHero.vue";
import EscrowBody from "./components/EscrowBody.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const hasAddress = computed(() => Boolean(props.state.address?.value));
const contractReady = computed(() => Boolean(props.state.contractReady?.value ?? false));
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value ?? false));
const approvingId = computed(() => String(props.state.approvingId?.value ?? ""));
const cancellingId = computed(() => String(props.state.cancellingId?.value ?? ""));
const claimingId = computed(() => String(props.state.claimingId?.value ?? ""));

const creatorEscrows = computed(() => {
  const raw = props.state.creatorEscrows?.value;
  return Array.isArray(raw) ? raw : [];
});
const beneficiaryEscrows = computed(() => {
  const raw = props.state.beneficiaryEscrows?.value;
  return Array.isArray(raw) ? raw : [];
});

const activeCount = computed(() => creatorEscrows.value.filter((e: { status: string }) => e.status === "active").length);
const completedCount = computed(() => creatorEscrows.value.filter((e: { status: string }) => e.status === "completed").length);
const totalEscrows = computed(() => creatorEscrows.value.length);

const progressPercent = computed(() => {
  if (totalEscrows.value === 0) return 0;
  return Math.round((completedCount.value / totalEscrows.value) * 100);
});

const milestoneCheckpoints = computed(() => {
  const total = totalEscrows.value || 4;
  const steps = Math.min(total, 5);
  return Array.from({ length: steps }, (_, i) => ({
    position: ((i + 1) / steps) * 100,
    done: i < completedCount.value,
    label: `M${i + 1}`,
  }));
});

const statusLabelFunc = computed(() => {
  const fn = props.state.statusLabelFunc?.value;
  return typeof fn === "function" ? fn : (s: string) => s;
});
const formatAmountFunc = computed(() => {
  const fn = props.state.formatAmountFunc?.value;
  return typeof fn === "function" ? fn : (a: unknown) => String(a);
});
const formatAddressFunc = computed(() => {
  const fn = props.state.formatAddressFunc?.value;
  return typeof fn === "function" ? fn : (a: string) => a;
});

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const dispatch = async (name: string, payload?: unknown) => {
  const handler = actions.get(name);
  if (handler) await handler(payload);
};
</script>

<style lang="scss" scoped>
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&display=swap');

.milestone-escrow-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Work Sans', sans-serif;
  background: linear-gradient(170deg, #ECFDF5 0%, #F0FDF4 30%, #F8FAFC 100%);
  color: #1E293B;
  border-radius: 12px;
  border: 1px solid rgba(16, 185, 129, 0.15);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.milestone-escrow-play-area::before {
  content: "";
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 3px;
  background: linear-gradient(90deg,
    #10B981 0%,
    #10B981 25%,
    #F59E0B 25%,
    #F59E0B 50%,
    #D1D5DB 50%,
    #D1D5DB 100%
  );
  border-radius: 0 0 2px 2px;
  pointer-events: none;
}

.milestone-escrow-play-area::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(0deg, rgba(16, 185, 129, 0.03), transparent);
  pointer-events: none;
}
</style>
