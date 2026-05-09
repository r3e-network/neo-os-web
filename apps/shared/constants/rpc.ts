import { MORPHEUS_PUBLIC_REGISTRY } from './generated-morpheus-registry';
import { MORPHEUS_PUBLIC_RUNTIME_CATALOG } from './generated-morpheus-runtime-catalog';

/**
 * Canonical Neo N3 + Morpheus / AA integration registry for the MiniApp platform.
 *
 * This repository consumes the externally deployed stacks from:
 * - neo-morpheus-oracle
 * - neo-abstract-account
 *
 * Public Morpheus deployment metadata is generated from the canonical Oracle
 * network registry and checked in locally to keep builds deterministic.
 */

export type NeoNetwork = 'mainnet' | 'testnet';

const AA_FRONTEND_BASE_URL = 'https://neo-abstract-account.vercel.app';

/** N3Index API — primary indexed data source for reads */
export const N3INDEX_API = 'https://api.n3index.dev';

/** Neo N3 Mainnet RPC (for direct reads and wallet-signed writes) */
export const NEO_MAINNET_RPC = MORPHEUS_PUBLIC_REGISTRY.mainnet.rpcUrl;

/** Neo N3 Testnet RPC (for direct reads and wallet-signed writes) */
export const NEO_TESTNET_RPC = MORPHEUS_PUBLIC_REGISTRY.testnet.rpcUrl;

/** Network magic numbers */
export const MAINNET_MAGIC = MORPHEUS_PUBLIC_REGISTRY.mainnet.networkMagic;
export const TESTNET_MAGIC = MORPHEUS_PUBLIC_REGISTRY.testnet.networkMagic;

/** Core contract hashes (stable across Neo N3 networks) */
export const NEO_HASH = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
export const GAS_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
export const CONTRACT_MANAGEMENT = '0xfffdc93764dbaddd97c48f252a53ea4643faa3fd';

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
  morpheusEnvelopeVersion: string;
  morpheusWorkflowIds: string[];
  morpheusTopology: typeof MORPHEUS_PUBLIC_RUNTIME_CATALOG.topology;
  morpheusRiskPlane: string;
  morpheusRiskActions: string[];
  morpheusAutomationTriggerKinds: string[];
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
    aaAddressMarket?: string;
    aaPaymaster?: string;
    morpheusOracle: string;
    oracleCallbackConsumer?: string;
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
    aaAddressMarket?: string;
    aaPaymaster?: string;
    oracle?: string;
    callbackConsumer?: string;
    datafeed?: string;
    neodid?: string;
  };
};

function listMorpheusWorkflows(network: NeoNetwork) {
  return MORPHEUS_PUBLIC_RUNTIME_CATALOG.workflows.filter((workflow) =>
    workflow.allowedNetworks.includes(network)
  );
}

