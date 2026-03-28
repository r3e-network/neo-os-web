/**
 * OracleService - Oracle, VRF, DataFeed, and TEE Compute integration.
 *
 * Wraps useOracle with a class-based API that integrates with the
 * platform EventBus. Provides access to Morpheus Oracle capabilities:
 * - VRF randomness (for games, lotteries)
 * - Price feeds (for DeFi miniapps)
 * - HTTP Oracle queries (for external data)
 * - TEE Compute execution (for confidential computation)
 * - NeoDID resolution
 *
 * @example
 * ```ts
 * // Get verifiable randomness for a game
 * const { requestId, randomBytes } = await services.oracle.requestRandom("coin_flip");
 *
 * // Get a price feed
 * const { price, timestamp } = await services.oracle.getPrice("NEO", "USD");
 * ```
 */

import { useOracle } from "../composables/useOracle";
import type {
  OracleConfig,
  ComputeExecuteRequest,
  OracleQueryRequest,
  OracleQueryResponse,
  OraclePublicKeyResponse,
  ConfidentialStoreRequest,
  ConfidentialStoreResponse,
  RegisteredComputeRequest,
  VRFResult,
  TEEResult,
  ComputeJobResult,
} from "../composables/useOracle";
import type { EventBus } from "./EventBus";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RandomResult {
  requestId: string;
  randomBytes: string;
  proof: string;
  raw?: Record<string, unknown>;
}

export interface PriceResult {
  price: number;
  timestamp: number;
}

export interface ComputeParams {
  /** JavaScript/TypeScript source code to execute in the TEE */
  script: string;
  /** Optional entry point function name */
  entryPoint?: string;
  /** Input data passed to the script */
  input?: Record<string, unknown>;
  /** Secret references for confidential data */
  secretRefs?: string[];
  /** Execution timeout in milliseconds */
  timeout?: number;
}

export interface ComputeResult {
  output: unknown;
  attestation: string;
  verified: boolean;
  jobId?: string;
  gasUsed?: number;
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class OracleService {
  private oracle: ReturnType<typeof useOracle>;
  private events: EventBus;
  private appId: string;

  constructor(appId: string, events: EventBus, oracleConfig?: Partial<OracleConfig>) {
    this.appId = appId;
    this.events = events;
    // Spread oracleConfig first so constructor's appId always wins
    this.oracle = useOracle({
      ...oracleConfig,
      appId,
    });
  }

  // -- Randomness -----------------------------------------------------------

  /**
   * Request verifiable randomness from the Morpheus VRF oracle.
   * Returns a VRF proof and random bytes that can be verified on-chain.
   *
   * @param context - Optional label for the randomness request (for logging)
   */
  async requestRandom(context?: string): Promise<RandomResult> {
    const result: VRFResult = await this.oracle.requestRandomness(context);
    return {
      requestId: result.requestId,
      randomBytes: result.value,
      proof: result.proof,
      raw: result.raw,
    };
  }

  // -- Price feeds ----------------------------------------------------------

  /**
   * Get the current price from the Morpheus DataFeed oracle.
   *
   * @param symbol - Asset symbol (e.g. "NEO", "GAS", "BTC")
   * @param quoteCurrency - Quote currency. Default: "USD"
   */
  async getPrice(symbol: string, quoteCurrency?: string): Promise<PriceResult> {
    const asset = quoteCurrency ? `${symbol}-${quoteCurrency}` : symbol;
    const price = await this.oracle.getPrice(asset);
    return {
      price,
      timestamp: Date.now(),
    };
  }

  // -- HTTP Oracle ----------------------------------------------------------

  /**
   * Query an allowlisted URL through the Morpheus HTTP Oracle.
   * The oracle fetches external data and returns it with attestation.
   *
   * @param url - The URL to query
   * @param filter - Optional JMESPath/JSONPath filter for the response
   */
  async queryUrl(url: string, filter?: string): Promise<unknown> {
    const params: OracleQueryRequest = {
      url,
      method: "GET",
      ...(filter ? { body: filter } : {}),
    };
    const result = await this.oracle.queryAllowlistedUrl(params);
    try {
      return JSON.parse(result.body);
    } catch {
      return result.body;
    }
  }

  /**
   * Full HTTP Oracle query with custom method, headers, and body.
   */
  async queryUrlAdvanced(params: OracleQueryRequest): Promise<{ statusCode: number; headers: Record<string, string>; body: unknown }> {
    const result = await this.oracle.queryAllowlistedUrl(params);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(result.body);
    } catch {
      parsedBody = result.body;
    }
    return {
      statusCode: result.status_code,
      headers: result.headers,
      body: parsedBody,
    };
  }

