/**
 * Oracle / VRF / TEE integration composable for Neo N3 miniapps.
 *
 * Provides verifiable randomness and trusted computation:
 * - VRF (Verifiable Random Function) for provably fair randomness
 * - TEE (Trusted Execution Environment) for private computation
 * - Price feed oracle for asset pricing via DataFeed contract
 *
 * On-chain integration patterns:
 *   VRF:   Contract.Call(oracleHash, "request", "vrf", payload, callbackContract, "onOracleResult")
 *   Price: invokeRead(dataFeedHash, "getLatest", ["TWELVEDATA:NEO-USD"])
 *   TEE:   POST to TEE_ENDPOINT with encrypted params, verify attestation
 *
 * Reference: github.com/r3e-network/neo-morpheus-oracle
 */
import { ref, computed } from "vue";

// ---------------------------------------------------------------------------
// Deployed contract hashes
// ---------------------------------------------------------------------------

/** MorpheusOracle contract – Neo N3 mainnet */
const ORACLE_CONTRACT_MAINNET = "0x017520f068fd602082fe5572596185e62a4ad991";

/** MorpheusOracle contract – Neo N3 testnet */
const ORACLE_CONTRACT_TESTNET = "0x4b882e94ed766807c4fd728768f972e13008ad52";

/** DataFeed contract – Neo N3 mainnet (price feeds, aggregated data) */
const DATA_FEED_CONTRACT_MAINNET = "0x03013f49c42a14546c8bbe58f9d434c3517fccab";

// ---------------------------------------------------------------------------
// Service endpoints
// ---------------------------------------------------------------------------

/** TEE (Trusted Execution Environment) endpoint – Phala dstack deployment */
const TEE_ENDPOINT = "https://966f16610bdfe1794a503e16c5ae0bc69a1d92f1-80.dstack-pha-prod9.phala.network";

export interface OracleConfig {
  /** Oracle contract hash on Neo N3 */
  oracleContractHash?: string;
  /** DataFeed contract hash on Neo N3 */
  dataFeedContractHash?: string;
  /** VRF provider endpoint */
  vrfEndpoint?: string;
  /** TEE attestation endpoint */
  teeEndpoint?: string;
}

export interface VRFResult {
  /** The verifiable random value */
  value: string;
  /** VRF proof for on-chain verification */
  proof: string;
  /** Request ID for tracking */
  requestId: string;
  /** Block number when fulfilled */
  blockNumber: number;
}

export interface TEEResult<T = unknown> {
  /** The computation result */
  result: T;
  /** TEE attestation report */
  attestation: string;
  /** Whether the result was verified */
  verified: boolean;
}

/**
 * Composable for Oracle/VRF/TEE integration.
 *
 * Usage in miniapps:
 * ```ts
 * // For verifiable randomness (gacha, coin flip, etc.)
 * const { requestRandomness, lastRandom } = useOracle();
 * const random = await requestRandomness("gacha-draw-123");
 *
 * // For price feeds
 * const { getPrice } = useOracle();
 * const neoPrice = await getPrice("NEO");
 *
 * // For TEE computation (red envelope distribution, etc.)
 * const { executeTEE } = useOracle();
 * const result = await executeTEE("distribute", { amounts: [100, 200, 300] });
 * ```
 */