export const MINIAPP_CONTRACTS: Record<NeoNetwork, Record<string, string>> = {
  mainnet: {
    'miniapp-last-survivor': '0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7',
    'miniapp-gasbox': '0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7',
    'miniapp-redenvelope': '0x5f371cc50116bb13d79554d96ccdd6e246cd5d59',
    'miniapp-gas-lucky-pool': '0x5f371cc50116bb13d79554d96ccdd6e246cd5d59',
    'miniapp-dailycheckin': '0xbd4f3646e189350b9c11a659655854e6f03f9be4',
    'miniapp-fogplay': '0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7',
    'miniapp-dice-game': '0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7',
    'miniapp-self-loan': '0x942da575b31f39cbb59e64b5813b128739b44c25',
    'miniapp-neo-pay': '0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34',
    'miniapp-profitanchor': '0x02beeef6f65c6989a121c0a0e6b23190333edb98',
    'miniapp-trustanchor': '0x02beeef6f65c6989a121c0a0e6b23190333edb98',
    'miniapp-custom-anchor': '0x02beeef6f65c6989a121c0a0e6b23190333edb98',
    'miniapp-aa-account-lab': '0x0268a387913b250166ddec032b03332690a1ef78',
    'miniapp-aa-permissions-lab': '0x0268a387913b250166ddec032b03332690a1ef78',
    'miniapp-aa-relay-console': '0x0268a387913b250166ddec032b03332690a1ef78',
    'miniapp-aa-market-hub': '0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69',
    'miniapp-aa-session-key-lab': '0x3ba8333406e59f9fd83cf378b33706a33d9f3755',
    'miniapp-recovery-guardian': '0x198b3a9cec9bccc2110d19bd929b10374a9d034d',
  },
  testnet: {
    'miniapp-last-survivor': '0x740671b10330ef6669ab8b2724437eb8d5e7a34c',
    'miniapp-gasbox': '0x49ec8536ba331d744a16b8da2a6ed4263ef4e89c',
    'miniapp-redenvelope': '0xfa1b7240fead2a63999c02defa3aec5eb274a919',
    'miniapp-gas-lucky-pool': '0xfa1b7240fead2a63999c02defa3aec5eb274a919',
    'miniapp-dailycheckin': '0xaba84da240a55410d284a656fc8dae044e6ec1a5',
    'miniapp-fogplay': '0xb115dd775a7591bb0eedef6dbf50428d50e7bc07',
    'miniapp-dice-game': '0x740671b10330ef6669ab8b2724437eb8d5e7a34c',
    'miniapp-self-loan': '0xb4aa0bdbfec40b44fa1ec4461c8c347829a79ada',
    'miniapp-neo-pay': '0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e',
    'miniapp-burn-league': '0x0946e3c3db8abdd2fa14bbae4978992015473c09',
    'miniapp-breakupcontract': '0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8',
    'miniapp-onchaintarot': '0x5cdf29c30727ce06696736ae0fb49abd9fd79730',
    'miniapp-unbreakablevault': '0x78fbd57ccfae14fff4b043a82eb491de542d8eb0',
    'miniapp-flashloan': '0xde8e595d8d3c293731db499367ee2a768e1e458b',
    'miniapp-council-governance': '0x4c61e5575ae9e151027f6724d07fac127d4cc25f',
    'miniapp-gas-sponsor': '0x31888679572bf2de61462ff9934b6265d60284f2',
    'miniapp-memorial-shrine': '0x87f0fe2ba69cd973a3274471234d3cc13ef943c5',
    'miniapp-neo-ns': '0x50ac1c37690cc2cfc594472833cf57505d5f46de',
    'miniapp-profitanchor': '0xa1ca7a610105686635f31de8e174ae3ce6b61a3e',
    'miniapp-trustanchor': '0xa1ca7a610105686635f31de8e174ae3ce6b61a3e',
    'miniapp-custom-anchor': '0xa1ca7a610105686635f31de8e174ae3ce6b61a3e',
    'miniapp-aa-account-lab': '0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38',
    'miniapp-aa-permissions-lab': '0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38',
    'miniapp-aa-relay-console': '0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38',
    'miniapp-aa-market-hub': '0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf',
    'miniapp-aa-session-key-lab': '0xed44c88535650b4dd6b8d59776e6ed045462cab6',
  },
};

