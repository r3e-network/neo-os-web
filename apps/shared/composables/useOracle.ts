/**
 * Morpheus Oracle / DataFeed / Compute integration composable for Neo N3 MiniApps.
 *
 * This is a barrel composable that composes the focused sub-composables
 * (useVRF, useDataFeed, useOracleQuery, useCompute) into a single
 * backward-compatible API surface.
 *
 * MiniApps can import from here for the full bundle or import individual
 * composables for tree-shaking.
 */
import { createDerived } from "@shared/react/context";
import { getExternalIntegrationConfig, getNetwork } from "../constants/rpc";
import { normalizeEdgeBaseUrl, getWindowMiniAppSDK } from "./_oracleInternals";
import { useVRF } from "./useVRF";
import { useDataFeed } from "./useDataFeed";
import { useOracleQuery } from "./useOracleQuery";
import { useCompute } from "./useCompute";

// ── Re-export all public types from internals ──────────────────────────────
export type {
  OracleConfig,
  OracleQueryRequest,
  OracleQueryResponse,
  NeoDidResolveResponse,
  NeoDidProvidersResponse,
  OraclePublicKeyResponse,
  ConfidentialStoreRequest,
  ConfidentialStoreResponse,
  ComputeExecuteRequest,
  RegisteredComputeRequest,
  ComputeJobResult,
  VRFResult,
  TEEResult,
} from "./_oracleInternals";

// ── Re-export focused composables ──────────────────────────────────────────
export { useVRF } from "./useVRF";
export { useDataFeed } from "./useDataFeed";
export { useOracleQuery } from "./useOracleQuery";
export { useCompute } from "./useCompute";

// ── Composed useOracle (backward-compatible) ───────────────────────────────

import type { OracleConfig } from "./_oracleInternals";

export function useOracle(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  // Compose focused composables
  const vrf = useVRF(config);
  const dataFeed = useDataFeed(config);
  const oracleQuery = useOracleQuery(config);
  const compute = useCompute(config);

  const isOracleAvailable = createDerived(
    () => Boolean(sdk?.rng || sdk?.datafeed || config.hostSdk?.oracle || edgeBaseUrl),
    [],
  );

  return {
    integration,
    network,
    edgeBaseUrl,

    // Canonical external deployment metadata - computed once at creation.
    ORACLE_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.morpheusOracle,
    ORACLE_CONTRACT_TESTNET: getExternalIntegrationConfig("testnet").contracts.morpheusOracle,
    DATA_FEED_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.morpheusDatafeed,
    MORPHEUS_PUBLIC_API_MAINNET: getExternalIntegrationConfig("mainnet").morpheusPublicApiUrl,
    MORPHEUS_PUBLIC_API_TESTNET: getExternalIntegrationConfig("testnet").morpheusPublicApiUrl,

    // State
    isOracleAvailable,
    isRequesting: vrf.isRequesting,
    error: vrf.error,
    lastRandom: vrf.lastRandom,
    lastComputeResult: compute.lastComputeResult,

    // Actions — VRF
    requestRandomness: vrf.requestRandomness,

    // Actions — DataFeed
    getPrice: dataFeed.getPrice,

    // Actions — Oracle Query / NeoDID
    queryAllowlistedUrl: oracleQuery.queryAllowlistedUrl,
    resolveNeoDid: oracleQuery.resolveNeoDid,
    getNeoDidProviders: oracleQuery.getNeoDidProviders,
    getOraclePublicKey: oracleQuery.getOraclePublicKey,

    // Actions — TEE Compute / Confidential
    executeTEE: compute.executeTEE,
    executeRegisteredScript: compute.executeRegisteredScript,
    storeConfidentialCiphertext: compute.storeConfidentialCiphertext,
  };
}
