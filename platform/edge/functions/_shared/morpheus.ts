import { getEnv } from "./env.ts";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(value: unknown) {
  return trimString(value).replace(/\/$/, "");
}

type UpstreamTarget = {
  url: string;
  authToken?: string;
};

function resolveRuntimeUrl() {
  return normalizeUrl(
    getEnv("MORPHEUS_RUNTIME_URL")
    || getEnv("PHALA_API_URL")
    || "",
  );
}

export function resolveMorpheusRuntimeToken() {
  return trimString(
    getEnv("MORPHEUS_RUNTIME_TOKEN")
    || getEnv("PHALA_API_TOKEN")
    || getEnv("PHALA_SHARED_SECRET")
    || "",
  );
}

export function resolveOracleQueryUpstream(): UpstreamTarget {
  const legacy = normalizeUrl(getEnv("NEOORACLE_URL") || getEnv("NEOORACLE_SERVICE_URL") || "");
  if (legacy) return { url: `${legacy}/query` };

  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/oracle/query`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: NEOORACLE_URL or MORPHEUS_RUNTIME_URL");
}

export function resolveComputeExecuteUpstream(): UpstreamTarget {
  const legacy = normalizeUrl(getEnv("NEOCOMPUTE_URL") || getEnv("NEOCOMPUTE_SERVICE_URL") || "");
  if (legacy) return { url: `${legacy}/execute` };

  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/compute/execute`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: NEOCOMPUTE_URL or MORPHEUS_RUNTIME_URL");
}

export function resolveDatafeedPriceUpstream(symbol: string): UpstreamTarget {
  const legacy = normalizeUrl(getEnv("NEOFEEDS_URL") || getEnv("NEOFEEDS_SERVICE_URL") || "");
  if (legacy) return { url: `${legacy}/price/${encodeURIComponent(symbol)}` };

  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/feeds/price/${encodeURIComponent(symbol)}`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: NEOFEEDS_URL or MORPHEUS_RUNTIME_URL");
}

export function resolveVrfRandomUpstream(): UpstreamTarget {
  const legacy = normalizeUrl(getEnv("NEOVRF_URL") || getEnv("NEOVRF_SERVICE_URL") || "");
  if (legacy) return { url: `${legacy}/random` };

  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/vrf/random`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: NEOVRF_URL or MORPHEUS_RUNTIME_URL");
}
