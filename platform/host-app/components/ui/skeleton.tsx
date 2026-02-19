import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="status" aria-label="Loading" className={cn("animate-pulse rounded-md bg-white/10", className)} {...props} />
  ),
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
