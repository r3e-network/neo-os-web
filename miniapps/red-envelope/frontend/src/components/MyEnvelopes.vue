<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useWallet } from "@/composables/useWallet";
import { useRedEnvelope, type EnvelopeItem } from "@/composables/useRedEnvelope";
import { useI18n } from "@/composables/useI18n";
import { formatGas, extractError } from "@/utils/format";
import OpeningModal from "./OpeningModal.vue";
import TransferModal from "./TransferModal.vue";

const { t } = useI18n();
const { address, connected } = useWallet();
const { envelopes, loadingEnvelopes, loadEnvelopes, reclaimEnvelope } = useRedEnvelope();

const selectedEnvelope = ref<EnvelopeItem | null>(null);
const showOpenModal = ref(false);
const showTransferModal = ref(false);
const actionStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);

onMounted(() => {
  if (connected.value) loadEnvelopes();
});

// ── Pre-computed enriched list (eliminates repeated calls in template) ──
type EnrichedEnvelope = EnvelopeItem & {
  isActive: boolean;
  progress: number;
  status: string;
  role: { text: string; cls: string } | null;
  countdown: { text: string; urgent: boolean } | null;
  showOpen: boolean;
  showTransfer: boolean;
  showReclaim: boolean;
  holdDays: number;
};

const enrichedEnvelopes = computed<EnrichedEnvelope[]>(() =>
  envelopes.value.map((env) => {
    const addr = address.value;
    const holder = addr && env.currentHolder === addr;
    const creator = addr && env.creator === addr;
    const active = env.active && !env.expired && !env.depleted;

    // Role
    let role: EnrichedEnvelope["role"] = null;
    if (creator) role = { text: t("youAreCreator"), cls: "role-creator" };
    else if (holder) role = { text: t("youAreHolder"), cls: "role-holder" };

    // Countdown
    let countdown: EnrichedEnvelope["countdown"] = null;
    if (env.expired) {
      countdown = { text: t("expiredLabel"), urgent: true };
    } else if (env.expiryTime) {
      const diff = env.expiryTime - Date.now();
      if (diff <= 0) {
        countdown = { text: t("expiredLabel"), urgent: true };
      } else {
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        countdown = { text: t("daysRemaining", days, hours), urgent: days === 0 && hours < 6 };
      }
    }

    // Status label
    let status = t("active");
    if (!env.active || env.depleted) status = t("depleted");
    else if (env.expired) status = t("expired");

    return {
      ...env,
      isActive: active,
      progress: env.packetCount > 0 ? Math.round((env.openedCount / env.packetCount) * 100) : 0,
      status,
      role,
      countdown,
      showOpen: active && !!holder,
      showTransfer: !!holder && env.active && !env.expired,
      showReclaim: env.active && env.expired && env.remainingAmount > 0 && !!creator,
      holdDays: Math.floor(env.minHoldSeconds / 86400),
    };
  })
);

// ── Actions ──
const handleOpen = (env: EnvelopeItem) => {
  selectedEnvelope.value = env;
  showOpenModal.value = true;
};

const handleTransfer = (env: EnvelopeItem) => {
  selectedEnvelope.value = env;
  showTransferModal.value = true;
};

const handleReclaim = async (env: EnvelopeItem) => {
  actionStatus.value = null;
  try {
    await reclaimEnvelope(env.id);
    actionStatus.value = { msg: t("reclaimSuccess", formatGas(env.remainingAmount)), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    actionStatus.value = { msg: extractError(e), type: "error" };
  }
};
</script>

<template>
  <div class="my-envelopes">
    <div class="toolbar">
      <h2>{{ t("myTab") }}</h2>
      <button class="btn btn-sm" @click="loadEnvelopes">↻</button>
    </div>

    <div v-if="loadingEnvelopes" class="loading">...</div>

    <div v-else-if="envelopes.length === 0" class="empty">
      {{ t("noEnvelopes") }}
    </div>

    <div v-else class="envelope-list">
      <div
        v-for="env in enrichedEnvelopes"
        :key="env.id"
        :class="['envelope-card', { 'card-inactive': !env.isActive }]"
      >
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <span class="envelope-id">#{{ env.id }}</span>
            <span v-if="env.role" :class="['role-badge', env.role.cls]">
              {{ env.role.text }}
            </span>
          </div>
          <span :class="['badge', env.isActive ? 'active' : 'inactive']">
            {{ env.status }}
          </span>
        </div>

        <div class="card-body">
          <div class="card-msg">{{ env.message || "🧧" }}</div>

          <!-- GAS remaining prominently -->
          <div class="card-gas-remaining">
            {{ t("gasRemaining", formatGas(env.remainingAmount)) }}
          </div>

          <!-- Progress bar -->
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: env.progress + '%' }"></div>
          </div>
          <div class="progress-label">
            <span>{{ t("packets", env.openedCount, env.packetCount) }}</span>
            <span>{{ env.progress }}%</span>
          </div>

          <!-- Expiry countdown -->
          <div v-if="env.countdown" :class="['countdown', { 'countdown-urgent': env.countdown.urgent }]">
            {{ env.countdown.text }}
          </div>

          <!-- NEO gate compact badge -->
          <div class="card-meta text-muted">
            {{ t("neoGate", env.minNeoRequired, env.holdDays) }}
          </div>
        </div>

        <div class="card-actions">
          <button v-if="env.showOpen" class="btn btn-open" @click="handleOpen(env)">
            {{ t("openEnvelope") }}
          </button>
          <button v-if="env.showTransfer" class="btn btn-transfer" @click="handleTransfer(env)">
            {{ t("transferEnvelope") }}
          </button>
          <button v-if="env.showReclaim" class="btn btn-reclaim" @click="handleReclaim(env)">
            {{ t("reclaimEnvelope") }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="actionStatus" :class="['status', actionStatus.type]">
      {{ actionStatus.msg }}
    </div>

    <OpeningModal
      v-if="showOpenModal && selectedEnvelope"
      :envelope="selectedEnvelope"
      @close="showOpenModal = false"
      @opened="loadEnvelopes()"
    />

    <TransferModal
      v-if="showTransferModal && selectedEnvelope"
      :envelope="selectedEnvelope"
      @close="showTransferModal = false"
      @transferred="loadEnvelopes()"
    />
  </div>
</template>
