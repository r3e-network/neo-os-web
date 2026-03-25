import { getExternalIntegrationConfig, resolveNeoNetwork, type NeoNetwork } from "../../../apps/shared/constants/rpc";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(value: unknown) {
  return trimString(value).replace(/\/$/, "");
}

function uniqueUrls(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeUrl(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function resolveEnvSequence(network: NeoNetwork, key: string) {
  const upper = network.toUpperCase();
  return [
    process.env[`MORPHEUS_${upper}_${key}` as keyof NodeJS.ProcessEnv],
    process.env[`MORPHEUS_${key}` as keyof NodeJS.ProcessEnv],
  ];
}

export function resolveMorpheusRuntimeCandidates(networkInput?: string | null) {
  const network = resolveNeoNetwork(networkInput);
  const config = getExternalIntegrationConfig(network);
  return uniqueUrls([
    ...resolveEnvSequence(network, "RUNTIME_URL"),
    ...config.morpheusRuntimeUrls,
    config.morpheusRuntimeUrl,
  ]);
}

export function resolveMorpheusRuntimeToken(networkInput?: string | null) {
  const network = resolveNeoNetwork(networkInput);
  return trimString(
    resolveEnvSequence(network, "RUNTIME_TOKEN").find(Boolean)
      || resolveEnvSequence(network, "PHALA_API_TOKEN").find(Boolean)
      || process.env.PHALA_API_TOKEN
      || process.env.PHALA_SHARED_SECRET
      || "",
  );
}

export function resolveMorpheusPublicApiCandidates(networkInput?: string | null) {
  const network = resolveNeoNetwork(networkInput);
  const config = getExternalIntegrationConfig(network);
  return uniqueUrls([
    ...resolveEnvSequence(network, "PUBLIC_API_URL"),
    process.env.NEXT_PUBLIC_MORPHEUS_PUBLIC_API_URL,
    ...config.morpheusPublicApiUrls,
    config.morpheusPublicApiUrl,
  ]);
}
