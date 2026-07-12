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

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
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

/** Read the currently authorized EVM account WITHOUT prompting (eth_accounts). "" if none. */
export async function getEvmAccount(): Promise<string> {
  const eth = getInjectedEthereum();
  if (!eth) return "";
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? "";
  } catch {
    return "";
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

/** Convert a decimal GAS amount (e.g. "0.10") to wei (18 decimals) as a bigint.
 * Accepts canonical non-negative decimals only: signs (a negative would silently
 * flip positive), exponent forms ("1e-7"), multi-dot strings, and other
 * malformed input throw a descriptive error instead of mis-scaling. */
export function gasToWei(amount: string | number): bigint {
  const text = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`Invalid GAS amount: "${text}"`);
  }
  const [whole, frac = ""] = text.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

// ── richer ABI codec (address / uint / dynamic bytes / tuple) ────────────────
// Beyond the uint-only dice path. Still dependency-free (no web3 bundle);
// covered by apps/shared/test/evm-chain.abi.test.ts against ethers reference
// vectors. Supports the exact shapes the Neo Message lane needs:
// sendMessage(address,bytes,uint64), inboxOf(address)->uint256[],
// getMessage(uint256)->struct.

function stripHex(value: string): string {
  return String(value || "").replace(/^0x/, "");
}
function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
function hexToBytes(hex: string): Uint8Array {
  const h = stripHex(hex);
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export type AbiEncParam =
  | { t: "address"; v: string }
  | { t: "uint"; v: number | bigint | string } // uint8..uint256 share one encoding
  | { t: "bytes"; v: Uint8Array };

/** ABI-encode a parameter list (head/tail) into a hex string WITHOUT a selector. */
export function encodeParams(params: AbiEncParam[]): string {
  const head: string[] = [];
  const tail: string[] = [];
  let tailOffset = params.length * 32; // bytes
  for (const p of params) {
    if (p.t === "bytes") {
      head.push(toUint256Hex(tailOffset));
      let data = bytesToHex(p.v);
      if (data.length % 64 !== 0) data = data.padEnd(data.length + (64 - (data.length % 64)), "0");
      const chunk = toUint256Hex(p.v.length) + data;
      tail.push(chunk);
      tailOffset += chunk.length / 2;
    } else if (p.t === "address") {
      head.push(stripHex(p.v).toLowerCase().padStart(64, "0"));
    } else {
      head.push(toUint256Hex(p.v));
    }
  }
  return head.join("") + tail.join("");
}

/** Decode a function return of type uint256[] (e.g. inboxOf). */
export function decodeUintArray(returnHex: string): bigint[] {
  const h = stripHex(returnHex);
  if (h.length < 128) return [];
  const base = Number(BigInt("0x" + h.slice(0, 64))) * 2; // array offset (hex chars)
  const len = Number(BigInt("0x" + h.slice(base, base + 64)));
  const out: bigint[] = [];
  for (let i = 0; i < len; i += 1) {
    out.push(BigInt("0x" + h.slice(base + 64 + i * 64, base + 64 + (i + 1) * 64)));
  }
  return out;
}

export interface DecodedEvmMessage {
  sender: string;
  recipient: string;
  envelope: Uint8Array;
  unlockTime: number;
  sentAt: number;
  revealed: boolean;
  plaintext: string;
}

/** Decode getMessage(uint256) -> (address,address,bytes,uint64,uint64,bool,string). */
export function decodeMessageStruct(returnHex: string): DecodedEvmMessage {
  const h = stripHex(returnHex);
  // An eth_call against a wrong or non-contract address returns "0x"; fail
  // with context instead of a raw "Cannot convert 0x to a BigInt".
  if (h.length < 64) {
    throw new Error("decodeMessageStruct: empty or truncated ABI return");
  }
  const base = Number(BigInt("0x" + h.slice(0, 64))) * 2; // tuple offset (hex chars)
  if (h.length < base + 7 * 64) {
    throw new Error("decodeMessageStruct: truncated ABI return");
  }
  const word = (i: number) => h.slice(base + i * 64, base + (i + 1) * 64);
  const readDyn = (relOffsetBytes: number): Uint8Array => {
    const p = base + relOffsetBytes * 2;
    const len = Number(BigInt("0x" + h.slice(p, p + 64)));
    return hexToBytes(h.slice(p + 64, p + 64 + len * 2));
  };
  const envelope = readDyn(Number(BigInt("0x" + word(2))));
  const plaintext = bytesToUtf8(readDyn(Number(BigInt("0x" + word(6)))));
  return {
    sender: "0x" + word(0).slice(24),
    recipient: "0x" + word(1).slice(24),
    envelope,
    unlockTime: Number(BigInt("0x" + word(3))),
    sentAt: Number(BigInt("0x" + word(4))),
    revealed: BigInt("0x" + word(5)) !== 0n,
    plaintext,
  };
}

export interface EvmCall {
  address: string; // contract address
  selector: string; // 4-byte function selector, e.g. "0x43046844" for placeBet(uint8)
  uintArgs?: (number | bigint | string)[]; // encoded as uint256 (covers uint8..uint256)
  /** Pre-encoded ABI argument blob (hex, no selector). Takes precedence over uintArgs
   * when present — used for calls with non-uint params (address/bytes), see encodeParams. */
  argsHex?: string;
  valueWei?: bigint | string; // native GAS to send (payable)
  /** Optional event topic[0] to locate in the receipt; returns its indexed topic[1] as `eventId`. */
  eventTopic?: string;
  /** Abort before broadcast if the active account changed after form validation. */
  expectedFrom?: string;
  /** Fires immediately after eth_sendTransaction, before receipt polling. */
  onTransactionSent?: (txid: string) => void;
}

export interface EvmCallResult {
  txid: string;
  eventId?: string;
}

export const EVM_ACCOUNT_CHANGED_ERROR = "Active EVM account changed before transaction submission.";

interface EvmReceipt {
  status?: string;
  logs?: { address?: string; topics?: string[] }[];
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

/** Read-only contract call (eth_call) via the injected wallet. Returns the raw
 * 0x-prefixed return data; the caller decodes the static-typed return words. */
export async function evmCall(address: string, selector: string, uintArgs: (number | bigint | string)[] = []): Promise<string> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  const data = selector + (uintArgs ?? []).map(toUint256Hex).join("");
  return (await eth.request({ method: "eth_call", params: [{ to: address, data }, "latest"] })) as string;
}

/** Read-only contract call with a pre-encoded ABI argument blob (for non-uint args). */
export async function evmCallEncoded(address: string, selector: string, argsHex = ""): Promise<string> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  const data = selector + stripHex(argsHex);
  return (await eth.request({ method: "eth_call", params: [{ to: address, data }, "latest"] })) as string;
}

