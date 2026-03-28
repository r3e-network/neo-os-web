<template>
  <div class="compute-play-area">
    <!-- ── Result Section ── -->
    <div class="result-section">
      <div class="result-grid">
        <div>
          <span class="label">{{ t("labelStatus") }}</span>
          <span class="value">{{ jobStatus }}</span>
        </div>
        <div>
          <span class="label">{{ t("labelJob") }}</span>
          <span class="value">{{ jobId }}</span>
        </div>
        <div>
          <span class="label">{{ t("labelAttestation") }}</span>
          <span class="value">{{ attestation }}</span>
        </div>
        <div>
          <span class="label">{{ t("labelOutput") }}</span>
          <span class="value">{{ latestOutput }}</span>
        </div>
      </div>
    </div>

    <!-- ── Operation Section ── -->
    <div class="operation-section">
      <div class="stack">
        <NeoInput
          :modelValue="scriptName"
          @update:modelValue="updateScriptName"
          :label="t('scriptName')"
          :placeholder="t('scriptNamePlaceholder')"
        />
        <label for="input-json" class="textarea-label">{{ t("inputJson") }}</label>
        <textarea
          id="input-json"
          :value="inputJson"
          @input="updateInputJson(($event.target as HTMLTextAreaElement).value)"
          class="json-box"
          rows="8"
          :aria-label="t('inputJson')"
        ></textarea>
        <NeoButton
          type="button"
          variant="primary"
          :loading="isRequesting"
          @click="handleRunJob"
        >
          {{ t("execute") }}
        </NeoButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Oracle Compute Lab
 *
 * Renders the compute job result display and the operation form
 * for executing registered Morpheus compute scripts.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoInput, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const jobStatus = computed(() => String(props.state.jobStatus?.value ?? t("notAvailable")));
const jobId = computed(() => String(props.state.jobId?.value ?? t("notAvailable")));
const attestation = computed(() => String(props.state.attestation?.value ?? t("notAvailable")));
const latestOutput = computed(() => String(props.state.latestOutput?.value ?? "{}"));
const scriptName = computed(() => String(props.state.scriptName?.value ?? "health_check"));
const inputJson = computed(() => String(props.state.inputJson?.value ?? '{\n  "message": "hello from miniapp"\n}'));
const isRequesting = computed(() => Boolean(props.state.isRequesting?.value ?? false));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRunJob = async () => {
  const handler = actions.get("runJob");
  if (handler) await handler();
};

const updateScriptName = (val: string) => {
  const handler = actions.get("setScriptName");
  if (handler) handler(val);
};

const updateInputJson = (val: string) => {
  const handler = actions.get("setInputJson");
  if (handler) handler(val);
};
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.compute-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.stack { @include console.stack; }
.json-box { @include console.json-box; }
.textarea-label, .label { @include console.label; }
.value { @include console.value; }
.result-grid { @include console.single-column-grid; }
</style>
