<template>
  <div class="http-play-area">
    <!-- Result Section -->
    <div class="response-grid">
      <div><span class="label">{{ t("labelStatus") }}</span><span class="value">{{ statusCode }}</span></div>
      <div><span class="label">{{ t("labelHeaders") }}</span><span class="value">{{ responseHeaders }}</span></div>
      <div><span class="label">{{ t("labelBody") }}</span><span class="value">{{ responseBody }}</span></div>
    </div>

    <!-- Operation Section -->
    <div class="stack">
      <NeoInput :modelValue="url" :label="t('url')" :placeholder="t('urlPlaceholder')" @update:modelValue="updateField('url', $event)" />
      <NeoInput :modelValue="method" :label="t('method')" :placeholder="t('methodPlaceholder')" @update:modelValue="updateField('method', $event)" />
      <NeoInput :modelValue="secretName" :label="t('secretName')" :placeholder="t('optional')" @update:modelValue="updateField('secretName', $event)" />
      <NeoInput :modelValue="secretAsKey" :label="t('secretAsKey')" :placeholder="t('secretAsKeyPlaceholder')" @update:modelValue="updateField('secretAsKey', $event)" />
      <label for="request-body" class="textarea-label">{{ t("body") }}</label>
      <textarea id="request-body" :value="bodyText" class="json-box" rows="6" :aria-label="t('body')" @input="updateField('body', ($event.target as HTMLTextAreaElement).value)"></textarea>
      <NeoButton variant="primary" type="button" :loading="isRequesting" @click="handleRunQuery" :aria-label="t('runQuery')">{{ t("runQuery") }}</NeoButton>
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

const url = computed(() => String(props.state.url?.value ?? ""));
const method = computed(() => String(props.state.method?.value ?? "GET"));
const secretName = computed(() => String(props.state.secretName?.value ?? ""));
const secretAsKey = computed(() => String(props.state.secretAsKey?.value ?? ""));
const bodyText = computed(() => String(props.state.body?.value ?? ""));
const statusCode = computed(() => String(props.state.statusCode?.value ?? t("notAvailable")));
const responseHeaders = computed(() => String(props.state.responseHeaders?.value ?? "{}"));
const responseBody = computed(() => String(props.state.responseBody?.value ?? t("notAvailable")));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const updateField = (field: string, value: string) => {
  const handler = actions.get("updateField");
  if (handler) handler(field, value);
};

const handleRunQuery = async () => {
  const handler = actions.get("runQuery");
  if (handler) await handler();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.http-play-area { @include console.play-area; }

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.response-grid { @include console.single-column-grid; }
</style>
