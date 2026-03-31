<template>
  <div class="operation-panels">
    <NeoCard
      v-for="operation in operations"
      :key="operation.key"
      variant="erobo"
      :title="resolveTitle(operation)"
      class="operation-card"
    >
      <!-- Description -->
      <p
        v-if="resolveDescription(operation)"
        class="operation-description"
      >
        {{ resolveDescription(operation) }}
      </p>

      <!-- Form Fields -->
      <div v-if="operation.fields?.length" class="operation-fields">
        <div
          v-for="field in operation.fields"
          :key="field.key"
          class="operation-field"
        >
          <!-- Amount field -->
          <NeoInput
            v-if="field.type === 'amount'"
            :model-value="getFieldValue(operation.key, field.key)"
            type="number"
            :label="resolveFieldLabel(field)"
            :placeholder="field.placeholder ?? '0.00'"
            :min="field.validation?.min?.toString()"
            :max="field.validation?.max?.toString()"
            :required="field.required"
            suffix="GAS"
            :error="getFieldError(operation.key, field.key)"
            @update:model-value="setFieldValue(operation.key, field.key, $event)"
          />

          <!-- Address field -->
          <NeoInput
            v-else-if="field.type === 'address'"
            :model-value="getFieldValue(operation.key, field.key)"
            type="text"
            :label="resolveFieldLabel(field)"
            :placeholder="field.placeholder ?? 'N...'"
            :required="field.required"
            :error="getFieldError(operation.key, field.key)"
            suffix-icon="wallet"
            @update:model-value="setFieldValue(operation.key, field.key, $event)"
          />

          <!-- Number field -->
          <NeoInput
            v-else-if="field.type === 'number'"
            :model-value="getFieldValue(operation.key, field.key)"
            type="number"
            :label="resolveFieldLabel(field)"
            :placeholder="field.placeholder ?? '0'"
            :min="field.validation?.min?.toString()"
            :max="field.validation?.max?.toString()"
            :required="field.required"
            :error="getFieldError(operation.key, field.key)"
            @update:model-value="setFieldValue(operation.key, field.key, $event)"
          />

          <!-- Text field -->
          <NeoInput
            v-else-if="field.type === 'text'"
            :model-value="getFieldValue(operation.key, field.key)"
            type="text"
            :label="resolveFieldLabel(field)"
            :placeholder="field.placeholder ?? ''"
            :required="field.required"
            :error="getFieldError(operation.key, field.key)"
            @update:model-value="setFieldValue(operation.key, field.key, $event)"
          />

          <!-- Select field -->
          <div v-else-if="field.type === 'select'" class="field-select">
            <label v-if="resolveFieldLabel(field)" class="field-label">
              {{ resolveFieldLabel(field) }}
            </label>
            <select
              class="neo-select"
              :value="getFieldValue(operation.key, field.key)"
              :required="field.required"
              :aria-label="resolveFieldLabel(field) || field.key"
              @change="setFieldValue(operation.key, field.key, ($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>
                {{ field.placeholder || t("select") }}
              </option>
              <option
                v-for="opt in (field.options ?? [])"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.labelKey ? t(opt.labelKey) : (opt.label ?? opt.value) }}
              </option>
            </select>
          </div>

          <!-- Toggle field -->
          <div v-else-if="field.type === 'toggle'" class="field-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                class="toggle-input"
                :checked="Boolean(getFieldValue(operation.key, field.key))"
                :aria-label="resolveFieldLabel(field) || field.key"
                @change="setFieldValue(operation.key, field.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="toggle-switch" />
              <span v-if="resolveFieldLabel(field)" class="toggle-text">
                {{ resolveFieldLabel(field) }}
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- State-bound summary (reads from reactive state) -->
      <div v-if="hasStateSummary(operation)" class="operation-summary">
        <div
          v-for="stat in getOperationStats(operation)"
          :key="stat.key"
          class="summary-row"
        >
          <span class="summary-label">{{ stat.label }}</span>
          <span class="summary-value">{{ stat.value }}</span>
        </div>
      </div>

      <!-- Action Button -->
      <NeoButton
        v-if="resolveActionLabel(operation)"
        variant="primary"
        size="lg"
        block
        :loading="isSubmitting(operation.key)"
        :disabled="isSubmitting(operation.key) || !isFormValid(operation.key)"
        :aria-label="resolveActionLabel(operation)"
        class="operation-action-btn"
        @click="submitOperation(operation)"
      >
        {{ resolveActionLabel(operation) }}
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
/**
 * MiniAppOperationPanel — Renders operation forms and action buttons
 *
 * Reads operation definitions from the manifest and renders a form panel
 * for each operation. Each operation can have:
 * - Form fields (amount, address, select, toggle, number, text)
 * - A state-bound summary section
 * - An action button that triggers a registered handler
 *
 * The action button calls the parent via @action emit with the operation
 * key and collected form data. The parent (MiniAppRoot) dispatches to
 * the registered action handler.
 */

