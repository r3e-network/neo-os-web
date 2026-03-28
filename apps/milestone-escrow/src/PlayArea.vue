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
.milestone-escrow-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
