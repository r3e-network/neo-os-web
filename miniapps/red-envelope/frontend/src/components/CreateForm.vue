<script setup lang="ts">
import { ref, computed } from "vue";
import { useWallet } from "@/composables/useWallet";
import { useRedEnvelope } from "@/composables/useRedEnvelope";
import { useI18n } from "@/composables/useI18n";
import { extractError } from "@/utils/format";

const { t } = useI18n();
const { connected, connect } = useWallet();
const { createEnvelope, isLoading } = useRedEnvelope();

const amount = ref("");
const count = ref("");
const expiryHours = ref("168");
const message = ref("");
const minNeo = ref("100");
const minHoldDays = ref("2");
const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

const canSubmit = computed(() => {
  const a = Number(amount.value);
  const c = Number(count.value);
  return a >= 0.1 && c >= 1 && c <= 100 && a >= c * 0.01;
});

const perPacket = computed(() => {
  const a = Number(amount.value);
  const c = Number(count.value);
  if (a > 0 && c > 0) return (a / c).toFixed(4);
  return "—";
});

const handleSubmit = async () => {
  if (!connected.value) {
    await connect();
    return;
  }
  status.value = null;
  try {
    const txid = await createEnvelope({
      totalGas: Number(amount.value),
      packetCount: Number(count.value),
      expiryHours: Number(expiryHours.value) || 168,
      message: message.value || t("defaultBlessing"),
      minNeo: Number(minNeo.value) || 100,
      minHoldDays: Number(minHoldDays.value) || 2,
    });
    status.value = { msg: `TX: ${txid.slice(0, 12)}...`, type: "success" };
    amount.value = "";
    count.value = "";
    message.value = "";
  } catch (e: unknown) {
    status.value = { msg: extractError(e), type: "error" };
  }
};
</script>

<template>
  <div class="create-form">
    <h2>{{ t("createEnvelope") }}</h2>

    <!-- Flow explanation banner -->
    <div class="flow-banner">{{ t("flowBanner") }}</div>

    <!-- 💰 Amount Section -->
    <div class="form-section">
      <div class="form-section-title">{{ t("amountSection") }}</div>

      <div class="form-group">
        <label class="form-label">{{ t("labelGasAmount") }}</label>
        <input
          v-model="amount"
          type="number"
          step="0.1"
          min="0.1"
          :placeholder="t('totalGasPlaceholder')"
          class="input"
        />
      </div>

      <div class="form-group">
        <label class="form-label">{{ t("labelPacketCount") }}</label>
        <input v-model="count" type="number" min="1" max="100" :placeholder="t('packetsPlaceholder')" class="input" />
      </div>
    </div>

    <!-- 🔒 NEO Gate Section -->
    <div class="form-section">
      <div class="form-section-title">{{ t("neoGateSection") }}</div>

      <div class="form-row">
        <div class="input-half">
          <label class="form-label">{{ t("labelMinNeo") }}</label>
          <input v-model="minNeo" type="number" min="0" :placeholder="t('minNeoPlaceholder')" class="input" />
        </div>
        <div class="input-half">
          <label class="form-label">{{ t("labelHoldDays") }}</label>
          <input v-model="minHoldDays" type="number" min="0" :placeholder="t('minHoldDaysPlaceholder')" class="input" />
        </div>
      </div>
    </div>

    <!-- ⏰ Settings Section -->
    <div class="form-section">
      <div class="form-section-title">{{ t("settingsSection") }}</div>

      <div class="form-group">
        <label class="form-label">{{ t("labelExpiry") }}</label>
        <input v-model="expiryHours" type="number" min="1" :placeholder="t('expiryPlaceholder')" class="input" />
      </div>

      <div class="form-group">
        <label class="form-label">{{ t("labelMessage") }}</label>
        <input v-model="message" type="text" :placeholder="t('messagePlaceholder')" class="input" />
      </div>
    </div>

    <!-- Summary card -->
    <div v-if="canSubmit" class="summary-card">
      <div class="summary-title">{{ t("summaryTitle") }}</div>
      <div class="summary-row">
        <span>{{ t("summaryTotal") }}</span>
        <span class="summary-value">{{ amount }} GAS</span>
      </div>
      <div class="summary-row">
        <span>{{ t("summaryPerPacket") }}</span>
        <span class="summary-value">~{{ perPacket }} GAS</span>
      </div>
      <div class="summary-row">
        <span>{{ t("summaryExpiry") }}</span>
        <span class="summary-value">{{ t("summaryHours", expiryHours) }}</span>
      </div>
      <div class="summary-row">
        <span>{{ t("summaryNeoGate") }}</span>
        <span class="summary-value">≥{{ minNeo }} NEO, ≥{{ minHoldDays }}d</span>
      </div>
    </div>

    <button class="btn btn-send" :disabled="!canSubmit || isLoading" @click="handleSubmit">
      {{ isLoading ? t("creating") : t("sendRedEnvelope") }}
    </button>

    <div v-if="status" :class="['status', status.type]">
      {{ status.msg }}
    </div>
  </div>
</template>
