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
 * - neo-abstract-account/README.md
 */

export type NeoNetwork = "mainnet" | "testnet";

/** N3Index API — primary indexed data source for reads */
export const N3INDEX_API = "https://api.n3index.dev";

/** Neo N3 Mainnet RPC (for direct reads and wallet-signed writes) */
export const NEO_MAINNET_RPC = "https://mainnet1.neo.coz.io:443";

/** Neo N3 Testnet RPC (for direct reads and wallet-signed writes) */
export const NEO_TESTNET_RPC = "https://n3seed1.ngd.network:20332";

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
  aaFrontendBaseUrl: string;
  morpheusPublicApiUrl: string;
  morpheusPublicApiUrls: string[];
  morpheusRuntimeUrl: string;
  morpheusRuntimeUrls: string[];
  morpheusEdgeUrl: string;
  morpheusControlPlaneUrl: string;
  morpheusOracleCvmId: string;
  morpheusOracleCvmName: string;
  morpheusOracleAttestationExplorerUrl: string;
  morpheusDatafeedCvmId: string;
  morpheusDatafeedCvmName: string;
  morpheusDatafeedAttestationExplorerUrl: string;
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
    "miniapp-last-survivor": "0x180a3a35c088eab4feded508c2ccb1556e07a840",
    "miniapp-gasbox": "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
    "miniapp-redenvelope": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
    "miniapp-dailycheckin": "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
    "miniapp-fogplay": "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
    "miniapp-self-loan": "0x942da575b31f39cbb59e64b5813b128739b44c25",
    "miniapp-neo-pay": "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
  },
  testnet: {
    "miniapp-last-survivor": "0xd55df731978582ea81719a5d87ce49b248e91275",
    "miniapp-gasbox": "0x49ec8536ba331d744a16b8da2a6ed4263ef4e89c",
    "miniapp-redenvelope": "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
    "miniapp-dailycheckin": "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
    "miniapp-fogplay": "0xb115dd775a7591bb0eedef6dbf50428d50e7bc07",
    "miniapp-self-loan": "0xd097c63ea89251d23632826ebed99a7e7ce536f7",
    "miniapp-neo-pay": "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
    "miniapp-burn-league": "0x0946e3c3db8abdd2fa14bbae4978992015473c09",
    "miniapp-breakupcontract": "0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8",
    "miniapp-onchaintarot": "0x5cdf29c30727ce06696736ae0fb49abd9fd79730",
    "miniapp-unbreakablevault": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
    "miniapp-flashloan": "0xde8e595d8d3c293731db499367ee2a768e1e458b",
    "miniapp-council-governance": "0x4c61e5575ae9e151027f6724d07fac127d4cc25f",
    "miniapp-gas-sponsor": "0x31888679572bf2de61462ff9934b6265d60284f2",
    "miniapp-memorial-shrine": "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
    "miniapp-neo-ns": "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
  },
};

export const EXTERNAL_INTEGRATIONS: Record<NeoNetwork, ExternalIntegrationConfig> = {
  mainnet: {
    network: "mainnet",
    rpcUrl: NEO_MAINNET_RPC,
    networkMagic: MAINNET_MAGIC,
    n3indexApi: N3INDEX_API,
    aaFrontendBaseUrl: "https://neo-abstract-account.vercel.app",
    morpheusPublicApiUrl: "https://oracle.meshmini.app/mainnet",
    morpheusPublicApiUrls: ["https://oracle.meshmini.app/mainnet"],
    morpheusRuntimeUrl: "https://oracle.meshmini.app/mainnet",
    morpheusRuntimeUrls: [
      "https://oracle.meshmini.app/mainnet",
      "https://edge.meshmini.app/mainnet",
    ],
    morpheusEdgeUrl: "https://oracle.meshmini.app/mainnet",
    morpheusControlPlaneUrl: "https://control.meshmini.app/mainnet",
    morpheusOracleCvmId: "ddff154546fe22d15b65667156dd4b7c611e6093",
    morpheusOracleCvmName: "oracle-morpheus-neo-r3e",
    morpheusOracleAttestationExplorerUrl:
      "https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093",
    morpheusDatafeedCvmId: "28294e89d490924b79c85cdee057ce55723b3d56",
    morpheusDatafeedCvmName: "datafeed-morpheus-neo-r3e",
    morpheusDatafeedAttestationExplorerUrl:
      "https://cloud.phala.com/explorer/app_28294e89d490924b79c85cdee057ce55723b3d56",
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
    aaFrontendBaseUrl: "https://neo-abstract-account.vercel.app",
    morpheusPublicApiUrl: "https://oracle.meshmini.app/testnet",
    morpheusPublicApiUrls: ["https://oracle.meshmini.app/testnet"],
    morpheusRuntimeUrl: "https://oracle.meshmini.app/testnet",
    morpheusRuntimeUrls: [
      "https://oracle.meshmini.app/testnet",
      "https://edge.meshmini.app/testnet",
    ],
    morpheusEdgeUrl: "https://oracle.meshmini.app/testnet",
    morpheusControlPlaneUrl: "https://control.meshmini.app/testnet",
    morpheusOracleCvmId: "ddff154546fe22d15b65667156dd4b7c611e6093",
    morpheusOracleCvmName: "oracle-morpheus-neo-r3e",
    morpheusOracleAttestationExplorerUrl:
      "https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093",
    morpheusDatafeedCvmId: "28294e89d490924b79c85cdee057ce55723b3d56",
    morpheusDatafeedCvmName: "datafeed-morpheus-neo-r3e",
    morpheusDatafeedAttestationExplorerUrl:
      "https://cloud.phala.com/explorer/app_28294e89d490924b79c85cdee057ce55723b3d56",
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

export function getAAFrontendBaseUrl(network?: NeoNetwork): string {
  return getExternalIntegrationConfig(network).aaFrontendBaseUrl.replace(/\/$/, "");
}

export function getAAIdentityWorkspaceUrl(network?: NeoNetwork): string {
  return `${getAAFrontendBaseUrl(network)}/identity`;
}

export function getAAAppWorkspaceUrl(network?: NeoNetwork): string {
  return `${getAAFrontendBaseUrl(network)}/app`;
}

export function getAADocsUrl(network?: NeoNetwork): string {
  return `${getAAFrontendBaseUrl(network)}/docs`;
}
