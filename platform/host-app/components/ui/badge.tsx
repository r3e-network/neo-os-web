import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-neo/10 text-neo-dark hover:bg-neo/20",
        secondary: "border-transparent bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20",
        destructive: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
        outline: "text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10",
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
