import React, { useState, useCallback, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Generic Operation Form Component - Optimized
 * Configurable form for on-chain operations
 */

export type OperationParam = {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "amount" | "address";
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
};

export type Operation = {
  name: string;
  description?: string;
  method: string;
  gasCost?: string;
  buttonStyle?: "primary" | "secondary" | "danger" | "success";
  confirmMessage?: string;
  params: OperationParam[];
};

type OperationFormProps = {
  operation: Operation;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  className?: string;
};

// 预定义按钮样式
const BTN_STYLES: Record<string, string> = {
  primary: "bg-neo hover:bg-neo/90 text-black",
  secondary: "bg-gray-500 hover:bg-gray-600 text-white",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  success: "bg-emerald-500 hover:bg-emerald-600 text-white",
};

/**
 * 表单字段组件 - 使用 memo 优化
 */
interface FormFieldProps {
  param: OperationParam;
  value: string;
  onChange: (value: string) => void;
}

const FormField = memo<FormFieldProps>(({ param, value, onChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(String(e.target.checked));
    },
    [onChange]
  );

  if (param.type === "select") {
    return (
      <select
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neo/50"
      >
        <option value="">{param.placeholder || "Select..."}</option>
        {param.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (param.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={handleCheckboxChange}
          className="rounded accent-neo"
        />
        <span className="text-sm text-gray-500">Yes</span>
      </label>
    );
  }

  if (param.type === "amount") {
    return (
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          placeholder={param.placeholder}
          min={param.min}
          max={param.max}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          GAS
        </span>
      </div>
    );
  }

  return (
    <Input
      type={param.type === "number" ? "number" : "text"}
      value={value}
      onChange={handleChange}
      placeholder={param.placeholder}
    />
  );
});

FormField.displayName = "FormField";

/**
 * OperationForm 主组件 - 优化版本
 */
export const OperationForm = memo(function OperationForm({
  operation,
  onSubmit,
  className,
}: OperationFormProps) {
  // 性能监控
  usePerformanceMonitor("OperationForm");

  // 使用 useMemo 缓存初始值
  const initialValues = useMemo(() => {
    const init: Record<string, string> = {};
    for (const p of operation.params) {
      init[p.name] = p.defaultValue ?? "";
    }
    return init;
  }, [operation.params]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 useCallback 缓存字段更新函数
  const handleFieldChange = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  // 使用 useMemo 缓存按钮样式
  const btnStyle = useMemo(
    () => BTN_STYLES[operation.buttonStyle || "primary"],
    [operation.buttonStyle]
  );

  // 使用 useCallback 缓存提交处理函数
  const handleSubmit = useCallback(async () => {
    const missing = operation.params.find(
      (p) => p.required && !String(values[p.name] ?? "").trim()
    );
    if (missing) {
      setError(`${missing.label} is required`);
      return;
    }

    if (operation.confirmMessage && !window.confirm(operation.confirmMessage)) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }, [operation, values, onSubmit]);

  return (
    <div className={cn("space-y-4", className)}>
      {operation.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {operation.description}
        </p>
      )}

      {operation.params.map((param) => (
        <div key={param.name}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {param.label}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          <FormField
            param={param}
            value={values[param.name] || ""}
            onChange={useCallback(
              (value: string) => handleFieldChange(param.name, value),
              [param.name, handleFieldChange]
            )}
          />
        </div>
      ))}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={cn(
          "w-full px-4 py-3 rounded-xl font-medium text-sm transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          btnStyle
        )}
      >
        {submitting ? "Processing..." : operation.name}
      </button>
    </div>
  );
});

/**
 * Operation List Component - Optimized
 */
type OperationListProps = {
  operations: Operation[];
  onSubmit: (operation: Operation, values: Record<string, string>) => Promise<void>;
  className?: string;
};

export const OperationList = memo(function OperationList({
  operations,
  onSubmit,
  className,
}: OperationListProps) {
  // 使用 useMemo 缓存操作处理函数
  const handleSubmit = useCallback(
    (operation: Operation) => (values: Record<string, string>) => {
      onSubmit(operation, values);
    },
    [onSubmit]
  );

  return (
    <div className={cn("space-y-6", className)}>
      {operations.map((op) => (
        <OperationForm
          key={op.method}
          operation={op}
          onSubmit={handleSubmit(op)}
        />
      ))}
    </div>
  );
});
