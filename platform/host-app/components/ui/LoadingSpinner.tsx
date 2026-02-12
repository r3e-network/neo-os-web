import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-erobo-purple/20 border-t-erobo-purple ${sizeClasses[size]} ${className}`}
    />
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-erobo-bg-card rounded-lg p-6 flex flex-col items-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-erobo-ink-soft dark:text-slate-300">{message}</p>
      </div>
    </div>
  );
}
