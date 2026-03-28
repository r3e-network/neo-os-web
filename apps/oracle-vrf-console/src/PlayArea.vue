<template>
  <div class="vrf-play-area">
    <!-- Result Section -->
    <div class="result-grid">
      <div><span class="label">{{ t("labelRequest") }}</span><span class="value">{{ requestId }}</span></div>
      <div><span class="label">{{ t("labelValue") }}</span><span class="value">{{ randomValue }}</span></div>
      <div><span class="label">{{ t("labelProof") }}</span><span class="value">{{ proof }}</span></div>
    </div>

    <!-- Operation Section -->
    <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleRequestRandom" :aria-label="t('requestRandom')">{{ t("requestRandom") }}</NeoButton>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const requestId = computed(() => String(props.state.requestId?.value ?? t("notAvailable")));
const randomValue = computed(() => String(props.state.randomValue?.value ?? t("notAvailable")));
const proof = computed(() => String(props.state.proof?.value ?? t("notAvailable")));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRequestRandom = async () => {
  const handler = actions.get("requestRandom");
  if (handler) await handler();
};
</script>

<style scoped>
.vrf-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
}
.result-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.label {
  display: block;
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
}
.value {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  word-break: break-all;
}
</style>
