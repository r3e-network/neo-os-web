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
