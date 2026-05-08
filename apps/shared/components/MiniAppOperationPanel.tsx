/**
 * MiniAppOperationPanel — React equivalent of MiniAppOperationPanel.vue
 *
 * Renders operation forms and action buttons from manifest operation definitions.
 * Each operation can have form fields (amount, address, select, toggle, number, text),
 * a state-bound summary section, and an action button that triggers a registered handler.
 */

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import type {
  OperationDefinition,
  OperationFieldDefinition,
} from "@shared/types/miniapp-manifest";
import type { Observable } from "../react/context";
import type { MiniAppLaunchContext } from "../utils/launch-params";
import "./MiniAppOperationPanel.scss";

// ============================================================================
// Props
// ============================================================================

export interface MiniAppOperationPanelProps {
  /** Operation definitions from manifest */
  operations: OperationDefinition[];
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Reactive state for reading stat values */
  state: Record<string, Observable>;
  /** Async callback for action handling */
  onAction?: (
    operationKey: string,
    formData: Record<string, unknown>,
  ) => Promise<void>;
  /**
   * When true, amount fields are auto-scaled to Fixed8 (value * 1e8)
   * in the emitted formData. Defaults to false.
   */
  scaleAmounts?: boolean;
  launchContext?: MiniAppLaunchContext | null;
}

// ============================================================================
// Helpers
// ============================================================================

function initFieldValue(
  field: OperationFieldDefinition,
  launchParams: Record<string, string>,
): unknown {
  const launched = launchParams[field.key];
  if (launched !== undefined && launched !== "") {
    if (field.type === "toggle") {
      return /^(true|1|yes|on)$/i.test(launched);
    }
    return launched;
  }
  if (field.default !== undefined) return field.default;
  return field.type === "toggle" ? false : "";
}

function initFormData(
  operations: OperationDefinition[],
  launchParams: Record<string, string> = {},
): Record<string, Record<string, unknown>> {
  const data: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const operationData: Record<string, unknown> = {};
    data[operation.key] = operationData;
    if (operation.fields) {
      for (const field of operation.fields) {
        operationData[field.key] = initFieldValue(field, launchParams);
      }
    }
  }
  return data;
}

// ============================================================================
// Component
// ============================================================================

