"use client";

import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const icons = { success: CheckCircle, error: AlertCircle, info: Info };
const colors = {
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export function Toast({ message, type, onDismiss }: ToastProps) {
  const Icon = icons[type];

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg shadow-lg ${colors[type]}`}>
      <Icon size={18} />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="p-1 hover:opacity-70">
        <X size={16} />
      </button>
    </div>
  );
}