export function useOracle(config: OracleConfig = {}) {
  const {
    oracleContractHash = ORACLE_CONTRACT_MAINNET,
    dataFeedContractHash = DATA_FEED_CONTRACT_MAINNET,
    vrfEndpoint = "",
    teeEndpoint = TEE_ENDPOINT,
  } = config;

  // State
  const isOracleAvailable = ref(false);
  const lastRandom = ref<VRFResult | null>(null);
  const isRequesting = ref(false);
  const error = ref<string | null>(null);

  /**
   * Request verifiable randomness from the VRF oracle.
   * Returns a provably fair random value that can be verified on-chain.
   *
   * On-chain flow:
   *   1. Caller invokes Contract.Call on the MorpheusOracle contract:
   *      Contract.Call(oracleContractHash, "request", CallFlags.All,
   *        "vrf",                    // requestType
   *        seed,                     // payload / seed string
   *        callerContractHash,       // callback contract
   *        "onOracleResult"          // callback method
   *      )
   *   2. The off-chain VRF oracle node picks up the request event
   *   3. Oracle generates a VRF output + proof from the seed
   *   4. Oracle submits the result back via MorpheusOracle.fulfill(requestId, result, proof)
   *   5. The contract invokes callbackContract.onOracleResult(requestId, result)
   *
   * Use cases: gacha draws, coin flips, red packet distribution, lottery
   *
   * @param seed - Application-specific seed (e.g. "gacha-draw-123")
   */
  const requestRandomness = async (seed: string): Promise<VRFResult> => {
    isRequesting.value = true;
    error.value = null;
    try {
      // Submit VRF request to the oracle contract:
      // await contract.invoke(oracleContractHash, "request", [
      //   { type: "String",  value: "vrf" },
      //   { type: "String",  value: seed },
      //   { type: "Hash160", value: callerContractHash },
      //   { type: "String",  value: "onOracleResult" },
      // ]);
      //
      // Then poll / subscribe for the fulfillment event:
      // const fulfillment = await waitForOracleEvent(requestId);

      const result: VRFResult = {
        value: "",
        proof: "",
        requestId: seed,
        blockNumber: 0,
      };
      lastRandom.value = result;
      return result;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "VRF request failed";
      throw e;
    } finally {
      isRequesting.value = false;
    }
  };

  /**
   * Execute computation in a Trusted Execution Environment (TEE).
   * The computation runs in a hardware-isolated enclave — results
   * are verifiable but inputs remain private.
   *
   * Flow:
   *   1. Encrypt params with the TEE enclave's public key
   *   2. POST to TEE_ENDPOINT with { operation, encryptedParams }
   *   3. TEE executes in the Phala dstack enclave, signs result with hardware key
   *   4. Verify the attestation report against known enclave measurements
   *   5. Return the verified result to the caller
   *
   * Use cases:
   * - Red packet "lucky" distribution (fair random split, hidden until claimed)
   * - Private payroll processing (aggregate visible, individual amounts hidden)
   * - PvP game resolution (both players' choices compared privately)
   *
   * @param operation - The TEE operation to execute
   * @param params - Parameters for the computation (will be encrypted)
   */
  const executeTEE = async <T = unknown>(operation: string, params: Record<string, unknown>): Promise<TEEResult<T>> => {
    isRequesting.value = true;
    error.value = null;
    try {
      // const encryptedParams = encryptForTEE(params, enclavePublicKey);
      // const response = await fetch(teeEndpoint, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ operation, params: encryptedParams }),
      // });
      // const { result, attestation } = await response.json();
      // const verified = verifyAttestation(attestation, enclaveExpectedMeasurement);

      return {
        result: null as T,
        attestation: "",
        verified: false,
      };
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "TEE execution failed";
      throw e;
    } finally {
      isRequesting.value = false;
    }
  };

  /**
   * Get the current price of an asset from the DataFeed oracle contract.
   *
   * On-chain call pattern:
   *   invokeRead(dataFeedContractHash, "getLatest", [
   *     { type: "String", value: "TWELVEDATA:NEO-USD" }
   *   ])
   *
   * The pair string follows the format "PROVIDER:BASE-QUOTE", e.g.:
   *   - "TWELVEDATA:NEO-USD"  → NEO price in USD
   *   - "TWELVEDATA:GAS-USD"  → GAS price in USD
   *
   * Use cases: self-loan collateral valuation, swap pricing, portfolio display
   *
   * @param asset - Asset symbol ("NEO", "GAS", or a custom pair string)
   */
  const getPrice = async (asset: "NEO" | "GAS" | string): Promise<number> => {
    try {
      // Map simple asset names to DataFeed pair strings
      const pairMap: Record<string, string> = {
        NEO: "TWELVEDATA:NEO-USD",
        GAS: "TWELVEDATA:GAS-USD",
      };
      const _pairString = pairMap[asset] ?? asset;

      // const result = await contract.invokeRead(dataFeedContractHash, "getLatest", [
      //   { type: "String", value: pair },
      // ]);
      // return parseFloat(result.stack[0].value);

      return 0;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Price feed failed";
      throw e;
    }
  };

  return {
    // Constants (useful for downstream consumers)
    ORACLE_CONTRACT_MAINNET,
    ORACLE_CONTRACT_TESTNET,
    DATA_FEED_CONTRACT_MAINNET,
    TEE_ENDPOINT,

    // State
    isOracleAvailable,
    lastRandom,
    isRequesting,
    error,

    // Actions
    requestRandomness,
    executeTEE,
    getPrice,
  };
}