import { ref, reactive, computed } from "vue";
import type { Ref } from "vue";
import type { OperationDefinition, OperationFieldDefinition } from "@shared/types/miniapp-manifest";
import NeoCard from "./NeoCard.vue";
import NeoButton from "./NeoButton.vue";
import NeoInput from "./NeoInput.vue";

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  /** Operation definitions from manifest */
  operations: OperationDefinition[];
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Reactive state for reading stat values */
  state: Record<string, Ref<unknown>>;
  /** Async callback for action handling — awaited to track submission state */
  onAction?: (operationKey: string, formData: Record<string, unknown>) => Promise<void>;
  /**
   * When true, amount fields with format "gas" are auto-scaled to Fixed8
   * (value * 1e8) in the emitted formData. Defaults to false to preserve
   * backward compatibility.
   */
  scaleAmounts?: boolean;
}>();

// ============================================================================
// Form State
// ============================================================================

/**
 * Form data store: { operationKey: { fieldKey: value } }
 * Initialized from field defaults.
 */
const formData: Record<string, Record<string, unknown>> = reactive({});
const formErrors: Record<string, Record<string, string>> = reactive({});
const submittingOps = ref<Set<string>>(new Set());

/** Initialize form data for all operations on setup */
for (const operation of props.operations) {
  formData[operation.key] = {};
  formErrors[operation.key] = {};
  if (operation.fields) {
    for (const field of operation.fields) {
      if (field.default !== undefined) {
        formData[operation.key][field.key] = field.default;
      } else {
        formData[operation.key][field.key] = field.type === "toggle" ? false : "";
      }
    }
  }
}

// ============================================================================
// Field Accessors
// ============================================================================

function getFieldValue(opKey: string, fieldKey: string): unknown {
  return formData[opKey]?.[fieldKey] ?? "";
}

function setFieldValue(opKey: string, fieldKey: string, value: unknown) {
  if (!formData[opKey]) {
    formData[opKey] = {};
  }
  formData[opKey][fieldKey] = value;

  // Clear error on edit
  if (formErrors[opKey]?.[fieldKey]) {
    formErrors[opKey][fieldKey] = "";
  }
}

function getFieldError(opKey: string, fieldKey: string): string | undefined {
  const err = formErrors[opKey]?.[fieldKey];
  return err || undefined;
}

// ============================================================================
// Label Resolution
// ============================================================================

function resolveTitle(op: OperationDefinition): string {
  if (op.titleKey) return props.t(op.titleKey);
  return props.t(op.key);
}

function resolveDescription(op: OperationDefinition): string | undefined {
  if (!op.descriptionKey) return undefined;
  const desc = props.t(op.descriptionKey);
  return desc !== op.descriptionKey ? desc : undefined;
}

function resolveFieldLabel(field: OperationFieldDefinition): string | undefined {
  if (!field.labelKey) return undefined;
  const label = props.t(field.labelKey);
  return label !== field.labelKey ? label : field.labelKey;
}

function resolveActionLabel(op: OperationDefinition): string | undefined {
  if (op.actionKey) {
    const label = props.t(op.actionKey);
    return label !== op.actionKey ? label : op.actionKey;
  }
  if (op.actionMethod) {
    return props.t(op.actionMethod);
  }
  return undefined;
}

// ============================================================================
// State Summary
// ============================================================================

function hasStateSummary(op: OperationDefinition): boolean {
  // Check if the manifest has stats that reference this operation's fields
  return false; // Placeholder — extendable by manifest
}

interface SummaryItem {
  key: string;
  label: string;
  value: string;
}

function getOperationStats(_op: OperationDefinition): SummaryItem[] {
  return []; // Placeholder — extendable by manifest
}

// ============================================================================
// Validation
// ============================================================================

