import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-erobo-ink text-white hover:brightness-110 shadow-[0_18px_45px_rgba(27,27,47,0.3)] border border-transparent",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-md hover:shadow-red-500/20",
        outline:
          "border border-white/60 dark:border-white/10 bg-transparent hover:bg-erobo-peach/30 dark:hover:bg-white/10 text-erobo-ink dark:text-slate-200",
        secondary:
          "bg-gradient-to-r from-erobo-purple to-erobo-pink text-white hover:brightness-110 shadow-[0_12px_30px_rgba(159,157,243,0.35)]",
        ghost: "hover:bg-erobo-peach/30 dark:hover:bg-white/10 text-erobo-ink-soft dark:text-slate-300",
        link: "text-erobo-purple underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
