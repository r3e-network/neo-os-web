"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import type { NotificationEvent } from "@/lib/notifications/types";
import { fetchJSON, fetchOK } from "@/lib/fetch-client";
import { useAuthStore } from "@/lib/auth/store";

interface NotificationDropdownProps {
  walletAddress?: string;
}

type NotificationEventsResponse = {
  events?: NotificationEvent[];
};

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

export function NotificationDropdown({
  walletAddress,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const authenticated = useAuthStore((state) => state.authenticated);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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
    if (!walletAddress || !authenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setNotifError(null);
      setLoading(false);
      return;
    }
    let active = true;
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const data = await fetchJSON<NotificationEventsResponse>(
          `/api/notifications/events?wallet=${encodeURIComponent(walletAddress)}&limit=10`,
        );
        if (!active) return;
        const events = data.events || [];
        setNotifications(events);
        setUnreadCount(events.filter((n) => !n.read).length);
      } catch (err) {
        logger.warn("Failed to fetch notifications:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchNotifications();
    return () => {
      active = false;
    };
  }, [walletAddress, authenticated]);

  const markAsRead = async (id: string) => {
    if (!walletAddress || !authenticated) return;
    setNotifError(null);
    try {
      await fetchOK(`/api/notifications/events/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      logger.warn("Failed to mark notification as read:", err);
      setNotifError("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    if (!walletAddress || !authenticated) return;
    setNotifError(null);
    try {
      await fetchOK(
        `/api/notifications/events/read-all?wallet=${encodeURIComponent(walletAddress)}`,
        { method: "POST" },
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      logger.warn("Failed to mark all notifications as read:", err);
      setNotifError("Failed to mark all as read");
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2.5 rounded-xl border transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
          isOpen
            ? "bg-neo/10 border-neo/30 text-neo"
            : "border-transparent text-gray-600 hover:bg-gray-100/50 hover:border-gray-200/50",
        )}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell
          size={18}
          className={cn(
            "transition-transform duration-300",
            isOpen && "rotate-12",
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-red-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] border border-white/20">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+12px)] w-80 sm:w-96 rounded-2xl border border-gray-200/50 bg-white/90 backdrop-blur-2xl shadow-2xl z-50 transform origin-top-right transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none",
        )}
        aria-hidden={!isOpen}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative z-10 w-full flex flex-col max-h-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50">
            <h3 className="font-bold text-[15px] text-gray-900 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-neo/20 text-neo text-[10px] font-black uppercase ">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="py-1 px-2.5 text-xs font-semibold text-neo hover:text-white hover:bg-neo transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg border border-transparent hover:border-neo/50"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifError && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-xs">
              {notifError}
            </div>
          )}

          {/* Notification List */}
          <div
            className="overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 flex-1 custom-scrollbar"
            tabIndex={0}
          >
            {loading ? (
              <div className="p-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-4 py-3 rounded-xl mb-1 bg-gray-50/50"
                  >
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <Skeleton className="h-3.5 w-3/4 rounded-md" />
                      <Skeleton className="h-3 w-1/2 rounded-md opacity-70" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Bell className="h-7 w-7 text-gray-400" aria-hidden="true" />
                </div>
                <p className="text-[15px] font-bold text-gray-900 mb-1">
                  All caught up!
                </p>
                <p className="text-sm text-gray-500">
                  You have no new notifications.
                </p>
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex items-start gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 group relative overflow-hidden",
                      !n.read
                        ? "bg-neo/5 hover:bg-neo/10"
                        : "hover:bg-gray-100/50 border border-transparent hover:border-gray-200/50",
                    )}
                    onClick={() => !n.read && markAsRead(n.id)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !n.read) {
                        e.preventDefault();
                        markAsRead(n.id);
                      }
                    }}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neo rounded-r-full shadow-[0_0_10px_rgba(0,229,153,0.5)]" />
                    )}

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 text-xl group-hover:scale-110 transition-transform duration-300">
                      {typeIcons[n.type] || "📬"}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p
                          className={cn(
                            "text-sm truncate",
                            !n.read
                              ? "font-bold text-gray-900"
                              : "font-medium text-gray-700",
                          )}
                          title={n.title}
                        >
                          {n.title}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-400 shrink-0 uppercase ">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-xs truncate",
                          !n.read
                            ? "text-gray-600 font-medium"
                            : "text-gray-500",
                        )}
                        title={n.content}
                      >
                        {n.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
