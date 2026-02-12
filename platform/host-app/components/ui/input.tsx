import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-erobo-purple/15 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm text-erobo-ink dark:text-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-erobo-ink-soft/60 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 focus-visible:border-neo disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
