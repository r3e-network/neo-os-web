// =============================================================================
// Input Component - Form input with label
// =============================================================================

import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground/80">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "border-border/30 bg-muted/30 block w-full rounded-md text-foreground shadow-sm focus:border-primary-400 focus:ring-primary-400 sm:text-sm",
          error && "border-danger-500 focus:border-danger-500 focus:ring-danger-500",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = "Input";