/** EIP-191 personal_sign with the active wallet account; returns the 0x signature. */
export async function evmPersonalSign(message: string, expectedFrom?: string): Promise<string> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  let accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) accounts = [await connectEvm()];
  const from = accounts[0];
  if (
    expectedFrom &&
    String(from).toLowerCase() !== String(expectedFrom).toLowerCase()
  ) {
    throw new Error(EVM_ACCOUNT_CHANGED_ERROR);
  }
  const hexMessage = "0x" + bytesToHex(utf8ToBytes(message));
  return (await eth.request({ method: "personal_sign", params: [hexMessage, from] })) as string;
}

/** Decode the i-th 32-byte word of an ABI return as an unsigned integer. */
export function decodeReturnWord(returnHex: string, index: number): bigint {
  const hex = String(returnHex || "").replace(/^0x/, "");
  const word = hex.slice(index * 64, index * 64 + 64);
  return word ? BigInt("0x" + word) : 0n;
}

/** Send a (possibly payable) contract transaction via the injected wallet (raw eth_sendTransaction). */
export async function evmInvoke(call: EvmCall): Promise<EvmCallResult> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No EVM wallet detected.");
  let accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) accounts = [(await connectEvm())];
  const from = accounts[0];
  if (
    call.expectedFrom &&
    String(from).toLowerCase() !== String(call.expectedFrom).toLowerCase()
  ) {
    throw new Error(EVM_ACCOUNT_CHANGED_ERROR);
  }
  const data =
    call.argsHex !== undefined
      ? call.selector + stripHex(call.argsHex)
      : call.selector + (call.uintArgs ?? []).map(toUint256Hex).join("");
  const value = call.valueWei !== undefined ? "0x" + BigInt(call.valueWei).toString(16) : undefined;
  const txid = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to: call.address, data, ...(value ? { value } : {}) }],
  })) as string;
  try {
    call.onTransactionSent?.(txid);
  } catch {
    // The transaction is already in-flight. Local persistence failure must not
    // alter receipt/fault handling for the on-chain call.
  }
  const receipt = await waitForReceipt(eth, txid);
  if (receipt.status !== undefined && receipt.status !== "0x1") {
    throw new Error("Transaction reverted on Neo X.");
  }
  let eventId: string | undefined;
  if (call.eventTopic) {
    const topic = call.eventTopic.toLowerCase();
    const contract = call.address.toLowerCase();
    const logs = (receipt.logs ?? []).filter(
      (entry) =>
        String(entry.address ?? "").toLowerCase() === contract &&
        String(entry.topics?.[0] ?? "").toLowerCase() === topic,
    );
    const indexedId = logs.length === 1 ? logs[0]?.topics?.[1] : undefined;
    if (indexedId && /^0x[0-9a-fA-F]{64}$/.test(indexedId)) {
      eventId = BigInt(indexedId).toString();
    }
  }
  return { txid, eventId };
}
