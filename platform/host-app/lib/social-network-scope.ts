export type SocialNetworkScope = "mainnet" | "testnet";

export function normalizeSocialNetworkScope(value: unknown): SocialNetworkScope | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function getSocialNetworkScope(queryValue: unknown, bodyValue?: unknown): SocialNetworkScope {
  return normalizeSocialNetworkScope(bodyValue) || normalizeSocialNetworkScope(queryValue) || "testnet";
}

export function scopedSocialAppId(appId: string, network: SocialNetworkScope): string {
  return `${appId}__${network}`;
}

export function unscopedSocialAppId(appId: string): string {
  return appId.replace(/__(mainnet|testnet)$/i, "");
}
