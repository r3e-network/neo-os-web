type Translator = (key: string) => string;

const N3_CHAIN_TYPES = new Set(["neo-n3", "neo-n3-mainnet", "neo-n3-testnet"]);

function resolveChainType(chainType: unknown): string {
  if (typeof chainType === "string") return chainType;
  const value = (chainType as { value?: unknown } | null)?.value;
  return typeof value === "string" ? value : "";
}

export function isEvmChain(chainType: unknown): boolean {
  if (typeof chainType !== "string") {
    const value = (chainType as { value?: unknown } | null)?.value;
    if (typeof value !== "string") return false;
    chainType = value;
  }
  return (chainType as string).startsWith("evm-") || chainType === "eth" || chainType === "ethereum";
}

export function requireNeoChain(
  chainType: unknown,
  t?: Translator,
  fallbackMessage?: string,
  options?: { silent?: boolean },
): boolean {
  const resolved = resolveChainType(chainType);
  if (N3_CHAIN_TYPES.has(resolved)) return true;

  if (options?.silent) return false;

  let message = fallbackMessage || "";
  if (!message && typeof t === "function") {
    const primary = t("wrongChainMessage");
    message =
      primary && primary !== "wrongChainMessage" ? primary : t("wrongChain") || "Wrong network. Please switch to Neo N3.";
  }
  if (!message) message = "Wrong network. Please switch to Neo N3.";

  const ui = (
    globalThis as {
      uni?: { showToast?: (args: { title: string; icon?: string }) => void };
    }
  ).uni;
  if (ui?.showToast) {
    ui.showToast({ title: message, icon: "none" });
  }
  return false;
}
