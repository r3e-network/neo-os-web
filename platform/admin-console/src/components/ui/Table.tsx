// =============================================================================
// Table Component - Data table with responsive design
// =============================================================================

import { HTMLAttributes, forwardRef, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => {
  return (
    <div className="overflow-x-auto">
      <table ref={ref} className={cn("min-w-full divide-y divide-gray-200 dark:divide-gray-700", className)} {...props} />
    </div>
  );
});

Table.displayName = "Table";

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    return <thead ref={ref} className={cn("bg-gray-50 dark:bg-gray-800", className)} {...props} />;
  },
);

TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    return <tbody ref={ref} className={cn("divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900", className)} {...props} />;
  },
);

TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => {
    return <tr ref={ref} className={cn("hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", className)} {...props} />;
  },
);

TableRow.displayName = "TableRow";

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn("px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider", className)}
        {...props}
      />
    );
  },
);

TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => {
    return <td ref={ref} className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100", className)} {...props} />;
  },
);

TableCell.displayName = "TableCell";
