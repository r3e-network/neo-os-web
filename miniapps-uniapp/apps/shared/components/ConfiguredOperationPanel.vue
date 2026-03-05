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
  gap: 16px;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
}

.panel-description {
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
}

.panel-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}

.field-input {
  width: 100%;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  color: #ffffff;
  padding: 0 16px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:focus {
    border-color: #00e599;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 2px rgba(0, 229, 153, 0.1);
    outline: none;
  }
}

.field-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #e2e8f0;
  cursor: pointer;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 8px;
  margin-bottom: 8px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.summary-label {
  color: #94a3b8;
}

.summary-value {
  font-weight: 700;
  color: #ffffff;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.action-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.action-btn--primary {
  background-color: #00e599;
  color: #020617;
  box-shadow: 0 4px 14px rgba(0, 229, 153, 0.3);

  &:not(:disabled):hover {
    background-color: #00fcb0;
    box-shadow: 0 6px 20px rgba(0, 229, 153, 0.4);
  }
}

.action-btn--secondary {
  background-color: transparent;
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:not(:disabled):hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }
}

.action-btn--danger {
  background-color: #ef4444;
  color: white;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);

  &:not(:disabled):hover {
    background-color: #f87171;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  }
}

.panel-status {
  font-size: 13px;
  text-align: center;
  margin-top: 8px;
  color: #00e599;
  font-weight: 600;
}
</style>
