import type { OneGateVaultNetwork } from "./onegate-vault-types";

export function resolveOneGateVaultTxProxyUrl(
  network: OneGateVaultNetwork,
  optionTxProxyUrl?: string,
): string {
  const networkSuffix = network === "mainnet" ? "MAINNET" : "TESTNET";
  const explicit = String(
    optionTxProxyUrl ||
      process.env[`ONEGATE_VAULT_TX_PROXY_URL_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_TX_PROXY_URL ||
      process.env[`TX_PROXY_URL_${networkSuffix}`] ||
      process.env.TX_PROXY_URL ||
      process.env.TXPROXY_URL ||
      "",
  ).trim();
  if (explicit) return explicit;

  const configuredEdgeBase = String(
    process.env.ONEGATE_VAULT_EDGE_BASE ||
      process.env.MORPHEUS_EDGE_BASE ||
      process.env.NEXT_PUBLIC_MORPHEUS_EDGE_BASE ||
      "",
  ).trim();
  if (configuredEdgeBase) {
    return `${configuredEdgeBase.replace(/\/+$/, "")}/${network}/txproxy`;
  }

  const legacyEdgeBase = String(process.env.EDGE_API_BASE || "").trim();
  if (/meshmini\.app/i.test(legacyEdgeBase)) {
    const normalized = legacyEdgeBase.replace(/\/+$/, "");
    return /\/(mainnet|testnet)$/i.test(normalized)
      ? `${normalized}/txproxy`
      : `${normalized}/${network}/txproxy`;
  }

  return `https://edge.meshmini.app/${network}/txproxy`;
}

export function parseTxProxyJson(responseText: string): Record<string, unknown> {
  if (!responseText.trim()) return {};
  try {
    const parsed = JSON.parse(responseText);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function formatTxProxyHttpError(status: number, responseText: string): string {
  const compact = responseText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return compact
    ? `tx-proxy rejected OneGate Vault payout (${status}): ${compact}`
    : `tx-proxy rejected OneGate Vault payout (${status})`;
}

export function getTxProxyErrorMessage(
  body: Record<string, unknown>,
  status: number,
  responseText: string,
): string {
  const error = body.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return formatTxProxyHttpError(status, responseText);
}

export async function resolveOneGateVaultRewardSource(
  network: OneGateVaultNetwork,
  optionRewardSource: string | undefined,
  normalizeHash160: (value: string) => string,
): Promise<string> {
  const networkSuffix = network === "mainnet" ? "MAINNET" : "TESTNET";
  const explicit = String(
    optionRewardSource ||
      process.env[`ONEGATE_VAULT_REWARD_SOURCE_${networkSuffix}`] ||
      process.env[`ONEGATE_VAULT_REWARD_SOURCE_HASH_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_REWARD_SOURCE ||
      process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH ||
      "",
  ).trim();
  if (explicit && explicit !== "PLATFORM_SPONSOR") return explicit;

  const rewardWif = String(
    process.env[`ONEGATE_VAULT_REWARD_WIF_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_REWARD_WIF ||
      "",
  ).trim();
  if (!rewardWif) return "";

  try {
    const sdk = await import("@r3e/neo-js-sdk/browser");
    const account = sdk.Account.fromWIF(rewardWif);
    return normalizeHash160(account.address || account.scriptHash);
  } catch {
    return "";
  }
}
