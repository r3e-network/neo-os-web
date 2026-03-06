// Centralized service definitions used by both API routes and client hooks.

export const PLATFORM_SERVICES = [
  { name: "neofeeds", url: "http://neofeeds.service-layer.svc.cluster.local:8080" },
  { name: "neoaccounts", url: "http://neoaccounts.service-layer.svc.cluster.local:8085" },
  { name: "confcompute", url: "http://confcompute.service-layer.svc.cluster.local:8081" },
  { name: "conforacle", url: "http://conforacle.service-layer.svc.cluster.local:8082" },
  { name: "datafeed", url: "http://datafeed.service-layer.svc.cluster.local:8083" },
  { name: "vrf", url: "http://vrf.service-layer.svc.cluster.local:8084" },
  { name: "automation", url: "http://automation.service-layer.svc.cluster.local:8086" },
  { name: "gasbank", url: "http://gasbank.service-layer.svc.cluster.local:8087" },
  { name: "edge-gateway", url: "http://edge-gateway.platform.svc.cluster.local:8787" },
] as const;

export const HEALTH_CHECK_TIMEOUT_MS = 5000;
export const HEALTH_POLL_INTERVAL_MS = 30000;
export const HEALTH_STALE_TIME_MS = 10000;
export const DEFAULT_STALE_TIME_MS = 60000;
