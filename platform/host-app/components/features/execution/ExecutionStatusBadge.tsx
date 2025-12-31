/**
 * ExecutionStatusBadge Component
 *
 * Displays real-time execution status with visual indicators.
 */

import { cn } from "@/lib/utils";
import type { ExecutionStatus } from "@/hooks/useExecutionStatus";

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const statusConfig: Record<ExecutionStatus, { label: string; color: string; icon: string }> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: "⏳",
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: "⚙️",
  },
  success: {
    label: "Success",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: "✅",
  },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: "❌" },
  timeout: { label: "Timeout", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: "⏰" },
};

export function ExecutionStatusBadge({ status, className }: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        config.color,
        className,
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
