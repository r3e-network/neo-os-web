import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes potentially dangerous characters and HTML tags
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers like onclick=
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/&lt;/g, "") // Remove HTML entity <
    .replace(/&gt;/g, "") // Remove HTML entity >
    .trim()
    .slice(0, 1000); // Limit length to prevent DoS
}

/**
 * Validates email format with strict RFC 5322 compliant regex
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string" || email.length > 254) return false;

  // RFC 5322 compliant email regex (simplified but strict)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email);
}

/**
 * HTML escape character map - defined once to avoid repeated object creation
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";
  return text.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Formats a number with K/M suffix for compact display
 * @example formatNumber(1500) => "1.5K"
 * @example formatNumber(1500000) => "1.5M"
 */
export function formatNumber(num?: number | null): string {
  if (num === undefined || num === null) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

type TimeAgoTranslate = (key: string, options?: Record<string, string | number>) => string;

type TimeAgoOptions = {
  t?: TimeAgoTranslate;
  locale?: string;
  maxRelativeDays?: number;
};

const FALLBACK_TIME: Record<string, string> = {
  "time.recently": "Recently",
  "time.today": "Today",
  "time.yesterday": "Yesterday",
  "time.now": "Just now",
  "time.minutesAgo": "{count}m ago",
  "time.hoursAgo": "{count}h ago",
  "time.daysAgo": "{count}d ago",
  "time.weeksAgo": "{count}w ago",
  "time.monthsAgo": "{count}mo ago",
  "time.short.seconds": "s",
  "time.short.minutes": "m",
  "time.short.hours": "h",
  "time.short.days": "d",
  "time.short.weeks": "w",
  "time.short.months": "mo",
};

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

function translateTime(
  key: string,
  options?: Record<string, string | number>,
  t?: TimeAgoTranslate,
): string {
  const fallback = interpolate(FALLBACK_TIME[key] ?? key, options);
  if (!t) return fallback;
  const translated = t(key, options);
  return translated === key ? fallback : translated;
}

/**
 * Formats a date as relative time (e.g., "2d ago", "1w ago")
 * @example formatTimeAgo("2024-01-01") => "3mo ago"
 */
export function formatTimeAgo(date?: string | Date | null, options?: TimeAgoOptions): string {
  if (!date) return translateTime("time.recently", undefined, options?.t);
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return translateTime("time.today", undefined, options?.t);
  if (days === 1) return translateTime("time.yesterday", undefined, options?.t);
  if (days < 7) return translateTime("time.daysAgo", { count: days }, options?.t);
  if (days < 30) return translateTime("time.weeksAgo", { count: Math.floor(days / 7) }, options?.t);
  return translateTime("time.monthsAgo", { count: Math.floor(days / 30) }, options?.t);
}

/**
 * Short relative time formatting (e.g., "3m", "2h")
 */
export function formatTimeAgoShort(date?: string | Date | null, options?: TimeAgoOptions): string {
  if (!date) return translateTime("time.recently", undefined, options?.t);
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);
  const maxRelativeDays = options?.maxRelativeDays ?? 7;

  if (diffSeconds < 5) return translateTime("time.now", undefined, options?.t);
  if (diffSeconds < 60) {
    return `${diffSeconds}${translateTime("time.short.seconds", undefined, options?.t)}`;
  }
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes}${translateTime("time.short.minutes", undefined, options?.t)}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}${translateTime("time.short.hours", undefined, options?.t)}`;
  }
  const days = Math.floor(hours / 24);
  if (days < maxRelativeDays) {
    return `${days}${translateTime("time.short.days", undefined, options?.t)}`;
  }

  const locale = options?.locale;
  return new Date(date).toLocaleDateString(locale);
}
