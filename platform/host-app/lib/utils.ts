import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Trims and length-limits user input. Also strips HTML-like structure.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  let sanitized = input.trim();
  
  // Strip angle brackets
  sanitized = sanitized.replace(/[<>]/g, "");
  
  // Strip javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "");
  
  // Strip event handlers (e.g. onclick=)
  sanitized = sanitized.replace(/on\w+\s*=/gi, "").trim();
  
  // Decode basic HTML entities for pure text
  sanitized = sanitized.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/[<>]/g, "");

  return sanitized.slice(0, 1000);
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