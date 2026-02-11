/**
 * Operation State Composable
 *
 * Manages the operation box form state, validation, and transaction
 * lifecycle for the two-column layout's right panel.
 *
 * Delegates field management to useFormState and wraps transaction
 * execution with a state machine (idle → confirming → pending → success → error).
 *
 * @example
 * ```ts
 * const { form, txState, txHash, txError, submit, reset } =
 *   useOperationState(config.twoColumn.operation);
 *
 * // Submit with a handler that calls the contract
 * await submit(async (values) => {
 *   const { txid } = await invokeContract({ ... });
 *   return { txid };
 * });
 * ```
 */

import { ref, type Ref } from "vue";
import { useFormState, type FormState } from "./useFormState";
import type { OperationBoxConfig, OperationField } from "@shared/types/template-config";

export type TxState = "idle" | "confirming" | "pending" | "success" | "error";

export interface OperationState {
  /** Form state (values, errors, validation) — delegated to useFormState */
  form: FormState<Record<string, any>>;
  /** Current transaction lifecycle state */
  txState: Ref<TxState>;
  /** Transaction hash on success */
  txHash: Ref<string>;
  /** Error message on failure */
  txError: Ref<string>;
  /** Submit the operation with a handler callback */
  submit: (handler: (values: Record<string, any>) => Promise<{ txid: string }>) => Promise<void>;
  /** Reset form and transaction state */
  reset: () => void;
}

/**
 * Build initial form values from field definitions
 */
function buildInitialValues(fields: OperationField[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.key] = field.default;
    } else if (field.type === "toggle" && field.options?.length) {
      values[field.key] = field.options[0].value;
    } else if (field.type === "number" || field.type === "amount") {
      values[field.key] = "";
    } else {
      values[field.key] = "";
    }
  }
  return values;
}

/**
 * Build a validation function from field definitions
 */
function buildValidator(fields: OperationField[]) {
  return (values: Record<string, any>): Record<string, string> | null => {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const val = values[field.key];

      // Required check
      if (field.required !== false && (val === "" || val === undefined || val === null)) {
        errors[field.key] = "required";
        continue;
      }

      // Skip further validation if empty and not required
      if (val === "" || val === undefined || val === null) continue;

      // Numeric validation for amount/number fields
      if (field.type === "amount" || field.type === "number") {
        const num = Number(val);
        if (isNaN(num)) {
          errors[field.key] = "invalidNumber";
          continue;
        }
        if (field.validation?.min !== undefined && num < field.validation.min) {
          errors[field.key] = "belowMin";
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          errors[field.key] = "aboveMax";
        }
      }

      // Pattern validation
      if (field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(val))) {
          errors[field.key] = "invalidFormat";
        }
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

export function useOperationState(config: OperationBoxConfig): OperationState {
  const form = useFormState(
    buildInitialValues(config.fields),
    buildValidator(config.fields),
  );

  const txState: Ref<TxState> = ref("idle");
  const txHash: Ref<string> = ref("");
  const txError: Ref<string> = ref("");

  const submit = async (
    handler: (values: Record<string, any>) => Promise<{ txid: string }>,
  ) => {
    // Validate form first
    form.touchAll();
    if (!form.validate()) return;

    txState.value = "confirming";
    txError.value = "";

    try {
      txState.value = "pending";
      const result = await handler(form.values);
      txHash.value = result.txid;
      txState.value = "success";
    } catch (err: any) {
      txError.value = err?.message ?? String(err);
      txState.value = "error";
    }
  };

  const reset = () => {
    form.reset();
    txState.value = "idle";
    txHash.value = "";
    txError.value = "";
  };

  return { form, txState, txHash, txError, submit, reset };
}
