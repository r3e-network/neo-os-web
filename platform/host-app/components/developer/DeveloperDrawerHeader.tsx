"use client";

import { X } from "lucide-react";

type DeveloperDrawerHeaderProps = {
  onClose: () => void;
};

export function DeveloperDrawerHeader({ onClose }: DeveloperDrawerHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/80">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">MiniApp Template Builder</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">No-code style config + definition preview</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 dark:hover:bg-white/10"
        >
          <X className="text-gray-500 dark:text-gray-400" size={20} />
        </button>
      </div>
    </div>
  );
}
