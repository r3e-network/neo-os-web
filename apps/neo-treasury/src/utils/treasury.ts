// Neo Treasury Data Fetching Utilities
// Uses global price feed from host-app

// Neo N3 RPC endpoints (mainnet).
// Keep this list aligned with the host-app CSP `connect-src` allowlist.
// Audit fix H-3 (miniapp review): dropped `mainnet1.neo.coz.io` — per the
// project's mainnet-RPC memo (`reference_mainnet_rpc.md`) that endpoint is
// dead; every call would fail-then-fallback. Preferred order now matches the
// healthy-endpoint list documented in the memo.
const RPC_ENDPOINTS = [
  "https://mainnet2.neo.coz.io:443",
  "https://mainnet3.neo.coz.io:443",
  "https://mainnet4.neo.coz.io:443",
  "https://mainnet5.neo.coz.io:443",
  "https://rpc10.n3.nspcc.ru:10331",
];

// Contract addresses (from shared constants)
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_CONTRACT = BLOCKCHAIN_CONSTANTS.GAS_HASH;

// Import shared price utils
import { getPrices as getSharedPrices, type PriceData } from "@shared/utils/price";

// Re-export PriceData for consumers
export type { PriceData };

// A feed record older than this (but still within the shared 1-hour staleness
// window, otherwise getPrices() returns null) is presented as "delayed": the USD
// total still renders but the dedicated price signal turns amber. This remains
// separate from native-balance cache freshness. Five minutes matches the shared
// price cache TTL, so a record that has not advanced within one cache cycle is
// flagged.
const PRICE_FRESH_WITHIN_MS = 5 * 60 * 1000;

// Fixed community-attributed founder groups mirrored from the public reference
// below and rechecked on 2026-07-11. The reference also names separate Neo
// Foundation/exchange/migration addresses; those are intentionally excluded so
// this app does not silently mix a founder watchlist with a different ownership
// category. This is a source reference, not an official ownership registry.
export const WATCHLIST_REFERENCE_URL = "https://neo-treasury.pages.dev/";

// Treasury wallet addresses - Da Hongfei & Erik Zhang
export const DA_HONGFEI_ADDRESSES = [
  "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw",
  "NZjXReMViE1yV5UxYD9idxcCt7QTNztNCT",
  "NaGHNnUiCg9KwmMiuSgtL15DP23LC2q9zT",
  "NPBQEx4pa8Sbsb7omTHEwU7exidEXzcSbr",
  "NitWQHuf92YvmwYBM7uorLv1rL3Ui7oS9m",
  "NhogFdE68Ekm5vBbS1YKagwYJGTgwVKNat",
  "NcHGkZWZLBTHMW2goppyDqBhar11wniBS5",
  "NZ9bdW1iRysQ54NhnEmRwXua8DhNqVkC8U",
  "NUB9WBKZm7fNe91qKxvxPSQoFpxPR9kna2",
  "NV35AyvJvj8T2SoD1D79oWcUwwiZDWfMim",
  "NdcBU7pkQZhLafCyhkQQy1nDA3prR4bHRH",
  "NNYYEXtivso9vxEuQJsqFAKiLEq1Q7qGu7",
  "NeozoqRLowoPG5edg7WbSYb1H1BU61YHkp",
  "Nds6RtduGsYk2hh2HTVwvprT6H2MATVo96",
  "NSKuKfAutVz2gRM1cKMCZGE4VZjZunKFKr",
  "NfecRDDivLYfSswT45QvYREb58PzUZeBTv",
  "Nb6V2ZmygXqTobbcJUJFKfNK8U6YqjEJcL",
  "NYv2guLgzKBkVtVyi6tmz3UfCYruSWJCwg",
  "Ne8SNZbt9LeMfZwkZ26rxvxPxnQj9U9vT4",
  "NZbiECdfVkwhbnD5Dpxofj9GWyiwHTW4N1",
  "NTAxtsVrqkTTk3nY5zQEK7puBDaWhfw12Y",
  "NcHXn5ygdY3AbvBuhtPy3qzEAsCukdx5qR",
];