function buildExternalIntegrationConfig(network: NeoNetwork): ExternalIntegrationConfig {
  const registry = MORPHEUS_PUBLIC_REGISTRY[network];
  return {
    network,
    rpcUrl: registry.rpcUrl,
    networkMagic: registry.networkMagic,
    n3indexApi: N3INDEX_API,
    aaFrontendBaseUrl: AA_FRONTEND_BASE_URL,
    morpheusPublicApiUrl: registry.morpheus.publicApiUrl,
    morpheusPublicApiUrls: [...registry.morpheus.publicApiUrls],
    morpheusRuntimeUrl: registry.morpheus.runtimeUrl,
    morpheusRuntimeUrls: [...registry.morpheus.runtimeUrls],
    morpheusEdgeUrl: registry.morpheus.edgeUrl,
    morpheusControlPlaneUrl: registry.morpheus.controlPlaneUrl,
    morpheusEnvelopeVersion: MORPHEUS_PUBLIC_RUNTIME_CATALOG.envelope.version,
    morpheusWorkflowIds: listMorpheusWorkflows(network).map((workflow) => workflow.id),
    morpheusTopology: { ...MORPHEUS_PUBLIC_RUNTIME_CATALOG.topology },
    morpheusRiskPlane: MORPHEUS_PUBLIC_RUNTIME_CATALOG.topology.riskPlane,
    morpheusRiskActions: [...MORPHEUS_PUBLIC_RUNTIME_CATALOG.risk.actions],
    morpheusAutomationTriggerKinds: [...MORPHEUS_PUBLIC_RUNTIME_CATALOG.automation.triggerKinds],
    morpheusOracleCvmId: registry.morpheus.oracleCvmId,
    morpheusOracleCvmName: registry.morpheus.oracleCvmName,
    morpheusOracleAttestationExplorerUrl: registry.morpheus.oracleAttestationExplorerUrl,
    morpheusDatafeedCvmId: registry.morpheus.datafeedCvmId,
    morpheusDatafeedCvmName: registry.morpheus.datafeedCvmName,
    morpheusDatafeedAttestationExplorerUrl: registry.morpheus.datafeedAttestationExplorerUrl,
    contracts: {
      neo: NEO_HASH,
      gas: GAS_HASH,
      contractManagement: CONTRACT_MANAGEMENT,
      aaCore: registry.contracts.aaCore,
      aaWeb3AuthVerifier: registry.contracts.aaWeb3AuthVerifier,
      aaSessionKeyVerifier: registry.contracts.aaSessionKeyVerifier,
      aaSocialRecoveryVerifier: registry.contracts.aaSocialRecoveryVerifier,
      aaAddressMarket: registry.contracts.aaAddressMarket,
      aaPaymaster: registry.contracts.aaPaymaster,
      morpheusOracle: registry.contracts.morpheusOracle,
      oracleCallbackConsumer: registry.contracts.oracleCallbackConsumer,
      morpheusDatafeed: registry.contracts.morpheusDatafeed,
      morpheusNeoDid: registry.contracts.morpheusNeoDid,
    },
    domains: {
      aa: registry.domains.aa,
      aaAlias: registry.domains.aaAlias,
      aaCore: registry.domains.aaCore,
      aaWeb3AuthVerifier: registry.domains.aaWeb3AuthVerifier,
      aaSessionKeyVerifier: registry.domains.aaSessionKeyVerifier,
      aaSocialRecoveryVerifier: registry.domains.aaSocialRecoveryVerifier,
      aaAddressMarket: registry.domains.aaAddressMarket,
      aaPaymaster: registry.domains.aaPaymaster,
      oracle: registry.domains.oracle,
      callbackConsumer: registry.domains.callbackConsumer,
      datafeed: registry.domains.datafeed,
      neodid: registry.domains.neodid,
    },
  };
}

export const EXTERNAL_INTEGRATIONS: Record<NeoNetwork, ExternalIntegrationConfig> = {
  mainnet: buildExternalIntegrationConfig('mainnet'),
  testnet: buildExternalIntegrationConfig('testnet'),
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
  const normalized = String(network ?? '').trim().toLowerCase();
  return normalized === 'testnet' || normalized === 'neo-n3-testnet' ? 'testnet' : 'mainnet';
}

/** Determine network from URL or default to mainnet. */
export function getNetwork(): NeoNetwork {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return resolveNeoNetwork(params.get('network'));
  }
  return 'mainnet';
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
  return MINIAPP_CONTRACTS[network ?? getNetwork()]?.[String(appId || '').trim()] || '';
}

export function getAAFrontendBaseUrl(network?: NeoNetwork): string {
  return getExternalIntegrationConfig(network).aaFrontendBaseUrl.replace(/\/$/, '');
}

function buildAAWorkspaceUrl(pathname: string, network?: NeoNetwork): string {
  const resolvedNetwork = network ?? getNetwork();
  const url = new URL(pathname, `${getAAFrontendBaseUrl(resolvedNetwork)}/`);
  url.searchParams.set('network', resolvedNetwork);
  return url.toString();
}

export function getAAIdentityWorkspaceUrl(network?: NeoNetwork): string {
  return buildAAWorkspaceUrl('/identity', network);
}

export function getAAAppWorkspaceUrl(network?: NeoNetwork): string {
  return buildAAWorkspaceUrl('/app', network);
}

export function getAADocsUrl(network?: NeoNetwork): string {
  return buildAAWorkspaceUrl('/docs', network);
}
