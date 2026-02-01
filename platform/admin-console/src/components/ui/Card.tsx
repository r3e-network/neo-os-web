// =============================================================================
// Card Component - Container with E-Robo Glass Design
// =============================================================================

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "glass" | "erobo";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "erobo", children, ...props }, ref) => {
    const variants = {
      default: "bg-card text-card-foreground shadow-sm rounded-xl border border-border",
      bordered: "bg-transparent border border-border rounded-xl",
      glass: "glass-card rounded-[24px]", // Uses global glass-card utility
      erobo: "erobo-card", // Uses E-Robo global utility
    };

    // Default to 'erobo' for that premium feel unless specified otherwise
    return (
      <div ref={ref} className={cn(variants[variant], className)} {...props}>
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("px-6 py-4 border-b border-border/10", className)} {...props}>
        {children}
      </div>
    );
  },
);

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3 ref={ref} className={cn("text-lg font-semibold text-foreground tracking-tight", className)} {...props}>
        {children}
      </h3>
    );
  },
);

CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("px-6 py-4", className)} {...props}>
        {children}
      </div>
    );
  },
);

CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("px-6 py-4 border-t border-border/10 bg-muted/20", className)} {...props}>
        {children}
      </div>
    );
  },
);

CardFooter.displayName = "CardFooter";
