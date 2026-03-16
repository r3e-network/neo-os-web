/**
 * Canonical Neo N3 + Morpheus / AA integration registry for the MiniApp platform.
 *
 * This repository does not own the Oracle / Compute / VRF / Paymaster / AA runtimes.
 * It consumes the externally deployed stacks from:
 * - neo-morpheus-oracle
 * - neo-abstract-account
 *
 * Keep the values below aligned with the upstream deployment registries:
 * - neo-morpheus-oracle/config/networks/*.json
 * - neo-morpheus-oracle/docs/MAINNET_DOMAIN_ROUTING_2026-03-15.md
 * - neo-abstract-account/README.md
 */

export type NeoNetwork = "mainnet" | "testnet";

/** N3Index API — primary indexed data source for reads */
export const N3INDEX_API = "https://api.n3index.dev";

/** Neo N3 Mainnet RPC (for direct reads and wallet-signed writes) */
export const NEO_MAINNET_RPC = "https://mainnet1.neo.coz.io:443";

/** Neo N3 Testnet RPC (for direct reads and wallet-signed writes) */
export const NEO_TESTNET_RPC = "https://testnet1.neo.coz.io:443";

/** Network magic numbers */
export const MAINNET_MAGIC = 860833102;
export const TESTNET_MAGIC = 894710606;

/** Core contract hashes (stable across Neo N3 networks) */
export const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
export const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
export const CONTRACT_MANAGEMENT = "0xfffdc93764dbaddd97c48f252a53ea4643faa3fd";

export type ExternalIntegrationConfig = {
  network: NeoNetwork;
  rpcUrl: string;
  networkMagic: number;
  n3indexApi: string;
  morpheusPublicApiUrl: string;
  contracts: {
    neo: string;
    gas: string;
    contractManagement: string;
    aaCore: string;
    aaWeb3AuthVerifier: string;
    aaSessionKeyVerifier?: string;
    aaSocialRecoveryVerifier?: string;
    morpheusOracle: string;
    morpheusDatafeed: string;
    morpheusNeoDid?: string;
  };
  domains: {
    aa?: string;
    aaAlias?: string;
    aaCore?: string;
    aaWeb3AuthVerifier?: string;
    aaSessionKeyVerifier?: string;
    aaSocialRecoveryVerifier?: string;
    oracle?: string;
    datafeed?: string;
    neodid?: string;
  };
};

export const MINIAPP_CONTRACTS: Record<NeoNetwork, Record<string, string>> = {
  mainnet: {
    "miniapp-doomsday-clock": "0x8f46753fd7123bd276d77ef1100839004b9a3440",
    "miniapp-neo-gacha": "0xc9af7c9de5b0963e6514b6462b293f0179eb3798",
    "miniapp-redenvelope": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
    "miniapp-dailycheckin": "0x908867b23ab551a598723ceeaaedd70c54e10c76",
    "miniapp-coinflip": "0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1",
    "miniapp-self-loan": "0x942da575b31f39cbb59e64b5813b128739b44c25",
    "miniapp-stream-vault": "",
  },
  testnet: {
    "miniapp-doomsday-clock": "0xf0914d411877c8393c029f48ec0c4c64d44f1b49",
    "miniapp-neo-gacha": "0x523c112560a2e196fa0fcfa215d93c08e117d9c1",
    "miniapp-redenvelope": "0x4079c09a0ff121fc44d817c37d6ae8694b268e9f",
    "miniapp-dailycheckin": "0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528",
    "miniapp-coinflip": "0x43f953c00931ca38044bf0e5ca50d608aea7ae8b",
    "miniapp-self-loan": "0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b",
    "miniapp-stream-vault": "0x89d2499928e3035247186f412934d6b0e0b665ef",
  },
};

export const PLATFORM_CONTRACTS: Record<NeoNetwork, { paymentHub: string }> = {
  mainnet: {
    paymentHub: "",
  },
  testnet: {
    paymentHub: "0x340cb33d770b38f26d066716dd1f9df5283d629e",
  },
};

