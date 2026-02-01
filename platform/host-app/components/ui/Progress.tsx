"use client";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className = "" }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}
