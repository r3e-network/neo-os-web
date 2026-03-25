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
  return normalizeUrl(getEnv("MORPHEUS_RUNTIME_URL") || "");
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
  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/oracle/query`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: MORPHEUS_RUNTIME_URL");
}

export function resolveComputeExecuteUpstream(): UpstreamTarget {
  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/compute/execute`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: MORPHEUS_RUNTIME_URL");
}

export function resolveDatafeedPriceUpstream(symbol: string): UpstreamTarget {
  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/feeds/price/${encodeURIComponent(symbol)}`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: MORPHEUS_RUNTIME_URL");
}

export function resolveVrfRandomUpstream(): UpstreamTarget {
  const runtime = resolveRuntimeUrl();
  if (runtime) {
    return {
      url: `${runtime}/vrf/random`,
      authToken: resolveMorpheusRuntimeToken() || undefined,
    };
  }

  throw new Error("missing required env var: MORPHEUS_RUNTIME_URL");
}
