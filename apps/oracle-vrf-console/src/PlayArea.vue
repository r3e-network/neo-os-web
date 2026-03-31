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

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.vrf-play-area { @include console.play-area; }
.result-grid { @include console.single-column-grid; }
.label { @include console.label; }
.value { @include console.value; }
</style>
