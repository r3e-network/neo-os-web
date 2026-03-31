<template>
  <div class="neodid-play-area">
    <!-- Result Section -->
    <pre class="json-box">{{ renderedPayload }}</pre>

    <!-- Operation Section -->
    <div class="stack">
      <NeoInput :modelValue="did" :label="t('did')" :placeholder="t('didPlaceholder')" @update:modelValue="updateDid($event)" />
      <NeoInput :modelValue="format" :label="t('format')" :placeholder="t('formatPlaceholder')" @update:modelValue="updateFormat($event)" />
      <div class="button-row">
        <NeoButton variant="secondary" type="button" @click="handleApplyExample('service')" :aria-label="t('serviceDid')">{{ t("serviceDid") }}</NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleApplyExample('vault')" :aria-label="t('vaultDid')">{{ t("vaultDid") }}</NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleApplyExample('aa')" :aria-label="t('aaDid')">{{ t("aaDid") }}</NeoButton>
      </div>
      <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleResolveDid" :aria-label="t('resolveDid')">{{ t("resolveDid") }}</NeoButton>
      <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleLoadProviders" :aria-label="t('loadProviders')">{{ t("loadProviders") }}</NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const did = computed(() => String(props.state.did?.value ?? ""));
const format = computed(() => String(props.state.format?.value ?? "resolution"));
const renderedPayload = computed(() => String(props.state.renderedPayload?.value ?? "{}"));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const updateDid = (val: string) => {
  const handler = actions.get("updateDid");
  if (handler) handler(val);
};
const updateFormat = (val: string) => {
  const handler = actions.get("updateFormat");
  if (handler) handler(val);
};
const handleResolveDid = async () => {
  const handler = actions.get("resolveDid");
  if (handler) await handler();
};
const handleLoadProviders = async () => {
  const handler = actions.get("loadProviders");
  if (handler) await handler();
};
const handleApplyExample = (kind: string) => {
  const handler = actions.get("applyExample");
  if (handler) handler(kind);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.neodid-play-area { @include console.play-area; }

.stack { @include console.stack; }
.button-row { @include console.button-grid(3); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
