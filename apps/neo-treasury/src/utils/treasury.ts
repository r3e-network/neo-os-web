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
// total still renders but the hero shows the amber "cached/stale" signal rather
// than the green "live synced" dot. Five minutes matches the shared price cache
// TTL, so a record that has not advanced within one cache cycle is flagged.
const PRICE_FRESH_WITHIN_MS = 5 * 60 * 1000;

// Treasury wallet addresses - Da Hongfei & Erik Zhang (from neo-treasury.pages.dev)
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
}

export interface WalletBalance {
  address: string;
  label: string;
  neo: number;
  gas: number;
  /** True when this wallet's RPC balance read failed (figures are not real 0). */
  failed?: boolean;
}

export interface CategoryBalance {
  name: string;
  wallets: WalletBalance[];
  totalNeo: number;
  totalGas: number;
  /** Null when the price feed was unavailable (render as "—", not $0). */
  totalUsd: number | null;
  /** Number of wallets in this group whose balance read failed. */
  failedCount: number;
}

export interface TreasuryData {
  categories: CategoryBalance[];
  totalNeo: number;
  totalGas: number;
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
   * shared freshness window). The hero shows the amber "stale" signal in this
   * case even though the USD total renders. Always false when prices are null
   * (that path already surfaces the "price feed unavailable" warning).
   */
  priceStale: boolean;
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

  let neo = 0;
  let gas = 0;

  for (const b of result.balance ?? []) {
    // Guard against a malformed RPC amount (null/non-numeric): an unchecked
    // parseInt would yield NaN and poison the aggregated category totals.
    const amount = Number(b.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    if (b.assethash === NEO_CONTRACT) {
      neo = amount; // NEO has 0 decimals
    } else if (b.assethash === GAS_CONTRACT) {
      gas = amount / 1e8; // GAS has 8 decimals
    }
  }

  return { neo, gas };
}

// Fetch prices from global price feed. Returns null when the feed is missing OR
// frozen past the shared freshness window — the caller renders USD as "—".
export async function fetchPrices(): Promise<PriceData | null> {
  return getSharedPrices();
}

// True when a price quote is actually usable for a USD total. A feed that
// resolves with a non-positive NEO leg (0, negative, or non-finite) is NOT a
// live quote — a frozen/zeroed feed must be treated like a missing one so the
// dashboard renders the "—" placeholder + "price feed unavailable" warning
// rather than a fresh-looking $0 total.
function hasUsablePrice(prices: PriceData | null): boolean {
  if (!prices) return false;
  const neoUsd = prices.usd?.neo ?? prices.neo;
  return Number.isFinite(neoUsd) && neoUsd > 0;
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
): Promise<{ wallets: WalletBalance[]; totalNeo: number; totalGas: number; failedCount: number }> {
  const indexed = addresses
    .map((address, index) => ({ address, index }))
    .filter((entry): entry is { address: string; index: number } => Boolean(entry.address));

  const wallets: WalletBalance[] = [];
  let totalNeo = 0;
  let totalGas = 0;
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
        wallets.push({ address, label, neo: outcome.value.neo, gas: outcome.value.gas });
        totalNeo += outcome.value.neo;
        totalGas += outcome.value.gas;
      } else {
        // A single transient RPC failure must not blank out the other
        // known-good balances. Flag the wallet as failed (so the UI can mark
        // it with an em-dash rather than a misleading 0) and continue; only
        // surface an error if EVERY address failed (handled below).
        failedCount += 1;
        const reason = outcome.reason;
        const msg = reason instanceof Error ? reason.message : "Unknown error";
        console.warn(`[neo-treasury] balance fetch failed for ${address}: ${msg}`);
        wallets.push({ address, label, neo: 0, gas: 0, failed: true });
      }
    });
  }

  // Only a total wipeout (no address resolved) is treated as a load failure.
  if (failedCount > 0 && failedCount === wallets.length) {
    throw new Error(`Failed to fetch balances for all ${labelPrefix} addresses`);
  }

  return { wallets, totalNeo, totalGas, failedCount };
}

// Compute a category's USD total, or null when the price feed is unavailable.
// A feed that resolves with a non-positive NEO leg is treated as unavailable
// (see hasUsablePrice): a zeroed/frozen quote must yield "—", not a fake $0.
function categoryUsd(totalNeo: number, totalGas: number, prices: PriceData | null): number | null {
  if (!hasUsablePrice(prices)) return null;
  const neoUsd = prices!.usd?.neo ?? prices!.neo;
  const gasUsd = prices!.usd?.gas ?? prices!.gas ?? 0;
  return totalNeo * neoUsd + totalGas * gasUsd;
}

// Fetch Da Hongfei treasury data. `prices` is null when the feed is unavailable.
export async function fetchDaHongfeiData(prices: PriceData | null): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas, failedCount } = await fetchAddressBalances(DA_HONGFEI_ADDRESSES, "Da");
  return { name: "Da Hongfei", wallets, totalNeo, totalGas, totalUsd: categoryUsd(totalNeo, totalGas, prices), failedCount };
}

// Fetch Erik Zhang treasury data. `prices` is null when the feed is unavailable.
export async function fetchErikZhangData(prices: PriceData | null): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas, failedCount } = await fetchAddressBalances(ERIK_ZHANG_ADDRESSES, "Erik");
  return { name: "Erik Zhang", wallets, totalNeo, totalGas, totalUsd: categoryUsd(totalNeo, totalGas, prices), failedCount };
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
  const totalNeo = daData.totalNeo + erikData.totalNeo;
  const totalGas = daData.totalGas + erikData.totalGas;
  const totalUsd = categoryUsd(totalNeo, totalGas, prices);
  const failedCount = daData.failedCount + erikData.failedCount;
  const now = Date.now();
  const priceStale = isPriceDelayed(prices, now);

  return { categories, totalNeo, totalGas, totalUsd, prices, lastUpdated: now, failedCount, priceStale };
}
