// Neo Treasury Data Fetching Utilities
// Uses global price feed from host-app

// Neo N3 RPC endpoints (same as original site)
const RPC_ENDPOINTS = [
  "https://n3seed1.ngd.network:10332",
  "https://n3seed2.ngd.network:10332",
  "https://neo-rpc1.red4sec.com:443",
];

// Contract addresses
const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

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
      const data = await res.json();
      if (data.result) return data.result;
    } catch {
    }
  }
  throw new Error("All RPC endpoints failed");
}

// Get NEP-17 balances for an address
async function getNep17Balances(address: string): Promise<TokenBalance> {
  const result = (await rpcCall("getnep17balances", [address])) as {
    balance: Array<{ assethash: string; amount: string }>;
  };

  let neo = 0;
  let gas = 0;

  for (const b of result.balance || []) {
    if (b.assethash === NEO_CONTRACT) {
      neo = parseInt(b.amount) / 1; // NEO has 0 decimals
    } else if (b.assethash === GAS_CONTRACT) {
      gas = parseInt(b.amount) / 1e8; // GAS has 8 decimals
    }
  }

  return { neo, gas };
}

// Fetch prices from global price feed
export async function fetchPrices(): Promise<PriceData> {
  return getSharedPrices();
}

// Fetch balances for a list of addresses
async function fetchAddressBalances(
  addresses: string[],
  labelPrefix: string,
): Promise<{ wallets: WalletBalance[]; totalNeo: number; totalGas: number }> {
  const wallets: WalletBalance[] = [];
  let totalNeo = 0;
  let totalGas = 0;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    try {
      const balance = await getNep17Balances(address);
      wallets.push({
        address,
        label: `${labelPrefix} Wallet ${i + 1}`,
        neo: balance.neo,
        gas: balance.gas,
      });
      totalNeo += balance.neo;
      totalGas += balance.gas;
    } catch (e) {
      wallets.push({ address, label: `${labelPrefix} Wallet ${i + 1}`, neo: 0, gas: 0 });
    }
  }

  return { wallets, totalNeo, totalGas };
}

// Fetch Da Hongfei treasury data
export async function fetchDaHongfeiData(prices: PriceData): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas } = await fetchAddressBalances(DA_HONGFEI_ADDRESSES, "Da");
  const totalUsd = totalNeo * prices.neo.usd + totalGas * prices.gas.usd;
  return { name: "Da Hongfei", wallets, totalNeo, totalGas, totalUsd };
}

// Fetch Erik Zhang treasury data
export async function fetchErikZhangData(prices: PriceData): Promise<CategoryBalance> {
  const { wallets, totalNeo, totalGas } = await fetchAddressBalances(ERIK_ZHANG_ADDRESSES, "Erik");
  const totalUsd = totalNeo * prices.neo.usd + totalGas * prices.gas.usd;
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
  const totalUsd = totalNeo * prices.neo.usd + totalGas * prices.gas.usd;

  return { categories, totalNeo, totalGas, totalUsd, prices, lastUpdated: Date.now() };
}
