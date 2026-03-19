"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const defaultFieldClassName =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all placeholder-gray-500 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 dark:border-gray-700 dark:bg-white/5 dark:text-white dark:placeholder-gray-400";

const glassFieldClassName =
  "w-full cursor-pointer rounded-xl border border-gray-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-gray-900 backdrop-blur-md transition-all placeholder-gray-500 hover:border-neo/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-400";

type FieldShellProps = {
  id?: string;
  label?: string;
  labelClassName?: string;
  children: ReactNode;
};

function FieldShell({ id, label, labelClassName, children }: FieldShellProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={cn("mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300", labelClassName)}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelClassName?: string;
  variant?: "default" | "glass";
};

export function TextField({ label, id, className, labelClassName, variant = "default", ...props }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} labelClassName={labelClassName}>
      <input id={id} className={cn(variant === "glass" ? glassFieldClassName : defaultFieldClassName, className)} {...props} />
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  labelClassName?: string;
  variant?: "default" | "glass";
};

export function TextAreaField({ label, id, className, labelClassName, variant = "default", ...props }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} labelClassName={labelClassName}>
      <textarea id={id} className={cn(variant === "glass" ? glassFieldClassName : defaultFieldClassName, "resize-none", className)} {...props} />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  labelClassName?: string;
  variant?: "default" | "glass";
  children: ReactNode;
};

export function SelectField({ label, id, className, labelClassName, variant = "default", children, ...props }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} labelClassName={labelClassName}>
      <select id={id} className={cn(variant === "glass" ? glassFieldClassName : defaultFieldClassName, className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}
