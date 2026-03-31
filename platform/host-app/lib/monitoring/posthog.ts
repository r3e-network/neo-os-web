/**
 * PostHog Analytics Integration
 * Thin wrapper around posthog-js for event tracking, user identification,
 * and page view tracking. Gracefully no-ops when API key is not configured.
 */

import posthog from "posthog-js";

let initialized = false;

/**
 * Initialize the PostHog client.
 * Safe to call multiple times; only the first call with a valid key takes effect.
 * Called automatically by the first tracking function if not already initialized.
 */
export function initPostHog(): void {
  if (initialized || typeof window === "undefined") return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

  posthog.init(apiKey, {
    api_host: host,
    capture_pageview: false, // We handle page views explicitly
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: true,
  });

  initialized = true;
}

/** Whether PostHog has been successfully initialized. */
export function isPostHogReady(): boolean {
  return initialized;
}

/**
 * Track a named event with optional properties.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.capture(name, properties);
}

/**
 * Track a page view. Pass the pathname (e.g. from Next.js router).
 */
export function trackPageView(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: path });
}

/**
 * Identify the current user and attach optional traits (e.g. plan, role).
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

/**
 * Reset user identity (call on logout).
 */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}
