import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-erobo-purple/10 text-erobo-purple-dark hover:bg-erobo-purple/20",
        secondary: "border-transparent bg-erobo-pink/15 text-erobo-ink hover:bg-erobo-pink/25",
        destructive: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
        outline: "text-erobo-ink-soft dark:text-slate-300 border-white/60 dark:border-white/10",
        success: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20",
        warning: "border-transparent bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
