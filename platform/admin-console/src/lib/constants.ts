// Shared admin-console timing and service labels.
//
// Runtime service URLs come from the edge health endpoint, which now reads the
// configured external Oracle / AA integration URLs instead of hard-coded local
// service-layer DNS names.

export const PLATFORM_SERVICES = [
  "morpheus-datafeed",
  "morpheus-automation",
  "morpheus-compute",
  "morpheus-vrf",
  "morpheus-oracle",
  "txproxy",
  "gasbank",
  "globalsigner",
  "neoaccounts",
  "aa-relay",
  "morpheus-paymaster",
  "edge-gateway",
] as const;

export const HEALTH_CHECK_TIMEOUT_MS = 5000;
export const HEALTH_POLL_INTERVAL_MS = 30000;
export const HEALTH_STALE_TIME_MS = 10000;
export const DEFAULT_STALE_TIME_MS = 60000;