export const EXTERNAL_INTEGRATIONS: Record<NeoNetwork, ExternalIntegrationConfig> = {
  mainnet: {
    network: "mainnet",
    rpcUrl: NEO_MAINNET_RPC,
    networkMagic: MAINNET_MAGIC,
    n3indexApi: N3INDEX_API,
    morpheusPublicApiUrl: "https://966f16610bdfe1794a503e16c5ae0bc69a1d92f1-80.dstack-pha-prod9.phala.network",
    contracts: {
      neo: NEO_HASH,
      gas: GAS_HASH,
      contractManagement: CONTRACT_MANAGEMENT,
      aaCore: "0x9742b4ed62a84a886f404d36149da6147528ee33",
      aaWeb3AuthVerifier: "0xb4107cb2cb4bace0ebe15bc4842890734abe133a",
      aaSessionKeyVerifier: "0xe82b9d056c011819ff3652427682224daad0cd1f",
      aaSocialRecoveryVerifier: "0x51ef9639deb29284cc8577a7fa3fdfbc92ada7c3",
      morpheusOracle: "0x017520f068fd602082fe5572596185e62a4ad991",
      morpheusDatafeed: "0x03013f49c42a14546c8bbe58f9d434c3517fccab",
      morpheusNeoDid: "0xb81f31ea81e279793b30411b82c2e82078b63105",
    },
    domains: {
      aa: "smartwallet.neo",
      aaAlias: "aa.morpheus.neo",
      aaCore: "core.smartwallet.neo",
      aaWeb3AuthVerifier: "web3auth.smartwallet.neo",
      aaSessionKeyVerifier: "sessionkey.smartwallet.neo",
      aaSocialRecoveryVerifier: "recovery.smartwallet.neo",
      oracle: "oracle.morpheus.neo",
      datafeed: "pricefeed.morpheus.neo",
      neodid: "neodid.morpheus.neo",
    },
  },
  testnet: {
    network: "testnet",
    rpcUrl: NEO_TESTNET_RPC,
    networkMagic: TESTNET_MAGIC,
    n3indexApi: N3INDEX_API,
    morpheusPublicApiUrl: "https://28294e89d490924b79c85cdee057ce55723b3d56-3000.dstack-pha-prod9.phala.network",
    contracts: {
      neo: NEO_HASH,
      gas: GAS_HASH,
      contractManagement: CONTRACT_MANAGEMENT,
      aaCore: "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38",
      aaWeb3AuthVerifier: "0xf2560a0db44bbb32d0a6919cf90a3d0643ad8e3d",
      aaSessionKeyVerifier: "0xed44c88535650b4dd6b8d59776e6ed045462cab6",
      morpheusOracle: "0x4b882e94ed766807c4fd728768f972e13008ad52",
      morpheusDatafeed: "0x9bea75cf702f6afc09125aa6d22f082bfd2ee064",
    },
    domains: {},
  },
};

/** Backwards-compatible exports kept for existing imports. */
export const AA_CONTRACT = EXTERNAL_INTEGRATIONS.mainnet.contracts.aaCore;
export const AA_CONTRACT_TESTNET = EXTERNAL_INTEGRATIONS.testnet.contracts.aaCore;
export const ORACLE_CONTRACT_MAINNET = EXTERNAL_INTEGRATIONS.mainnet.contracts.morpheusOracle;
export const ORACLE_CONTRACT_TESTNET = EXTERNAL_INTEGRATIONS.testnet.contracts.morpheusOracle;
export const DATA_FEED_CONTRACT = EXTERNAL_INTEGRATIONS.mainnet.contracts.morpheusDatafeed;
export const DATA_FEED_CONTRACT_MAINNET = EXTERNAL_INTEGRATIONS.mainnet.contracts.morpheusDatafeed;
export const DATA_FEED_CONTRACT_TESTNET = EXTERNAL_INTEGRATIONS.testnet.contracts.morpheusDatafeed;

export function resolveNeoNetwork(network?: string | null): NeoNetwork {
  const normalized = String(network ?? "").trim().toLowerCase();
  return normalized === "testnet" ? "testnet" : "mainnet";
}

/** Determine network from URL or default to mainnet. */
export function getNetwork(): NeoNetwork {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return resolveNeoNetwork(params.get("network"));
  }
  return "mainnet";
}

/** Get RPC URL for the selected network. */
export function getRpcUrl(network?: NeoNetwork): string {
  return EXTERNAL_INTEGRATIONS[network ?? getNetwork()].rpcUrl;
}

/** Get the canonical external Oracle / AA config for the selected network. */
export function getExternalIntegrationConfig(network?: NeoNetwork): ExternalIntegrationConfig {
  return EXTERNAL_INTEGRATIONS[network ?? getNetwork()];
}

export function getMiniAppContractHash(appId: string, network?: NeoNetwork): string {
  return MINIAPP_CONTRACTS[network ?? getNetwork()]?.[String(appId || "").trim()] || "";
}

export function getPaymentHubHash(network?: NeoNetwork): string {
  return PLATFORM_CONTRACTS[network ?? getNetwork()]?.paymentHub || "";
}
