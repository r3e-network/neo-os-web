"use client";

import { Button } from "@/components/ui/Button";
import type { ContractInitSchemaField } from "../lib/contract-init-schema";

type Props = {
  fields: ContractInitSchemaField[];
  values: Record<string, unknown>;
  parseError?: string;
  onChange: (field: ContractInitSchemaField, value: string | boolean) => void;
  onApplyDefaults: () => void;
};

export function ContractInitSchemaAutoForm({
  fields,
  values,
  parseError,
  onChange,
  onApplyDefaults,
}: Props) {
  if (parseError) {
    return (
      <p className="text-xs text-danger-600 dark:text-danger-400">
        Contract Init Schema parse error: {parseError}
      </p>
    );
  }

  if (!fields.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Auto Form (from Contract Init Schema)
        </p>
        <Button size="sm" variant="ghost" onClick={onApplyDefaults}>
          Apply Defaults
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {fields.map((field) => {
          const rawCurrent = values[field.key];
          const currentValue =
            rawCurrent === undefined || rawCurrent === null
              ? field.defaultValue
              : rawCurrent;
          const displayValue =
            typeof currentValue === "string" || typeof currentValue === "number"
              ? String(currentValue)
              : "";

          return (
            <div key={field.key} className="space-y-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.type === "boolean" ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    checked={Boolean(currentValue)}
                    onChange={(event) => onChange(field, event.target.checked)}
                  />
                  Enabled
                </label>
              ) : field.enumValues.length ? (
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                  value={displayValue}
                  onChange={(event) => onChange(field, event.target.value)}
                >
                  <option value="">(unset)</option>
                  {field.enumValues.map((enumValue) => (
                    <option key={`${field.key}-${enumValue}`} value={enumValue}>
                      {enumValue}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "number" || field.type === "integer" ? "number" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  value={displayValue}
                  onChange={(event) => onChange(field, event.target.value)}
                  placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ""}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                />
              )}
              {field.description ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{field.description}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
