/**
 * EVM (Neo X) wallet + chain helpers for the multi-chain miniapp OS.
 *
 * Dependency-free: talks to an injected EIP-1193 provider (MetaMask / any EVM
 * wallet) via `window.ethereum` using raw JSON-RPC, with precomputed function
 * selectors / event topics. No web3 library is bundled. The Neo N3 NeoVM path
 * (wallet-sdk / dAPI) is untouched — these helpers only run when the connected
 * wallet is on a Neo X network. ChainService routes to them when
 * {@link detectEvmNetwork} reports a supported chain.
 */

export type EvmNetwork = "neo-x-mainnet" | "neo-x-testnet";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

// Neo X chain ids: mainnet 47763 (0xba93), T4 testnet 12227332 (0xba9304).
export const NEO_X_CHAINS: Record<number, EvmNetwork> = {
  47763: "neo-x-mainnet",
  12227332: "neo-x-testnet",
};

export const NEO_X_CONFIG: Record<EvmNetwork, { chainIdHex: string; chainId: number; rpc: string; explorer: string; name: string }> = {
  "neo-x-mainnet": { chainIdHex: "0xba93", chainId: 47763, rpc: "https://mainnet-1.rpc.banelabs.org", explorer: "https://xexplorer.neo.org", name: "Neo X Mainnet" },
  "neo-x-testnet": { chainIdHex: "0xba9304", chainId: 12227332, rpc: "https://neoxt4seed1.ngd.network", explorer: "https://xt4scan.ngd.network", name: "Neo X TestNet T4" },
};

export function getInjectedEthereum(): Eip1193Provider | null {
  const g = globalThis as unknown as { ethereum?: Eip1193Provider; window?: { ethereum?: Eip1193Provider } };
  return g.ethereum ?? g.window?.ethereum ?? null;
}

export function hasEvmWallet(): boolean {
  return getInjectedEthereum() !== null;
}

export function isEvmNetwork(network: string | null | undefined): network is EvmNetwork {
  return network === "neo-x-mainnet" || network === "neo-x-testnet";
}

/** Read the injected wallet's current chain WITHOUT prompting a connection.
 * Returns a supported Neo X network, or null if no EVM wallet / unsupported chain. */
export async function detectEvmNetwork(): Promise<EvmNetwork | null> {
  const eth = getInjectedEthereum();
  if (!eth) return null;
  try {
    const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
    const chainId = Number.parseInt(String(chainIdHex), 16);
    return NEO_X_CHAINS[chainId] ?? null;
  } catch {
    return null;
  }
}

/** Prompt connection (eth_requestAccounts) and return the active address. */
export async function connectEvm(): Promise<string> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected. Install MetaMask (or any EVM wallet) to use Neo X.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accounts?.[0];
  if (!addr) throw new Error("EVM wallet returned no account.");
  return addr;
}

/** Ensure the wallet is on the requested Neo X network, switching/adding if needed. */
export async function ensureNeoXNetwork(network: EvmNetwork): Promise<void> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  const cfg = NEO_X_CONFIG[network];
  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (Number.parseInt(String(current), 16) === cfg.chainId) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: cfg.chainIdHex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: cfg.chainIdHex,
          chainName: cfg.name,
          nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
          rpcUrls: [cfg.rpc],
          blockExplorerUrls: [cfg.explorer],
        }],
      });
    } else {
      throw err;
    }
  }
}

// ── raw ABI encoding helpers (uint-only — sufficient for the dice lane) ───────
function toUint256Hex(value: number | bigint | string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

/** Convert a decimal GAS amount (e.g. "0.10") to wei (18 decimals) as a bigint. */
export function gasToWei(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).trim().split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

export interface EvmCall {
  address: string; // contract address
  selector: string; // 4-byte function selector, e.g. "0x43046844" for placeBet(uint8)
  uintArgs?: (number | bigint | string)[]; // encoded as uint256 (covers uint8..uint256)
  valueWei?: bigint | string; // native GAS to send (payable)
  /** Optional event topic[0] to locate in the receipt; returns its indexed topic[1] as `eventId`. */
  eventTopic?: string;
}

export interface EvmCallResult {
  txid: string;
  eventId?: string;
}

interface EvmReceipt {
  status?: string;
  logs?: { topics?: string[] }[];
}

async function waitForReceipt(eth: Eip1193Provider, txid: string, timeoutMs = 60_000): Promise<EvmReceipt> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const receipt = (await eth.request({ method: "eth_getTransactionReceipt", params: [txid] })) as EvmReceipt | null;
    if (receipt) return receipt;
    if (Date.now() > deadline) throw new Error("Timed out waiting for transaction confirmation.");
    await new Promise((r) => setTimeout(r, 2500));
  }
}

/** Send a (possibly payable) contract transaction via the injected wallet (raw eth_sendTransaction). */
export async function evmInvoke(call: EvmCall): Promise<EvmCallResult> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  let accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) accounts = [(await connectEvm())];
  const from = accounts[0];
  const data = call.selector + (call.uintArgs ?? []).map(toUint256Hex).join("");
  const value = call.valueWei !== undefined ? "0x" + BigInt(call.valueWei).toString(16) : undefined;
  const txid = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to: call.address, data, ...(value ? { value } : {}) }],
  })) as string;
  const receipt = await waitForReceipt(eth, txid);
  if (receipt.status !== undefined && receipt.status !== "0x1") {
    throw new Error("Transaction reverted on Neo X.");
  }
  let eventId: string | undefined;
  if (call.eventTopic) {
    const topic = call.eventTopic.toLowerCase();
    const log = (receipt.logs ?? []).find((l) => (l.topics?.[0] ?? "").toLowerCase() === topic);
    if (log?.topics?.[1]) eventId = BigInt(log.topics[1]).toString();
  }
  return { txid, eventId };
}
