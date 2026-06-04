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

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_CONTRACT = BLOCKCHAIN_CONSTANTS.GAS_HASH;

// Import shared price utils
import { getPrices as getSharedPrices, type PriceData } from "@shared/utils/price";

// Re-export PriceData for consumers
export type { PriceData };

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
}

export interface CategoryBalance {
  name: string;
  wallets: WalletBalance[];
  totalNeo: number;
  totalGas: number;
  totalUsd: number;
}

export interface TreasuryData {
  categories: CategoryBalance[];
  totalNeo: number;
  totalGas: number;
  totalUsd: number;
  prices: PriceData;
  lastUpdated: number;
}

// RPC call helper
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
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

// Fetch prices from global price feed
export async function fetchPrices(): Promise<PriceData> {
  return getSharedPrices();
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
): Promise<{ wallets: WalletBalance[]; totalNeo: number; totalGas: number }> {
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
        // known-good balances. Record the wallet as 0/0 and continue; only
        // surface an error if EVERY address failed (handled below).
        failedCount += 1;
        const reason = outcome.reason;
        const msg = reason instanceof Error ? reason.message : "Unknown error";
        console.warn(`[neo-treasury] balance fetch failed for ${address}: ${msg}`);
        wallets.push({ address, label, neo: 0, gas: 0 });
      }
    });
  }

  // Only a total wipeout (no address resolved) is treated as a load failure.
  if (failedCount > 0 && failedCount === wallets.length) {
    throw new Error(`Failed to fetch balances for all ${labelPrefix} addresses`);
  }

  return { wallets, totalNeo, totalGas };
}

// Fetch Da Hongfei treasury data
export async function fetchDaHongfeiData(prices: PriceData): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas } = await fetchAddressBalances(DA_HONGFEI_ADDRESSES, "Da");
  const neoUsd = prices.usd?.neo ?? prices.neo;
  const gasUsd = prices.usd?.gas ?? prices.gas ?? 0;
  const totalUsd = totalNeo * neoUsd + totalGas * gasUsd;
  return { name: "Da Hongfei", wallets, totalNeo, totalGas, totalUsd };
}

// Fetch Erik Zhang treasury data
export async function fetchErikZhangData(prices: PriceData): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas } = await fetchAddressBalances(ERIK_ZHANG_ADDRESSES, "Erik");
  const neoUsd = prices.usd?.neo ?? prices.neo;
  const gasUsd = prices.usd?.gas ?? prices.gas ?? 0;
  const totalUsd = totalNeo * neoUsd + totalGas * gasUsd;
  return { name: "Erik Zhang", wallets, totalNeo, totalGas, totalUsd };
}

// Fetch all treasury data
export async function fetchTreasuryData(): Promise<TreasuryData> {
  const prices = await fetchPrices();

  // Fetch both founders' data in parallel
  const [daData, erikData] = await Promise.all([fetchDaHongfeiData(prices), fetchErikZhangData(prices)]);

  const categories = [daData, erikData];
  const totalNeo = daData.totalNeo + erikData.totalNeo;
  const totalGas = daData.totalGas + erikData.totalGas;
  const neoUsd = prices.usd?.neo ?? prices.neo;
  const gasUsd = prices.usd?.gas ?? prices.gas ?? 0;
  const totalUsd = totalNeo * neoUsd + totalGas * gasUsd;

  return { categories, totalNeo, totalGas, totalUsd, prices, lastUpdated: Date.now() };
}
