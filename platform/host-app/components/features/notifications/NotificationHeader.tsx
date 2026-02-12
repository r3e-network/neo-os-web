"use client";

import { CheckCheck } from "lucide-react";

interface NotificationHeaderProps {
  onMarkAllRead: () => void;
  unreadCount: number;
}

export function NotificationHeader({ onMarkAllRead, unreadCount }: NotificationHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-erobo-purple/10 dark:border-white/10">
      <h3 className="font-semibold text-erobo-ink dark:text-white">Notifications</h3>
      {unreadCount > 0 && (
        <button
          onClick={onMarkAllRead}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
        >
          <CheckCheck size={14} />
          Mark all read
        </button>
      )}
    </div>
  );
}
