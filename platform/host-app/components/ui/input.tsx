/**
 * Input Component - Enhanced with design system tokens
 * Supports various input types, states, and validation
 */

import React, {
  forwardRef,
  useCallback,
  useId,
  useState,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { keyboardNavigation } from "@/lib/design-system/a11y";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "filled" | "outline" | "ghost";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "prefix"
> {
  /** Input size */
  size?: InputSize;
  /** Input visual variant */
  variant?: InputVariant;
  /** Error message to display */
  error?: string;
  /** Helper text to display below input */
  helperText?: string;
  /** Label text */
  label?: string;
  /** Whether the label is required */
  required?: boolean;
  /** Left addon (icon or text) */
  leftAddon?: React.ReactNode;
  /** Right addon (icon or text) */
  rightAddon?: React.ReactNode;
  /** Whether to show a loading state */
  loading?: boolean;
  /** Whether the input is in a success state */
  success?: boolean;
  /** Clear button visibility */
  showClearButton?: boolean;
  /** Callback when clear button is clicked */
  onClear?: () => void;
}

// ============================================================================
// Size Styles Configuration
// ============================================================================

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-base rounded-xl",
  lg: "px-4 py-3 text-lg rounded-xl",
};

// ============================================================================
// Variant Styles Configuration
// ============================================================================

const variantStyles: Record<InputVariant, { base: string; focus: string }> = {
  default: {
    base: "bg-gray-800 border border-gray-700 text-white placeholder-gray-500",
    focus: "focus:border-neo focus:ring-1 focus:ring-neo",
  },
  filled: {
    base: "bg-gray-800/50 border border-transparent text-white placeholder-gray-500",
    focus: "focus:bg-gray-800 focus:border-neo focus:ring-1 focus:ring-neo",
  },
  outline: {
    base: "bg-transparent border-2 border-gray-700 text-white placeholder-gray-500",
    focus: "focus:border-neo focus:ring-0",
  },
  ghost: {
    base: "bg-transparent border-0 text-white placeholder-gray-500",
    focus: "focus:bg-gray-800/50",
  },
};

// ============================================================================
// Error/Success Styles
// ============================================================================

const stateStyles = {
  error: "border-red-500 focus:border-red-500 focus:ring-red-500/20",
  success:
    "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20",
};

// ============================================================================
// Input Component
// ============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "md",
      variant = "default",
      error,
      helperText,
      label,
      required,
      leftAddon,
      rightAddon,
      loading = false,
      success = false,
      showClearButton = false,
      onClear,
      className,
      disabled,
      id,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(
      !!props.value || !!props.defaultValue,
    );

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        props.onFocus?.(e);
      },
      [props.onFocus],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        props.onBlur?.(e);
      },
      [props.onBlur],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(e.target.value.length > 0);
        props.onChange?.(e);
      },
      [props.onChange],
    );

    const handleClear = useCallback(() => {
      onClear?.();
      setHasValue(false);
    }, [onClear]);

    const handleKeyDown = useCallback(
      keyboardNavigation.escape(() => {
        // Blur on escape
      }),
      [],
    );

    const variantStyle = useMemo(() => variantStyles[variant], [variant]);
    const sizeStyle = useMemo(() => sizeStyles[size], [size]);

    const stateClass = useMemo(() => {
      if (error) return stateStyles.error;
      if (success) return stateStyles.success;
      return "";
    }, [error, success]);

    const showClear = showClearButton && hasValue && !disabled;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {/* Left Addon */}
          {leftAddon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled || loading}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperId}
            aria-required={required}
            className={cn(
              // Base styles
              "w-full appearance-none transition-all duration-200",
              "placeholder:text-gray-500",
              "focus:outline-none",
              // Disabled
              disabled && "opacity-50 cursor-not-allowed",
              // Size
              sizeStyle,
              // Variant
              variantStyle.base,
              variantStyle.focus,
              // State
              stateClass,
              // Addons
              leftAddon && "pl-10",
              (rightAddon || showClear || loading) && "pr-10",
              // Class
              className,
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            {...props}
          />

          {/* Loading Spinner */}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg
                className="animate-spin h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {/* Clear Button */}
          {showClear && !loading && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              onClick={handleClear}
              aria-label="Clear input"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Right Addon */}
          {rightAddon && !showClear && !loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightAddon}
            </div>
          )}
        </div>

        {/* Helper/Error Text */}
        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              "mt-1.5 text-sm",
              error ? "text-red-400" : "text-gray-500",
            )}
            role={error ? "alert" : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

// ============================================================================
// Textarea Component
// ============================================================================

export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size"
> {
  /** Textarea size */
  size?: InputSize;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Label text */
  label?: string;
  /** Whether the label is required */
  required?: boolean;
  /** Show character count */
  showCharCount?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Auto-resize */
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      size = "md",
      error,
      helperText,
      label,
      required,
      showCharCount = false,
      maxLength,
      autoResize = false,
      className,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const helperId = `${generatedId}-helper`;
    const errorId = `${generatedId}-error`;

    const [charCount, setCharCount] = useState(
      String(value || defaultValue || "").length,
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCharCount(e.target.value.length);
        props.onChange?.(e);
      },
      [props.onChange],
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={generatedId}
          value={value}
          defaultValue={defaultValue}
          disabled={props.disabled}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperId}
          aria-required={required}
          className={cn(
            "w-full appearance-none transition-all duration-200 resize-none",
            "bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl",
            "focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo",
            sizeStyles[size],
            error &&
              "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            props.disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          onChange={handleChange}
          {...props}
        />

        {/* Character Count */}
        {showCharCount && maxLength && (
          <p className="mt-1.5 text-sm text-gray-500 text-right">
            {charCount}/{maxLength}
          </p>
        )}

        {/* Helper/Error Text */}
        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              "mt-1.5 text-sm",
              error ? "text-red-400" : "text-gray-500",
            )}
            role={error ? "alert" : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
