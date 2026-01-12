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
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers like onclick=
    .replace(/&lt;/g, "")
    .replace(/&gt;/g, "")
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
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email);
}

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return text.replace(/[&<>"'\/]/g, (char) => map[char] || char);
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

/**
 * Formats a date as relative time (e.g., "2d ago", "1w ago")
 * @example formatTimeAgo("2024-01-01") => "3mo ago"
 */
export function formatTimeAgo(date?: string | Date | null): string {
  if (!date) return "Recently";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Gets a localized field value from an object with _zh suffix fields
 * @example getLocalizedField(app, 'name', 'zh') => app.name_zh || app.name
 */
export function getLocalizedField<T extends Record<string, unknown>>(item: T, field: string, locale: string): string {
  if (locale === "zh") {
    const zhField = `${field}_zh` as keyof T;
    if (item[zhField]) return String(item[zhField]);
  }
  return String(item[field as keyof T] ?? "");
}
