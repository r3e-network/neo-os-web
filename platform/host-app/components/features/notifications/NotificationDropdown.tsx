"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { NotificationEvent } from "@/lib/notifications/types";

interface NotificationDropdownProps {
  walletAddress?: string;
}

const typeIcons: Record<string, string> = {
  miniapp_win: "🎉",
  miniapp_loss: "😢",
  balance_deposit: "💰",
  balance_withdraw: "📤",
  chain_no_block: "⚠️",
  chain_congestion: "🚦",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationDropdown({ walletAddress }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (!walletAddress) return;
    let active = true;
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications/events?wallet=${encodeURIComponent(walletAddress)}&limit=10`, { signal: AbortSignal.timeout(30000) });
        if (res.ok && active) {
          const data = await res.json();
          setNotifications(data.events || []);
          setUnreadCount(data.events?.filter((n: NotificationEvent) => !n.read).length || 0);
        }
      } catch (err) {
        logger.warn("Failed to fetch notifications:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchNotifications();
    return () => { active = false; };
  }, [walletAddress]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/events/${id}/read`, { method: "POST", signal: AbortSignal.timeout(30000) });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      logger.warn("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!walletAddress) return;
    try {
      await fetch(`/api/notifications/events/read-all?wallet=${encodeURIComponent(walletAddress)}`, { method: "POST", signal: AbortSignal.timeout(30000) });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      logger.warn("Failed to mark all notifications as read:", err);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllAsRead} className="text-xs text-emerald-500 hover:text-emerald-600 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors",
                    !n.read && "bg-emerald-50/50 dark:bg-emerald-900/10",
                  )}
                  onClick={() => !n.read && markAsRead(n.id)}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !n.read) { e.preventDefault(); markAsRead(n.id); } }}
                >
                  <span className="text-xl">{typeIcons[n.type] || "📬"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-emerald-500 mt-2" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
