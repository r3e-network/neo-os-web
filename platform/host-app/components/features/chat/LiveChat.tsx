"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, Users, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWalletAuthHeaders } from "@/lib/security/wallet-auth-client";
import type { ChatMessage } from "./types";

interface LiveChatProps {
  appId: string;
  walletAddress?: string;
  userName?: string;
  /** "floating" = fixed bottom-right widget (default), "inline" = embedded in parent container */
  mode?: "floating" | "inline";
}

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

export function LiveChat({ appId, walletAddress, userName, mode = "floating" }: LiveChatProps) {
  const isInline = mode === "inline";
  const [isOpen, setIsOpen] = useState(isInline);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Fetch messages
  useEffect(() => {
    if (!isOpen || !appId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/${appId}/messages?limit=50`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          setParticipantCount(data.participantCount || 0);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isOpen, appId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !walletAddress) return;

    const newMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: walletAddress,
      userName: userName || truncateAddress(walletAddress),
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    try {
      const authHeaders = await getWalletAuthHeaders();
      await fetch(`/api/chat/${appId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          content: newMessage.content,
        }),
      });
    } catch {
      // Silent fail - message already shown optimistically
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
      {/* Chat Toggle Button — hidden in inline mode */}
      {!isInline && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center justify-center",
            "w-14 h-14 rounded-full shadow-lg transition-all duration-300",
            "bg-emerald-500 hover:bg-emerald-600 text-white",
            isOpen && "rotate-90",
          )}
          aria-label="Toggle chat"
        >
          {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "flex flex-col rounded-2xl border border-erobo-purple/10 dark:border-white/10 bg-white dark:bg-erobo-bg-dark shadow-2xl overflow-hidden",
            isInline ? "w-full max-h-[400px]" : "fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[480px]",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-semibold">Live Chat</span>
            </div>
            <div className="flex items-center gap-1 text-sm opacity-90">
              <Users size={14} />
              <span>{participantCount}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading && messages.length === 0 ? (
              <div className="text-center text-erobo-ink-soft py-8">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-erobo-ink-soft py-8">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No messages yet</p>
                <p className="text-xs mt-1">Be the first to say hi!</p>
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} isOwn={msg.userId === walletAddress} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-erobo-purple/10 dark:border-white/10">
            {walletAddress ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 h-10 px-4 text-sm rounded-full border border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-erobo-bg-card text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-erobo-ink-soft py-2">Connect wallet to chat</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  if (message.type === "system") {
    return <div className="text-center text-xs text-erobo-ink-soft py-1">{message.content}</div>;
  }

  if (message.type === "tip") {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400 py-1">
        <Gift size={12} />
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
          <span className={cn("text-xs font-medium text-erobo-ink dark:text-slate-300", isOwn && "order-2")}>
            {message.userName}
          </span>
          <span suppressHydrationWarning className={cn("text-xs text-erobo-ink-soft/60", isOwn && "order-1")}>
            {timeAgo(message.timestamp)}
          </span>
        </div>
        <div
          className={cn(
            "inline-block px-3 py-2 rounded-2xl text-sm",
            isOwn
              ? "bg-emerald-500 text-white rounded-tr-sm"
              : "bg-erobo-purple/10 dark:bg-erobo-bg-card text-erobo-ink dark:text-white rounded-tl-sm",
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