export function MiniAppOperationPanel({
  operations,
  t,
  state: _state,
  onAction,
  scaleAmounts = false,
  launchContext = null,
}: MiniAppOperationPanelProps) {
  const initialFormData = useMemo(
    () => initFormData(operations, launchContext?.params),
    [launchContext?.signature, operations],
  );
  const [formData, setFormData] =
    useState<Record<string, Record<string, unknown>>>(initialFormData);
  const [formErrors, setFormErrors] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const errors: Record<string, Record<string, string>> = {};
    for (const op of operations) {
      errors[op.key] = {};
    }
    return errors;
  });
  const [submittingOps, setSubmittingOps] = useState<Set<string>>(
    () => new Set(),
  );
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const operationGroups = useMemo(
    () => splitOperations(operations),
    [operations],
  );
  const [activeOperationKey, setActiveOperationKey] = useState(
    operationGroups.primary[0]?.key ?? operations[0]?.key ?? "",
  );
  const activeOperation =
    operations.find((operation) => operation.key === activeOperationKey) ??
    operationGroups.primary[0] ??
    operations[0];

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  useEffect(() => {
    const stillExists = operations.some(
      (operation) => operation.key === activeOperationKey,
    );
    if (!stillExists) {
      setActiveOperationKey(
        operationGroups.primary[0]?.key ?? operations[0]?.key ?? "",
      );
    }
  }, [activeOperationKey, operationGroups.primary, operations]);

  // --------------------------------------------------------------------------
  // Field Accessors
  // --------------------------------------------------------------------------

  const getFieldValue = useCallback(
    (opKey: string, fieldKey: string): unknown => {
      return formDataRef.current[opKey]?.[fieldKey] ?? "";
    },
    [],
  );

  const setFieldValue = useCallback(
    (opKey: string, fieldKey: string, value: unknown) => {
      setFormData((prev) => ({
        ...prev,
        [opKey]: { ...(prev[opKey] ?? {}), [fieldKey]: value },
      }));
      // Clear error on edit
      setFormErrors((prev) => {
        if (prev[opKey]?.[fieldKey]) {
          const newErrors = { ...prev };
          newErrors[opKey] = { ...newErrors[opKey] };
          newErrors[opKey][fieldKey] = "";
          return newErrors;
        }
        return prev;
      });
    },
    [],
  );

  const getFieldError = useCallback(
    (opKey: string, fieldKey: string): string | undefined => {
      const err = formErrors[opKey]?.[fieldKey];
      return err || undefined;
    },
    [formErrors],
  );

  // --------------------------------------------------------------------------
  // Label Resolution
  // --------------------------------------------------------------------------

  const resolveTitle = useCallback(
    (op: OperationDefinition): string => {
      if (op.titleKey) return t(op.titleKey);
      return t(op.key);
    },
    [t],
  );

  const resolveDescription = useCallback(
    (op: OperationDefinition): string | undefined => {
      if (!op.descriptionKey) return undefined;
      const desc = t(op.descriptionKey);
      return desc !== op.descriptionKey ? desc : undefined;
    },
    [t],
  );

  const resolveFieldLabel = useCallback(
    (field: OperationFieldDefinition): string | undefined => {
      if (!field.labelKey) return undefined;
      const label = t(field.labelKey);
      return label !== field.labelKey ? label : field.labelKey;
    },
    [t],
  );

  const resolveActionLabel = useCallback(
    (op: OperationDefinition): string | undefined => {
      if (op.actionKey) {
        const label = t(op.actionKey);
        return label !== op.actionKey ? label : op.actionKey;
      }
      if (op.actionMethod) {
        return t(op.actionMethod);
      }
      return undefined;
    },
    [t],
  );

  // --------------------------------------------------------------------------
  // State Summary (placeholder -- extendable by manifest)
  // --------------------------------------------------------------------------

  const hasStateSummary = useCallback((_op: OperationDefinition): boolean => {
    return false;
  }, []);

  const getOperationStats = useCallback(
    (
      _op: OperationDefinition,
    ): Array<{ key: string; label: string; value: string }> => {
      return [];
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  const validateField = useCallback(
    (opKey: string, field: OperationFieldDefinition): boolean => {
      const value = formDataRef.current[opKey]?.[field.key] ?? "";
      let errorMsg = "";

      // Required check
      if (field.required) {
        if (value === "" || value === null || value === undefined) {
          errorMsg = t("fieldRequired");
          setFormErrors((prev) => ({
            ...prev,
            [opKey]: { ...(prev[opKey] ?? {}), [field.key]: errorMsg },
          }));
          return false;
        }
      }

      // Numeric range validation
      if (field.type === "amount" || field.type === "number") {
        const num = Number(value);
        if (value !== "" && !isNaN(num)) {
          if (
            field.validation?.min !== undefined &&
            num < field.validation.min
          ) {
            errorMsg = t("fieldMinValue", { min: field.validation.min });
            setFormErrors((prev) => ({
              ...prev,
              [opKey]: { ...(prev[opKey] ?? {}), [field.key]: errorMsg },
            }));
            return false;
          }
          if (
            field.validation?.max !== undefined &&
            num > field.validation.max
          ) {
            errorMsg = t("fieldMaxValue", { max: field.validation.max });
            setFormErrors((prev) => ({
              ...prev,
              [opKey]: { ...(prev[opKey] ?? {}), [field.key]: errorMsg },
            }));
            return false;
          }
        }
      }

      // Neo N3 address format validation
      if (field.type === "address" && value) {
        if (!/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(value as string)) {
          errorMsg = t("invalidAddress");
          setFormErrors((prev) => ({
            ...prev,
            [opKey]: { ...(prev[opKey] ?? {}), [field.key]: errorMsg },
          }));
          return false;
        }
      }

      // Pattern validation (skip for empty optional fields)
      if (field.validation?.pattern && typeof value === "string") {
        if (field.required || value !== "") {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errorMsg = t("fieldInvalidFormat");
            setFormErrors((prev) => ({
              ...prev,
              [opKey]: { ...(prev[opKey] ?? {}), [field.key]: errorMsg },
            }));
            return false;
          }
        }
      }

      return true;
    },
    [t],
  );

  const isFormValid = useCallback(
    (opKey: string): boolean => {
      const op = operations.find((o) => o.key === opKey);
      if (!op?.fields?.length) return true;

      return op.fields.every((field) => {
        if (!field.required) return true;
        const value = formDataRef.current[opKey]?.[field.key];
        return value !== "" && value !== null && value !== undefined;
      });
    },
    [operations],
  );

  const validateOperation = useCallback(
    (op: OperationDefinition): boolean => {
      if (!op.fields?.length) return true;

      let valid = true;
      for (const field of op.fields) {
        if (!validateField(op.key, field)) {
          valid = false;
        }
      }
      return valid;
    },
    [validateField],
  );

  // --------------------------------------------------------------------------
  // Submission
  // --------------------------------------------------------------------------

  const isSubmitting = useCallback(
    (opKey: string): boolean => {
      return submittingOps.has(opKey);
    },
    [submittingOps],
  );

  const submitOperation = useCallback(
    async (op: OperationDefinition) => {
      if (!validateOperation(op)) return;
      if (submittingOps.has(op.key)) return;
      if (!onAction) return;

      setSubmittingOps((prev) => new Set(prev).add(op.key));
      try {
        const data = { ...(formDataRef.current[op.key] ?? {}) };

        // Auto-scale amount fields to Fixed8 (1e8)
        if (scaleAmounts && op.fields) {
          for (const field of op.fields) {
            if (
              field.type === "amount" &&
              data[field.key] !== "" &&
              data[field.key] != null
            ) {
              const num = Number(data[field.key]);
              if (!isNaN(num)) {
                data[field.key] = Math.round(num * 1e8);
              }
            }
          }
        }

        await onAction(op.key, data);
      } finally {
        setSubmittingOps((prev) => {
          const next = new Set(prev);
          next.delete(op.key);
          return next;
        });
      }
    },
    [onAction, scaleAmounts, submittingOps, validateOperation],
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="operation-panels">
      {operationGroups.primary.length > 1 && (
        <div
          className="operation-tabs"
          role="tablist"
          aria-label={t("operationsPanel")}
        >
          {operationGroups.primary.map((operation) => (
            <button
              key={operation.key}
              type="button"
              role="tab"
              aria-selected={activeOperation?.key === operation.key}
              className={`operation-tab${activeOperation?.key === operation.key ? " operation-tab--active" : ""}`}
              onClick={() => setActiveOperationKey(operation.key)}
            >
              {resolveTitle(operation)}
            </button>
          ))}
        </div>
      )}

      {activeOperation && renderOperationCard(activeOperation)}

      {operationGroups.secondary.length > 0 && (
        <details className="operation-secondary">
          <summary>
            <span>
              {resolveStaticLabel("advancedOperations", "Advanced / Operator")}
            </span>
            <small>{operationGroups.secondary.length}</small>
          </summary>
          <div className="operation-secondary__grid">
            {operationGroups.secondary.map((operation) => (
              <button
                key={operation.key}
                type="button"
                className={`operation-secondary__button${activeOperation?.key === operation.key ? " operation-secondary__button--active" : ""}`}
                onClick={() => setActiveOperationKey(operation.key)}
              >
                {resolveTitle(operation)}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );

  // --------------------------------------------------------------------------
  // Field Renderers
  // --------------------------------------------------------------------------

  function renderField(opKey: string, field: OperationFieldDefinition) {
    if (field.hidden) return null;
    const value = formData[opKey]?.[field.key] ?? "";
    const error = getFieldError(opKey, field.key);
    const label = resolveFieldLabel(field);

    switch (field.type) {
      case "amount":
        return renderInput(opKey, field, {
          type: "number",
          label,
          placeholder: field.placeholder ?? "0.00",
          min: field.validation?.min?.toString(),
          max: field.validation?.max?.toString(),
          suffix: "GAS",
          error,
          value,
        });

      case "address":
        return renderInput(opKey, field, {
          type: "text",
          label,
          placeholder: field.placeholder ?? "N...",
          suffixIcon: "wallet",
          error,
          value,
        });

      case "number":
        return renderInput(opKey, field, {
          type: "number",
          label,
          placeholder: field.placeholder ?? "0",
          min: field.validation?.min?.toString(),
          max: field.validation?.max?.toString(),
          error,
          value,
        });

      case "text":
        return renderInput(opKey, field, {
          type: "text",
          label,
          placeholder: field.placeholder ?? "",
          error,
          value,
        });

      case "select":
        return (
          <div className="field-select">
            {label && <label className="field-label">{label}</label>}
            <select
              className="neo-select"
              value={String(value)}
              required={field.required}
              aria-label={label || field.key}
              onChange={(e) => setFieldValue(opKey, field.key, e.target.value)}
            >
              <option value="" disabled>
                {field.placeholder || t("select")}
              </option>
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelKey ? t(opt.labelKey) : (opt.label ?? opt.value)}
                </option>
              ))}
            </select>
          </div>
        );

      case "toggle":
        return (
          <div className="field-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                className="toggle-input"
                checked={Boolean(value)}
                aria-label={label || field.key}
                onChange={(e) =>
                  setFieldValue(opKey, field.key, e.target.checked)
                }
              />
              <span className="toggle-switch" />
              {label && <span className="toggle-text">{label}</span>}
            </label>
          </div>
        );

      default:
        return null;
    }
  }

  function renderInput(
    opKey: string,
    field: OperationFieldDefinition,
    config: {
      type: string;
      label?: string;
      placeholder?: string;
      min?: string;
      max?: string;
      suffix?: string;
      suffixIcon?: string;
      error?: string;
      value: unknown;
    },
  ) {
    const inputId = `op-${opKey}-${field.key}`;
    return (
      <div className={`neo-input${config.error ? " neo-input--error" : ""}`}>
        {config.label && (
          <span id={`${inputId}-label`} className="neo-input__label">
            {config.label}
          </span>
        )}
        <div className="neo-input__wrapper">
          <input
            id={inputId}
            type={config.type}
            className="neo-input__field"
            value={String(config.value ?? "")}
            placeholder={config.placeholder}
            required={field.required}
            min={config.min}
            max={config.max}
            aria-label={config.label || field.key}
            aria-labelledby={config.label ? `${inputId}-label` : undefined}
            aria-describedby={config.error ? `${inputId}-error` : undefined}
            aria-invalid={config.error ? true : undefined}
            aria-required={field.required || undefined}
            onChange={(e) => setFieldValue(opKey, field.key, e.target.value)}
          />
          {(config.suffixIcon || config.suffix) && (
            <div className="neo-input__suffix">
              {config.suffix && <span>{config.suffix}</span>}
            </div>
          )}
        </div>
        {config.error && (
          <span
            id={`${inputId}-error`}
            className="neo-input__error"
            role="alert"
            aria-live="assertive"
          >
            {config.error}
          </span>
        )}
      </div>
    );
  }

  function renderOperationCard(operation: OperationDefinition) {
    const visibleFields =
      operation.fields?.filter((field) => !field.hidden) ?? [];

    return (
      <div
        key={operation.key}
        className="neo-card neo-card--erobo operation-card"
      >
        <div className="neo-card__header">
          <span className="neo-card__title">{resolveTitle(operation)}</span>
        </div>
        <div className="neo-card__body">
          {resolveDescription(operation) && (
            <p className="operation-description">
              {resolveDescription(operation)}
            </p>
          )}

          {visibleFields.length > 0 && (
            <div className="operation-fields">
              {visibleFields.map((field) => (
                <div key={field.key} className="operation-field">
                  {renderField(operation.key, field)}
                </div>
              ))}
            </div>
          )}

          {hasStateSummary(operation) && (
            <div className="operation-summary">
              {getOperationStats(operation).map((stat) => (
                <div key={stat.key} className="summary-row">
                  <span className="summary-label">{stat.label}</span>
                  <span className="summary-value">{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          {resolveActionLabel(operation) && (
            <button
              type="button"
              className={`neo-btn neo-btn--primary neo-btn--lg neo-btn--block operation-action-btn${isSubmitting(operation.key) ? " neo-btn--loading" : ""}`}
              disabled={
                isSubmitting(operation.key) || !isFormValid(operation.key)
              }
              aria-label={resolveActionLabel(operation)}
              aria-busy={isSubmitting(operation.key)}
              onClick={() => submitOperation(operation)}
            >
              {isSubmitting(operation.key) ? (
                <div className="neo-btn__spinner" aria-hidden="true" />
              ) : (
                resolveActionLabel(operation)
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  function resolveStaticLabel(key: string, fallback: string) {
    const label = t(key);
    return label && label !== key ? label : fallback;
  }
}

function splitOperations(operations: OperationDefinition[]) {
  if (operations.length <= 1) {
    return { primary: operations, secondary: [] as OperationDefinition[] };
  }

  const primary = operations.filter((operation, index) => {
    if (
      operation.priority === "secondary" ||
      operation.priority === "operator"
    ) {
      return false;
    }
    if (operation.priority === "primary") return true;
    if (index === 0) return true;
    const text =
      `${operation.key} ${operation.actionMethod ?? ""}`.toLowerCase();
    return /claim|stake|withdraw|open|pay/.test(text);
  });
  const safePrimary = primary.length > 0 ? primary : [operations[0]];
  const secondary = operations.filter(
    (operation) => !safePrimary.includes(operation),
  );
  return { primary: safePrimary, secondary };
}

export default MiniAppOperationPanel;
