"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationStore } from "@/lib/notifications";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationHeader } from "./NotificationHeader";
import { NotificationList } from "./NotificationList";

export function NotificationDropdown() {
  const { address, connected } = useWalletStore();
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (connected && address) {
      fetchNotifications(address);
      // Poll every 30 seconds
      const interval = setInterval(() => fetchNotifications(address), 30000);
      return () => clearInterval(interval);
    }
  }, [connected, address, fetchNotifications]);

  if (!connected) return null;

  const handleMarkRead = (id: string) => {
    if (address) markAsRead(address, [id]);
  };

  const handleMarkAllRead = () => {
    if (address) markAllAsRead(address);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-erobo-ink-soft hover:text-erobo-ink dark:text-slate-400 dark:hover:text-white"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-erobo-bg-dark border border-erobo-purple/10 dark:border-white/10 rounded-lg shadow-lg z-50">
            <NotificationHeader onMarkAllRead={handleMarkAllRead} unreadCount={unreadCount} />
            <NotificationList notifications={notifications} loading={loading} onMarkRead={handleMarkRead} />
          </div>
        </>
      )}
    </div>
  );
}
