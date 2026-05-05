export type NeoNetwork = "mainnet" | "testnet";

export const MAINNET_MAGIC = 860833102;
export const TESTNET_MAGIC = 894710606;

export function isNeoNetwork(value: unknown): value is NeoNetwork {
  return value === "mainnet" || value === "testnet";
}

export function normalizeNeoNetwork(value: unknown): NeoNetwork | null {
  if (typeof value === "number") {
    if (value === MAINNET_MAGIC) return "mainnet";
    if (value === TESTNET_MAGIC) return "testnet";
    return null;
  }

  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === String(MAINNET_MAGIC)) return "mainnet";
  if (raw === String(TESTNET_MAGIC)) return "testnet";
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function neoNetworkLabel(network: NeoNetwork): string {
  return network === "testnet" ? "Neo N3 Testnet" : "Neo N3 Mainnet";
}

export function getWalletNetworkGuardReason(
  walletNetwork: NeoNetwork | null | undefined,
  targetNetwork: NeoNetwork,
): string | null {
  if (!walletNetwork) {
    return `Wallet network is not verified. Reconnect with a NEP-21 wallet or Direct WIF on ${neoNetworkLabel(targetNetwork)}.`;
  }
  if (walletNetwork !== targetNetwork) {
    return `Wallet is on ${neoNetworkLabel(walletNetwork)} but this page targets ${neoNetworkLabel(targetNetwork)}. Switch wallet network before submitting.`;
  }
  return null;
}

export function assertWalletNetworkMatchesTarget(
  walletNetwork: NeoNetwork | null | undefined,
  targetNetwork: NeoNetwork,
): void {
  const reason = getWalletNetworkGuardReason(walletNetwork, targetNetwork);
  if (reason) throw new Error(reason);
}
