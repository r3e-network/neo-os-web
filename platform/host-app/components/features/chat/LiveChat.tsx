"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, Users, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import type { ChatMessage } from "./types";
import { fetchJSON, fetchOK } from "@/lib/fetch-client";

interface LiveChatProps {
  appId: string;
  walletAddress?: string;
  userName?: string;
}

type ChatMessagesResponse = {
  messages?: ChatMessage[];
  participantCount?: number;
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function LiveChat({ appId, walletAddress, userName }: LiveChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened; close on Escape
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Fetch messages
  useEffect(() => {
    if (!isOpen || !appId) return;
    let active = true;

    const fetchMessages = async () => {
      if (!active) return;
      setLoading(true);
      try {
        const data = await fetchJSON<ChatMessagesResponse>(
          `/api/chat/${encodeURIComponent(appId)}/messages?limit=50`,
        );
        if (!active) return;
        setMessages(data.messages || []);
        setParticipantCount(data.participantCount || 0);
      } catch (err) {
        logger.warn("Failed to fetch chat messages:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, appId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !walletAddress) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: tempId,
      userId: walletAddress,
      userName: userName || truncateAddress(walletAddress),
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    try {
      await fetchOK(`/api/chat/${encodeURIComponent(appId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          content: newMessage.content,
        }),
      });
    } catch (err) {
      logger.warn("Failed to send chat message:", err);
      setSendError("Failed to send message");
      // Rollback optimistic update on failure
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setInputValue(newMessage.content);
      setSendError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center",
          "w-12 h-12 rounded-full shadow-lg transition-all duration-300",
          "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50",
          isOpen && "rotate-90",
        )}
        aria-label="Toggle chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[480px] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Live chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} aria-hidden="true" />
              <span className="font-semibold">Live Chat</span>
            </div>
            <div className="flex items-center gap-1 text-sm opacity-90">
              <Users size={14} aria-hidden="true" />
              <span>{participantCount}</span>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            aria-live="polite"
            tabIndex={0}
          >
            {loading && messages.length === 0 ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
                  >
                    <div className="space-y-1.5 max-w-[70%]">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton
                        className={`h-10 ${i % 2 === 0 ? "w-48" : "w-36"} rounded-xl`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle
                  className="mx-auto mb-2 h-8 w-8 opacity-50"
                  aria-hidden="true"
                />
                <p>No messages yet</p>
                <p className="text-xs mt-1">Be the first to say hi!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.userId === walletAddress}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200">
            {walletAddress ? (
              <div className="flex items-center gap-2">
                <input
                  id="chat-message"
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setSendError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  maxLength={500}
                  className="flex-1 h-10 px-4 text-sm rounded-full border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  aria-label="Send message"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 py-2">
                Connect wallet to chat
              </div>
            )}
            {sendError && (
              <div className="px-1 pt-1 text-xs text-red-500">{sendError}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  if (message.type === "system") {
    return (
      <div className="text-center text-xs text-gray-500 py-1">
        {message.content}
      </div>
    );
  }

  if (message.type === "tip") {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-amber-600 py-1">
        <Gift size={12} aria-hidden="true" />
        <span>
          {message.userName} tipped {message.tipAmount}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
        {message.userName?.charAt(0).toUpperCase() || "?"}
      </div>
      <div className={cn("max-w-[70%]", isOwn && "text-right")}>
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              "text-xs font-medium text-gray-700 truncate",
              isOwn && "order-2",
            )}
          >
            {message.userName}
          </span>
          <span className={cn("text-xs text-gray-500", isOwn && "order-1")}>
            {timeAgo(message.timestamp)}
          </span>
        </div>
        <div
          className={cn(
            "inline-block px-3 py-2 rounded-2xl text-sm break-words",
            isOwn
              ? "bg-emerald-500 text-white rounded-tr-sm"
              : "bg-gray-100 text-gray-900 rounded-tl-sm",
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