export const ERIK_ZHANG_ADDRESSES = [
  "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv",
  "NXBhD662PnMFHZ1jJnreVTx71tdmqtrjL9",
  "Nhvpo1kz1iv8KuBB1KGAbUxHet4V1Gzz4u",
  "NYz4EgdsM1ATNedAbxFJw499kDBWhc8uut",
  "NXsJYaejf5EFrFgSuPp4XUXajQ8BXUVoN8",
  "NV17k94y5JS4mBjETmeKyHs3y3kxEfiRsM",
  "NTE8wUDSXVk7oqbG1kZKTxSPX5Xj2nsLjd",
  "Ncuf6FUDjJP2iAR7aA1tahv75A3eEMf6Nw",
  "NaQ2TU4SvUpHg5XHRXVxoCzCSsrQFURY19",
  "Nf1H8BirpajkjsnS4MEe8N7BEpBYWzKSfU",
  "NbkpbWnAJ6YzXZp1t6pa8fZ91mKx5PXBX7",
  "NMihXf3sXP69pUdBog3f5fQAymNDsxuA2z",
  "NiR15z3ieXTZpWozXDaqD5rNMskaRSFnop",
  "Ndqa8Zn1N9tJv9Z6gbMYtSAtG8kzyE4veT",
  "NVgBBNH9MTeppYMjttdtTkJKkhgpgNYzJJ",
  "NWcHZ95TNzfVCfvK2AvY5xyEw6ur3oD3wL",
  "NfeTbHCGhdmTsQppX2U7bUGTwav4jtQC4e",
  "NgRc6K5LWGfsY7aQchiwfM5Fw5Ue2vifTT",
  "NRRSagrw8cz2ZsRnumPLNniF3onU5FUGJx",
  "NPgnVsXPa22drSqSUy1o3eAfqs6Eb4rK1f",
  "Nb7UjsXESNNt4BYE3FjfuGnkQ5GPvzqfrP",
  "NVg7LjGcUSrgxgjX3zEgqaksfMaiS8Z6e1",
];

export interface TokenBalance {
  neo: number;
  gas: number;
  /** Exact base-unit values returned by Neo RPC. Safe to aggregate as BigInt. */
  neoRaw: string;
  gasRaw: string;
  /** Exact human-readable values. These never pass through IEEE-754 rounding. */
  neoDisplay: string;
  gasDisplay: string;
}

export interface WalletBalance extends TokenBalance {
  address: string;
  label: string;
  /** True when this wallet's RPC balance read failed (figures are not real 0). */
  failed?: boolean;
}

export interface CategoryBalance {
  name: string;
  wallets: WalletBalance[];
  totalNeo: number;
  totalGas: number;
  totalNeoRaw: string;
  totalGasRaw: string;
  totalNeoDisplay: string;
  totalGasDisplay: string;
  /** Null when the price feed was unavailable (render as "—", not $0). */
  totalUsd: number | null;
  /** Number of wallets in this group whose balance read failed. */
  failedCount: number;
}

export interface TreasuryData {
  categories: CategoryBalance[];
  totalNeo: number;
  totalGas: number;
  totalNeoRaw: string;
  totalGasRaw: string;
  totalNeoDisplay: string;
  totalGasDisplay: string;
  /** Null when the price feed was unavailable (render as "—", not $0). */
  totalUsd: number | null;
  /** Null when the price feed was unavailable. */
  prices: PriceData | null;
  lastUpdated: number;
  /** Total wallets across all groups whose balance read failed. */
  failedCount: number;
  /**
   * True when the price feed returned a usable-but-delayed quote (its on-chain
   * record is older than {@link PRICE_FRESH_WITHIN_MS} yet still within the
   * shared freshness window). The dedicated quote status turns amber in this
   * case even though the USD total renders. Always false when prices are null
   * (that path already surfaces the "price feed unavailable" warning).
   */
  priceStale: boolean;
}

