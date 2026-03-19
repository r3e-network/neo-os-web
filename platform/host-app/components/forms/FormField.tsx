"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const baseFieldClassName =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all placeholder-gray-500 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 dark:border-gray-700 dark:bg-white/5 dark:text-white dark:placeholder-gray-400";

type FieldShellProps = {
  id?: string;
  label: string;
  children: ReactNode;
};

function FieldShell({ id, label, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ label, id, className, ...props }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <input id={id} className={cn(baseFieldClassName, className)} {...props} />
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextAreaField({ label, id, className, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <textarea id={id} className={cn(baseFieldClassName, "resize-none", className)} {...props} />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
};

export function SelectField({ label, id, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <select id={id} className={cn(baseFieldClassName, className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}
