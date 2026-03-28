<template>
  <div class="automation-play-area">
    <!-- ── Result Panel ── -->
    <pre class="json-box">{{ renderedPayload }}</pre>

    <!-- ── Operation Panel ── -->
    <div class="stack">
      <NeoInput :modelValue="asset" @update:modelValue="asset = $event" :label="t('asset')" :placeholder="t('assetPlaceholder')" />
      <NeoInput :modelValue="targetPrice" @update:modelValue="targetPrice = $event" :label="t('targetPrice')" :placeholder="t('targetPricePlaceholder')" />
      <NeoInput :modelValue="schedule" @update:modelValue="schedule = $event" :label="t('schedule')" :placeholder="t('schedulePlaceholder')" />
      <NeoInput :modelValue="actionName" @update:modelValue="actionName = $event" :label="t('actionName')" :placeholder="t('actionNamePlaceholder')" />
      <div class="button-row">
        <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleFetchPrice" :aria-label="t('fetchPrice')">{{ t("fetchPrice") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handlePreviewRecipe" :aria-label="t('previewRecipe')">{{ t("previewRecipe") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleRequestRandomness" :aria-label="t('requestRandomness')">{{ t("requestRandomness") }}</NeoButton>
        <NeoButton variant="secondary" type="button" :loading="isRequesting" @click="handleFetchOracleKey" :aria-label="t('fetchOracleKey')">{{ t("fetchOracleKey") }}</NeoButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for Automation Copilot
 *
 * Renders the JSON result panel and the automation action inputs/buttons.
 * Everything else (sidebar, stats, docs, shell chrome) is rendered
 * by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoButton, NeoInput } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const asset = computed({
  get: () => String(props.state.asset?.value ?? "NEO"),
  set: (val: string) => {
    if (props.state.asset) {
      (props.state.asset as Ref<string>).value = val;
    }
  },
});
const targetPrice = computed({
  get: () => String(props.state.targetPrice?.value ?? "20"),
  set: (val: string) => {
    if (props.state.targetPrice) {
      (props.state.targetPrice as Ref<string>).value = val;
    }
  },
});
const schedule = computed({
  get: () => String(props.state.schedule?.value ?? "0 */6 * * *"),
  set: (val: string) => {
    if (props.state.schedule) {
      (props.state.schedule as Ref<string>).value = val;
    }
  },
});
const actionName = computed({
  get: () => String(props.state.actionName?.value ?? "auto_repay_self_loan"),
  set: (val: string) => {
    if (props.state.actionName) {
      (props.state.actionName as Ref<string>).value = val;
    }
  },
});
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));
const renderedPayload = computed(() => String(props.state.renderedPayload?.value ?? "{}"));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleFetchPrice = async () => {
  const handler = actions.get("fetchCurrentPrice");
  if (handler) await handler();
};

const handlePreviewRecipe = async () => {
  const handler = actions.get("previewRecipePayload");
  if (handler) await handler();
};

const handleRequestRandomness = async () => {
  const handler = actions.get("loadRandomness");
  if (handler) await handler();
};

const handleFetchOracleKey = async () => {
  const handler = actions.get("fetchOracleKey");
  if (handler) await handler();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.automation-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
