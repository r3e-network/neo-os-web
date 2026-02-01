// =============================================================================
// Table Component - Data table with responsive design and Glass Theme
// =============================================================================

import { HTMLAttributes, forwardRef, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => {
  return (
    <div className="overflow-x-auto">
      <table ref={ref} className={cn("min-w-full divide-y divide-border/20", className)} {...props} />
    </div>
  );
});

Table.displayName = "Table";

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    return <thead ref={ref} className={cn("bg-muted/50", className)} {...props} />;
  },
);

TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    return <tbody ref={ref} className={cn("divide-y divide-border/10 bg-transparent", className)} {...props} />;
  },
);

TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => {
    return <tr ref={ref} className={cn("hover:bg-muted/30 transition-colors", className)} {...props} />;
  },
);

TableRow.displayName = "TableRow";

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn("px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider", className)}
        {...props}
      />
    );
  },
);

TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => {
    return <td ref={ref} className={cn("px-6 py-4 whitespace-nowrap text-sm text-foreground", className)} {...props} />;
  },
);

TableCell.displayName = "TableCell";