  // -- TEE Compute ----------------------------------------------------------

  /**
   * Execute a script in the Morpheus TEE (Trusted Execution Environment).
   * Returns the output with an attestation proof.
   */
  async executeCompute(params: ComputeParams): Promise<ComputeResult> {
    const request: ComputeExecuteRequest = {
      script: params.script,
      entry_point: params.entryPoint,
      input: params.input,
      secret_refs: params.secretRefs,
      timeout: params.timeout,
    };

    const result: TEEResult = await this.oracle.executeTEE(request);
    const raw = result.raw as ComputeJobResult | undefined;

    return {
      output: result.result,
      attestation: result.attestation,
      verified: result.verified,
      jobId: raw?.job_id,
      gasUsed: raw?.gas_used,
      raw: result.raw,
    };
  }

  /**
   * Execute a pre-registered compute script by name.
   * Useful for app-specific scripts that are deployed alongside the contract.
   */
  async executeRegisteredScript(scriptName: string, input?: Record<string, unknown>): Promise<ComputeResult> {
    const params: RegisteredComputeRequest = {
      appId: this.appId,
      scriptName,
      input,
    };

    const result: TEEResult = await this.oracle.executeRegisteredScript(params);
    const raw = result.raw as ComputeJobResult | undefined;

    return {
      output: result.result,
      attestation: result.attestation,
      verified: result.verified,
      jobId: raw?.job_id,
      gasUsed: raw?.gas_used,
      raw: result.raw,
    };
  }

  // -- VRF (alias for requestRandom) ----------------------------------------

  /**
   * Request VRF output. This is semantically identical to requestRandom
   * but returns the raw proof and output for on-chain verification.
   */
  async requestVrf(input: string): Promise<{ proof: string; output: string }> {
    const result = await this.oracle.requestRandomness(input);
    return {
      proof: result.proof,
      output: result.value,
    };
  }

  // -- NeoDID ---------------------------------------------------------------

  /**
   * Resolve a NeoDID document.
   */
  async resolveDid(did: string): Promise<unknown> {
    return this.oracle.resolveNeoDid(did);
  }

  /**
   * Get NeoDID providers for the current network.
   */
  async getDidProviders(): Promise<unknown> {
    return this.oracle.getNeoDidProviders();
  }

  // -- Seal / Confidential --------------------------------------------------

  /**
   * Get the Oracle's public encryption key for client-side sealing.
   */
  async getOraclePublicKey(): Promise<OraclePublicKeyResponse> {
    return this.oracle.getOraclePublicKey();
  }

  /**
   * Store a sealed ciphertext as a confidential reference on the Oracle backend.
   */
  async storeConfidentialCiphertext(params: ConfidentialStoreRequest): Promise<ConfidentialStoreResponse> {
    return this.oracle.storeConfidentialCiphertext(params);
  }

  // -- Raw HTTP Oracle Query ------------------------------------------------

  /**
   * Full HTTP Oracle query returning the raw OracleQueryResponse (status_code, headers, body).
   * Useful for console/debug apps that need the complete response shape.
   */
  async queryAllowlistedUrl(params: OracleQueryRequest): Promise<OracleQueryResponse> {
    return this.oracle.queryAllowlistedUrl(params);
  }

  // -- NeoDID (with format) -------------------------------------------------

  /**
   * Resolve a NeoDID document with an optional format ("resolution" | "document").
   */
  async resolveDidWithFormat(did: string, format?: "resolution" | "document"): Promise<unknown> {
    return this.oracle.resolveNeoDid(did, format);
  }

  // -- State accessors ------------------------------------------------------

  /** Whether an oracle request is currently in flight. */
  get isRequesting() {
    return this.oracle.isRequesting;
  }

  /** Whether the oracle backend is available. */
  get isAvailable() {
    return this.oracle.isOracleAvailable;
  }

  /** The VRF result from the last randomness request. */
  get lastRandom() {
    return this.oracle.lastRandom;
  }

  /** Current network identifier. */
  get network() {
    return this.oracle.network;
  }

  /** External integration config (contract hashes, API URLs, domains). */
  get integration() {
    return this.oracle.integration;
  }
}