function validateField(opKey: string, field: OperationFieldDefinition): boolean {
  const value = getFieldValue(opKey, field.key);

  // Required check
  if (field.required) {
    if (value === "" || value === null || value === undefined) {
      formErrors[opKey][field.key] = props.t("fieldRequired");
      return false;
    }
  }

  // Numeric range validation
  if (field.type === "amount" || field.type === "number") {
    const num = Number(value);
    if (value !== "" && !isNaN(num)) {
      if (field.validation?.min !== undefined && num < field.validation.min) {
        formErrors[opKey][field.key] = props.t("fieldMinValue", { min: field.validation.min });
        return false;
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        formErrors[opKey][field.key] = props.t("fieldMaxValue", { max: field.validation.max });
        return false;
      }
    }
  }

  // Neo N3 address format validation (starts with 'N', 34 chars, base58)
  if (field.type === "address" && value) {
    if (!/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(value as string)) {
      formErrors[opKey][field.key] = props.t("invalidAddress");
      return false;
    }
  }

  // Pattern validation (skip for empty optional fields)
  if (field.validation?.pattern && typeof value === "string") {
    if (field.required || value !== "") {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        formErrors[opKey][field.key] = props.t("fieldInvalidFormat");
        return false;
      }
    }
  }

  return true;
}

function isFormValid(opKey: string): boolean {
  const op = props.operations.find((o) => o.key === opKey);
  if (!op?.fields?.length) return true;

  return op.fields.every((field) => {
    if (!field.required) return true;
    const value = getFieldValue(opKey, field.key);
    return value !== "" && value !== null && value !== undefined;
  });
}

function validateOperation(op: OperationDefinition): boolean {
  if (!op.fields?.length) return true;

  let valid = true;
  for (const field of op.fields) {
    if (!validateField(op.key, field)) {
      valid = false;
    }
  }
  return valid;
}

// ============================================================================
// Submission
// ============================================================================

function isSubmitting(opKey: string): boolean {
  return submittingOps.value.has(opKey);
}

async function submitOperation(op: OperationDefinition) {
  if (!validateOperation(op)) return;
  if (submittingOps.value.has(op.key)) return;
  if (!props.onAction) return;

  submittingOps.value.add(op.key);
  try {
    const data = { ...(formData[op.key] ?? {}) };

    // When scaleAmounts is enabled, auto-scale amount fields to Fixed8 (1e8)
    // so callers receive integer values ready for on-chain submission.
    if (props.scaleAmounts && op.fields) {
      for (const field of op.fields) {
        if (field.type === "amount" && data[field.key] !== "" && data[field.key] != null) {
          const num = Number(data[field.key]);
          if (!isNaN(num)) {
            data[field.key] = Math.round(num * 1e8);
          }
        }
      }
    }

    await props.onAction(op.key, data);
  } finally {
    submittingOps.value.delete(op.key);
  }
}
</script>

<style lang="scss" scoped>
/* ── Operation Panels ── */
.operation-panels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.operation-card {
  /* Inherits NeoCard erobo variant styling */
}

.operation-description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  margin-bottom: 16px;
}

/* ── Form Fields ── */
.operation-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.operation-field {
  width: 100%;
}

/* ── Select Field ── */
.field-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.neo-select {
  width: 100%;
  padding: 10px 12px;
  padding-right: 36px;
  background: rgba(255, 255, 255, 0.04);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  appearance: none;
  cursor: pointer;

  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
    border-color: rgba(0, 229, 153, 0.3);
  }

  &:focus {
    border-color: var(--accent, #00e599);
    box-shadow: 0 0 0 2px rgba(0, 229, 153, 0.12);
  }

  option {
    background: #1a1a1a;
    color: rgba(255, 255, 255, 0.9);
  }
}

/* ── Toggle Field ── */
.field-toggle {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 11px;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-input:checked + & {
    background: var(--accent, #00e599);

    &::after {
      transform: translateX(18px);
      background: #fff;
    }
  }

  .toggle-input:focus-visible + & {
    box-shadow: 0 0 0 2px rgba(0, 229, 153, 0.3);
  }
}

.toggle-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* ── Summary ── */
.operation-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
}

.summary-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
}

.summary-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

/* ── Action Button ── */
.operation-action-btn {
  margin-top: 8px;

  &:not(:disabled) {
    background: linear-gradient(135deg, #00e599 0%, #00cc88 100%);
    box-shadow: 0 4px 16px rgba(0, 229, 153, 0.25), 0 0 0 1px rgba(0, 229, 153, 0.1);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      box-shadow: 0 6px 24px rgba(0, 229, 153, 0.35), 0 0 0 1px rgba(0, 229, 153, 0.2);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0, 229, 153, 0.2);
    }
  }

  &:disabled {
    opacity: 0.6;
    filter: grayscale(0.2);
  }
}
</style>
