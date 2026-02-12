import React from "react";
import { motion } from "framer-motion";
import { Inbox, Search, Plus } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: "default" | "compact" | "search";
}

export function EmptyState({
  title = "No data found",
  message = "There's nothing here yet.",
  icon,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const defaultIcon =
    variant === "search" ? (
      <Search size={32} className="text-erobo-purple" />
    ) : (
      <Inbox size={32} className="text-erobo-purple" />
    );

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <div className="w-12 h-12 rounded-full bg-erobo-purple/10 flex items-center justify-center mb-3">
          {icon || defaultIcon}
        </div>
        <p className="text-sm font-medium text-erobo-ink-soft/70 dark:text-slate-400">{title}</p>
        {action && (
          <Button variant="ghost" size="sm" onClick={action.onClick} className="mt-2 text-erobo-purple">
            <Plus size={14} className="mr-1" />
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col items-center justify-center py-16 text-center", className)}
    >
      <div className="w-20 h-20 rounded-full bg-erobo-purple/10 flex items-center justify-center mb-6">
        {icon || defaultIcon}
      </div>
      <h3 className="text-lg font-bold text-erobo-ink dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-erobo-ink-soft/70 dark:text-slate-400 max-w-sm mb-6">{message}</p>
      {action && (
        <Button onClick={action.onClick} className="erobo-btn">
          <Plus size={16} className="mr-2" />
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
