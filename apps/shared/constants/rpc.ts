import { GENERATED_MINIAPP_CONTRACTS } from './generated-miniapp-contracts';
import { MORPHEUS_PUBLIC_REGISTRY } from './generated-morpheus-registry';
import { MORPHEUS_PUBLIC_RUNTIME_CATALOG } from './generated-morpheus-runtime-catalog';
import { MORPHEUS_PUBLIC_SIGNER_REGISTRY } from './generated-morpheus-signer-registry';

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
  morpheusWorkerSignerPublicKey: string;
  morpheusOracleVerifierPublicKey: string;
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

/**
 * Per-app deployed contract hashes, keyed by miniapp id.
 *
 * Generated from the per-app neo-manifest.json files (the source of truth) by
 * scripts/generate-miniapp-contract-registry.mjs — do not hand-edit entries
 * here; update the app manifest and re-run the generator. The drift guard
 * (deploy/scripts/lib/miniapp_contract_registry.test.mjs) fails on divergence.
 */
export const MINIAPP_CONTRACTS: Record<NeoNetwork, Record<string, string>> = {
  mainnet: { ...GENERATED_MINIAPP_CONTRACTS.mainnet },
  testnet: { ...GENERATED_MINIAPP_CONTRACTS.testnet },
};

/**
 * Platform Contract Library v2 shared-engine hashes, keyed by the
 * `ContractBinding.moduleId` a miniapp manifest declares with
 * `mode: "shared"` (docs/platform-contract-library-v2.md §6 item 4 — one
 * shared platform engine replaces the per-app contract; testnet 2026-07-17
 * per deploy/config/platform-registry-testnet-2026-07-17.json). NOT
 * generated: platform deployments land via the ops lane, so entries here are
 * hand-maintained per network — a moduleId absent for a network means "not
 * deployed there yet" and must NOT fall back to a per-app hash (the shared
 * engine's appId-first ABI is incompatible with the per-app clone ABI).
 */
export const PLATFORM_SHARED_CONTRACTS: Record<NeoNetwork, Record<string, string>> = {
  mainnet: {},
  testnet: {
    'platform-game': '0xc75b181b4561462903bb27d8d9e0b32b637bec12',
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
    morpheusWorkerSignerPublicKey: MORPHEUS_PUBLIC_SIGNER_REGISTRY[network].worker.publicKey,
    morpheusOracleVerifierPublicKey: MORPHEUS_PUBLIC_SIGNER_REGISTRY[network].oracleVerifier.publicKey,
    morpheusOracleCvmId: registry.morpheus.oracleCvmId,
    morpheusOracleCvmName: registry.morpheus.oracleCvmName,
    morpheusOracleAttestationExplorerUrl: registry.morpheus.oracleAttestationExplorerUrl,
    morpheusDatafeedCvmId: registry.morpheus.datafeedCvmId,
    morpheusDatafeedCvmName: registry.morpheus.datafeedCvmName,
    morpheusDatafeedAttestationExplorerUrl: registry.morpheus.datafeedAttestationExplorerUrl,
    // Optional-field reads use `(...) as Record<string, string>` because the
    // canonical Morpheus registry can publish per-network field sets — for
    // example `aaAddressMarket` and `aaPaymaster` currently exist on testnet
    // but not on mainnet. The frontend code treats missing fields as empty
    // strings rather than typecheck-failing.
    contracts: {
      neo: NEO_HASH,
      gas: GAS_HASH,
      contractManagement: CONTRACT_MANAGEMENT,
      aaCore: registry.contracts.aaCore,
      aaWeb3AuthVerifier: registry.contracts.aaWeb3AuthVerifier,
      aaSessionKeyVerifier: registry.contracts.aaSessionKeyVerifier,
      aaSocialRecoveryVerifier: registry.contracts.aaSocialRecoveryVerifier,
      aaAddressMarket: (registry.contracts as Record<string, string>).aaAddressMarket ?? "",
      aaPaymaster: (registry.contracts as Record<string, string>).aaPaymaster ?? "",
      morpheusOracle: registry.contracts.morpheusOracle,
      oracleCallbackConsumer: (registry.contracts as Record<string, string>).oracleCallbackConsumer ?? "",
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
      aaAddressMarket: (registry.domains as Record<string, string>).aaAddressMarket ?? "",
      aaPaymaster: (registry.domains as Record<string, string>).aaPaymaster ?? "",
      oracle: registry.domains.oracle,
      callbackConsumer: (registry.domains as Record<string, string>).callbackConsumer ?? "",
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

/** Shared platform engine hash for a ContractBinding mode:"shared" moduleId ("" when not deployed on the network). */
export function getSharedPlatformContractHash(moduleId: string, network?: NeoNetwork): string {
  return PLATFORM_SHARED_CONTRACTS[network ?? getNetwork()]?.[String(moduleId || '').trim()] || '';
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