/**
 * Formats an unsigned base-unit balance without converting it to Number.
 * Native balances can exceed Number.MAX_SAFE_INTEGER even when their rendered
 * token value looks ordinary, so the public dashboard keeps this path exact.
 */
export function formatTreasuryTokenAmount(value: unknown, decimals: number) {
  const raw = typeof value === "bigint" ? value.toString() : String(value ?? "").trim();
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Invalid native-token balance");
  }

  const normalized = raw.replace(/^0+(?=\d)/, "") || "0";
  const padded = normalized.padStart(decimals + 1, "0");
  const whole = decimals === 0 ? padded : padded.slice(0, -decimals);
  const fraction = decimals === 0 ? "" : padded.slice(-decimals).replace(/0+$/, "");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}

function parseNativeAmount(value: unknown, asset: "NEO" | "GAS") {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${asset} balance returned by RPC is invalid`);
  }
  return BigInt(raw);
}

// framework-exempt: external-wallet RPC balance failover (plan §3.6) — this
// sweep reads NEP-17 balances for ARBITRARY external watchlist addresses (the
// founders' wallets, not the connected wallet) against a pinned MAINNET
// multi-endpoint failover list, independent of the host's network/bridge.
// There is no framework surface for arbitrary-address multi-endpoint RPC
// until n3index/framework rpc lands; keep raw until then.
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      // Timeout-bound so a hung endpoint actually fails over to the next one
      // instead of stalling the whole balance sweep.
      const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.result !== undefined) return data.result;
      if (data.error) {
        const errMsg = data.error?.message;
        const sanitized = typeof errMsg === "string" && errMsg.length < 100 ? errMsg : "RPC request failed";
        throw new Error(sanitized);
      }
    } catch (_e) {
      /* RPC endpoint unreachable — try next */
    }
  }
  throw new Error("All RPC endpoints failed");
}

// Get NEP-17 balances for an address
async function getNep17Balances(address: string): Promise<TokenBalance> {
  const result = (await rpcCall("getnep17balances", [address])) as {
    balance?: Array<{ assethash: string; amount: string }>;
  };

  let neoRaw = 0n;
  let gasRaw = 0n;

  for (const b of result.balance ?? []) {
    const assetHash = String(b.assethash ?? "").toLowerCase();
    if (assetHash === NEO_CONTRACT.toLowerCase()) {
      neoRaw = parseNativeAmount(b.amount, "NEO");
    } else if (assetHash === GAS_CONTRACT.toLowerCase()) {
      gasRaw = parseNativeAmount(b.amount, "GAS");
    }
  }

  const neoRawString = neoRaw.toString();
  const gasRawString = gasRaw.toString();
  return {
    // Number values remain available only for estimated USD arithmetic and
    // backwards-compatible consumers. Exact native-token UI uses *Display.
    neo: Number(neoRaw),
    gas: Number(gasRaw) / 1e8,
    neoRaw: neoRawString,
    gasRaw: gasRawString,
    neoDisplay: formatTreasuryTokenAmount(neoRawString, 0),
    gasDisplay: formatTreasuryTokenAmount(gasRawString, 8),
  };
}

// Fetch prices from global price feed. Returns null when the feed is missing OR
// frozen past the shared freshness window — the caller renders USD as "—".
export async function fetchPrices(): Promise<PriceData | null> {
  return getSharedPrices();
}

// True when a price quote is actually usable for a USD total. BOTH native
// asset legs must be finite and positive: accepting a valid NEO quote alongside
// a missing/zero GAS quote would silently undervalue every watched GAS balance.
// An incomplete/frozen feed is treated like a missing one so the dashboard
// renders "—" + the unavailable warning instead of a plausible but wrong USD
// number.
function hasUsablePrice(prices: PriceData | null): boolean {
  if (!prices) return false;
  const neoUsd = prices.usd?.neo ?? prices.neo;
  const gasUsd = prices.usd?.gas ?? prices.gas;
  return (
    Number.isFinite(neoUsd) && neoUsd > 0 &&
    Number.isFinite(gasUsd) && Number(gasUsd) > 0
  );
}

// True when a (non-null) price quote's on-chain record is older than the "fresh"
// threshold — usable, but the hero should show the amber "delayed" signal.
function isPriceDelayed(prices: PriceData | null, now: number): boolean {
  if (!hasUsablePrice(prices)) return false;
  const recordTs = prices!.feedRecordTimestamp;
  if (!recordTs || recordTs <= 0) return true;
  return now - recordTs > PRICE_FRESH_WITHIN_MS;
}

// Max addresses fetched concurrently per chunk. Bounds RPC fan-out so a slow
// fail-over endpoint is not hammered by 21 simultaneous requests while still
// turning O(n) sequential round-trips into O(n/chunk) parallel ones.
const BALANCE_FETCH_CONCURRENCY = 8;

// Fetch balances for a list of addresses.
//
// Addresses are fetched in bounded-concurrency chunks via Promise.allSettled so
// that (a) first paint no longer waits on ~21 sequential round-trips and (b) a
// single transient RPC failure for one wallet does not reject the whole batch.
// A failed wallet is recorded as 0/0 and the load only fails if EVERY address
// failed. Result order matches the input address order.
async function fetchAddressBalances(
  addresses: string[],
  labelPrefix: string
): Promise<{
  wallets: WalletBalance[];
  totalNeo: number;
  totalGas: number;
  totalNeoRaw: string;
  totalGasRaw: string;
  totalNeoDisplay: string;
  totalGasDisplay: string;
  failedCount: number;
}> {
  const indexed = addresses
    .map((address, index) => ({ address, index }))
    .filter((entry): entry is { address: string; index: number } => Boolean(entry.address));

  const wallets: WalletBalance[] = [];
  let totalNeoRaw = 0n;
  let totalGasRaw = 0n;
  let failedCount = 0;

  for (let start = 0; start < indexed.length; start += BALANCE_FETCH_CONCURRENCY) {
    const chunk = indexed.slice(start, start + BALANCE_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((entry) => getNep17Balances(entry.address)),
    );

    settled.forEach((outcome, offset) => {
      const entry = chunk[offset];
      if (!entry) return;
      const { address, index } = entry;
      const label = `${labelPrefix} Wallet ${index + 1}`;
      if (outcome.status === "fulfilled") {
        const wallet = outcome.value;
        wallets.push({ address, label, ...wallet });
        totalNeoRaw += BigInt(wallet.neoRaw);
        totalGasRaw += BigInt(wallet.gasRaw);
      } else {
        // A single transient RPC failure must not blank out the other
        // known-good balances. Flag the wallet as failed (so the UI can mark
        // it with an em-dash rather than a misleading 0) and continue; only
        // surface an error if EVERY address failed (handled below).
        failedCount += 1;
        const reason = outcome.reason;
        const msg = reason instanceof Error ? reason.message : "Unknown error";
        console.warn(`[neo-treasury] balance fetch failed for ${address}: ${msg}`);
        wallets.push({
          address,
          label,
          neo: 0,
          gas: 0,
          neoRaw: "0",
          gasRaw: "0",
          neoDisplay: "0",
          gasDisplay: "0",
          failed: true,
        });
      }
    });
  }

  const totalNeoRawString = totalNeoRaw.toString();
  const totalGasRawString = totalGasRaw.toString();
  return {
    wallets,
    totalNeo: Number(totalNeoRaw),
    totalGas: Number(totalGasRaw) / 1e8,
    totalNeoRaw: totalNeoRawString,
    totalGasRaw: totalGasRawString,
    totalNeoDisplay: formatTreasuryTokenAmount(totalNeoRawString, 0),
    totalGasDisplay: formatTreasuryTokenAmount(totalGasRawString, 8),
    failedCount,
  };
}

// Compute a category's USD total, or null when the price feed is unavailable.
// A feed that resolves with a non-positive NEO leg is treated as unavailable
// (see hasUsablePrice): a zeroed/frozen quote must yield "—", not a fake $0.
function categoryUsd(totalNeo: number, totalGas: number, prices: PriceData | null): number | null {
  if (!hasUsablePrice(prices) || !Number.isFinite(totalNeo) || !Number.isFinite(totalGas)) return null;
  const neoUsd = prices!.usd?.neo ?? prices!.neo;
  const gasUsd = prices!.usd?.gas ?? prices!.gas!;
  return totalNeo * neoUsd + totalGas * gasUsd;
}

// Fetch Da Hongfei treasury data. `prices` is null when the feed is unavailable.
export async function fetchDaHongfeiData(prices: PriceData | null): Promise<CategoryBalance> {
  const balances = await fetchAddressBalances(DA_HONGFEI_ADDRESSES, "Da");
  const categoryPrices = balances.failedCount === balances.wallets.length ? null : prices;
  return { name: "Da Hongfei", ...balances, totalUsd: categoryUsd(balances.totalNeo, balances.totalGas, categoryPrices) };
}

// Fetch Erik Zhang treasury data. `prices` is null when the feed is unavailable.
export async function fetchErikZhangData(prices: PriceData | null): Promise<CategoryBalance> {
  const balances = await fetchAddressBalances(ERIK_ZHANG_ADDRESSES, "Erik");
  const categoryPrices = balances.failedCount === balances.wallets.length ? null : prices;
  return { name: "Erik Zhang", ...balances, totalUsd: categoryUsd(balances.totalNeo, balances.totalGas, categoryPrices) };
}

// Fetch all treasury data
export async function fetchTreasuryData(): Promise<TreasuryData> {
  // A price-feed failure must not blank the whole dashboard: the balances are
  // independently fetchable. Proceed with null prices and let USD render as "—".
  let prices: PriceData | null = null;
  try {
    prices = await fetchPrices();
  } catch (e) {
    console.warn("[neo-treasury] price feed unavailable, showing balances without USD:", e instanceof Error ? e.message : String(e));
  }

  // Fetch both founders' data in parallel
  const [daData, erikData] = await Promise.all([fetchDaHongfeiData(prices), fetchErikZhangData(prices)]);

  const categories = [daData, erikData];
  const totalNeoRaw = BigInt(daData.totalNeoRaw) + BigInt(erikData.totalNeoRaw);
  const totalGasRaw = BigInt(daData.totalGasRaw) + BigInt(erikData.totalGasRaw);
  const totalNeo = Number(totalNeoRaw);
  const totalGas = Number(totalGasRaw) / 1e8;
  const totalUsd = categoryUsd(totalNeo, totalGas, prices);
  const failedCount = daData.failedCount + erikData.failedCount;
  const watchedCount = daData.wallets.length + erikData.wallets.length;
  if (watchedCount === 0 || failedCount === watchedCount) {
    throw new Error("Failed to fetch balances for every watched treasury address");
  }
  const now = Date.now();
  const priceStale = isPriceDelayed(prices, now);

  return {
    categories,
    totalNeo,
    totalGas,
    totalNeoRaw: totalNeoRaw.toString(),
    totalGasRaw: totalGasRaw.toString(),
    totalNeoDisplay: formatTreasuryTokenAmount(totalNeoRaw, 0),
    totalGasDisplay: formatTreasuryTokenAmount(totalGasRaw, 8),
    totalUsd,
    prices,
    lastUpdated: now,
    failedCount,
    priceStale,
  };
}
