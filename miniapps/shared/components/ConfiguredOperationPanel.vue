<template>
  <view class="configured-operation-panel">
    <view class="panel-header">
      <text class="panel-title">{{ panelTitle }}</text>
      <text v-if="panelDescription" class="panel-description">{{ panelDescription }}</text>
    </view>

    <view v-if="operation.fields.length > 0" class="panel-fields">
      <view v-for="field in operation.fields" :key="field.key" class="field-row">
        <text class="field-label">{{ fieldLabel(field) }}</text>

        <select
          v-if="field.type === 'select' && (field.options?.length ?? 0) > 0"
          v-model="fieldValues[field.key]"
          class="field-input"
        >
          <option v-for="option in field.options" :key="option.value" :value="option.value">
            {{ optionLabel(option) }}
          </option>
        </select>

        <input
          v-else-if="field.type === 'number' || field.type === 'amount'"
          v-model="fieldValues[field.key]"
          class="field-input"
          type="number"
          :placeholder="fieldPlaceholder(field)"
          :min="field.validation?.min"
          :max="field.validation?.max"
        />

        <input
          v-else-if="field.type === 'address' || field.type === 'text'"
          v-model="fieldValues[field.key]"
          class="field-input"
          type="text"
          :placeholder="fieldPlaceholder(field)"
        />

        <label v-else-if="field.type === 'toggle'" class="field-toggle">
          <input v-model="fieldValues[field.key]" type="checkbox" />
          <text>{{ t("onChain") }}</text>
        </label>
      </view>
    </view>

    <view v-if="operation.summaryKeys?.length" class="summary-list">
      <view v-for="summary in operation.summaryKeys" :key="`${summary.valueKey}-${summary.label || summary.labelKey || ''}`" class="summary-item">
        <text class="summary-label">{{ summaryLabel(summary) }}</text>
        <text class="summary-value">{{ summaryValue(summary.valueKey) }}</text>
      </view>
    </view>

    <view class="panel-actions">
      <button
        v-if="primaryActionLabel"
        class="action-btn action-btn--primary"
        :disabled="isSubmitting"
        @click="runPrimaryAction"
      >
        {{ isSubmitting ? t("loading") : primaryActionLabel }}
      </button>

      <button
        v-for="button in operation.buttons || []"
        :key="button.id"
        class="action-btn"
        :class="buttonClass(button.variant)"
        :disabled="isSubmitting"
        @click="runButtonAction(button)"
      >
        {{ button.label }}
      </button>
    </view>

    <text v-if="statusMessage" class="panel-status">{{ statusMessage }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import type { OperationBoxConfig, OperationField, OperationButtonOption } from "@shared/types/template-config";

const props = defineProps<{
  operation: OperationBoxConfig;
  t: (key: string) => string;
}>();

const wallet = useWallet() as WalletSDK;
const fieldValues = reactive<Record<string, string | number | boolean>>({});
const isSubmitting = ref(false);
const statusMessage = ref("");

const panelTitle = computed(() => props.operation.title || props.t(props.operation.titleKey || "overview"));
const panelDescription = computed(() =>
  props.operation.description || (props.operation.descriptionKey ? props.t(props.operation.descriptionKey) : "")
);
const primaryActionLabel = computed(() => {
  if (!props.operation.actionMethod) return "";
  return props.operation.actionLabel || (props.operation.actionKey ? props.t(props.operation.actionKey) : "");
});

for (const field of props.operation.fields) {
  if (field.default !== undefined) {
    fieldValues[field.key] = field.default;
  } else if (field.type === "toggle") {
    fieldValues[field.key] = false;
  } else {
    fieldValues[field.key] = "";
  }
}

function fieldLabel(field: OperationField): string {
  return field.label || (field.labelKey ? props.t(field.labelKey) : field.key);
}

function fieldPlaceholder(field: OperationField): string {
  return field.placeholder || (field.placeholderKey ? props.t(field.placeholderKey) : "");
}

function optionLabel(option: { label?: string; labelKey?: string }): string {
  if (option.label) return option.label;
  if (option.labelKey) return props.t(option.labelKey);
  return "";
}

function summaryLabel(summary: { label?: string; labelKey?: string }): string {
  if (summary.label) return summary.label;
  if (summary.labelKey) return props.t(summary.labelKey);
  return "";
}

function summaryValue(valueKey: string): string {
  const value = fieldValues[valueKey];
  if (value === undefined || value === null) return "-";
  return String(value);
}

function buttonClass(variant: OperationButtonOption["variant"]): string {
  if (variant === "danger") return "action-btn--danger";
  if (variant === "secondary") return "action-btn--secondary";
  return "action-btn--primary";
}

function inferArgType(field: OperationField): string {
  if (field.argType) return field.argType;
  if (field.type === "toggle") return "Boolean";
  if (field.type === "number" || field.type === "amount") return "Integer";
  if (field.type === "address") return "Hash160";
  return "String";
}

function buildInvokeArgs() {
  return props.operation.fields
    .map((field) => {
      const value = fieldValues[field.key];
      if ((value === "" || value === null || value === undefined) && !field.required) return null;
      if ((value === "" || value === null || value === undefined) && field.required) {
        throw new Error(`${fieldLabel(field)} is required`);
      }
      return {
        type: inferArgType(field),
        value,
      };
    })
    .filter((arg): arg is { type: string; value: string | number | boolean } => Boolean(arg));
}

async function invoke(method: string, argsOverride?: Array<string | number | boolean>) {
  const contractAddress = await wallet.getContractAddress();
  if (!contractAddress) throw new Error(props.t("contractUnavailable") || "Contract address unavailable");

  const args = Array.isArray(argsOverride)
    ? argsOverride.map((value) => ({ type: typeof value === "number" ? "Integer" : typeof value === "boolean" ? "Boolean" : "String", value }))
    : buildInvokeArgs();

  await wallet.invokeContract({
    scriptHash: contractAddress,
    operation: method,
    args,
  });
}

async function runPrimaryAction() {
  const method = props.operation.actionMethod;
  if (!method) return;
  isSubmitting.value = true;
  statusMessage.value = "";
  try {
    await invoke(method);
    statusMessage.value = "Success";
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : "Action failed";
  } finally {
    isSubmitting.value = false;
  }
}

async function runButtonAction(button: OperationButtonOption) {
  isSubmitting.value = true;
  statusMessage.value = "";
  try {
    if (button.action.type === "link") {
      if (!button.action.href) throw new Error("Button link is missing");
      window.open(button.action.href, button.action.openInNewTab ? "_blank" : "_self");
      statusMessage.value = "Opened";
      return;
    }

    if (button.action.type === "copy") {
      const text = button.action.copyText || "";
      if (!text) throw new Error("Button copy text is missing");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      statusMessage.value = "Copied";
      return;
    }

    const method = button.action.method || props.operation.actionMethod;
    if (!method) throw new Error("Invoke method is missing");
    await invoke(method, button.action.args);
    statusMessage.value = "Success";
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : "Action failed";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.configured-operation-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
}

.panel-description {
  font-size: 13px;
  opacity: 0.8;
}

.panel-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
}

.field-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  padding: 8px 10px;
  font-size: 13px;
}

.field-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.summary-label {
  opacity: 0.8;
}

.summary-value {
  font-weight: 700;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.action-btn--primary {
  background: #2f7cf6;
}

.action-btn--secondary {
  background: #334155;
}

.action-btn--danger {
  background: #dc2626;
}

.panel-status {
  font-size: 12px;
  opacity: 0.9;
}
</style>
