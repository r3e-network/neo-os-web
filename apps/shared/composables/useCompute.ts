/**
 * TEE Compute & Confidential Store composable for Neo N3 MiniApps.
 *
 * Provides Trusted Execution Environment compute operations and
 * confidential ciphertext storage via the Morpheus oracle stack.
 */
import { ref } from "vue";
import { getNetwork } from "../constants/rpc";
import {
  type OracleConfig,
  type ComputeExecuteRequest,
  type RegisteredComputeRequest,
  type ComputeJobResult,
  type TEEResult,
  type ConfidentialStoreRequest,
  type ConfidentialStoreResponse,
  normalizeEdgeBaseUrl,
  getWindowMiniAppSDK,
  requestEdgeJSON,
  requestJson,
  toMiniAppError,
  ERROR_CODE_COMPUTE_EXECUTION_FAILED,
  ERROR_CODE_REGISTERED_COMPUTE_FAILED,
  ERROR_CODE_CONFIDENTIAL_STORE_FAILED,
} from "./_oracleInternals";

export function useCompute(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);

  const isRequesting = ref(false);
  const error = ref<string | null>(null);
  const lastComputeResult = ref<ComputeJobResult | null>(null);

  const executeTEE = async <T = unknown>(params: ComputeExecuteRequest): Promise<TEEResult<T>> => {
    isRequesting.value = true;
    error.value = null;
    try {
      const response = config.hostSdk?.compute?.execute
        ? await config.hostSdk.compute.execute(params)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/compute-execute", {
            method: "POST",
            body: {
              script: params.script,
              entry_point: params.entry_point,
              input: params.input,
              secret_refs: params.secret_refs,
              timeout: params.timeout,
            },
            getAuthToken: config.getAuthToken,
            getAPIKey: config.getAPIKey,
          });

      lastComputeResult.value = response as ComputeJobResult;
      return {
        result: (response.output ?? response.result ?? response) as T,
        attestation: String(response.attestation ?? ""),
        verified: Boolean(response.attestation || response.signature || response.output_hash),
        raw: response,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Compute execution failed";
      error.value = msg;
      throw toMiniAppError(e, "Compute execution failed", ERROR_CODE_COMPUTE_EXECUTION_FAILED);
    } finally {
      isRequesting.value = false;
    }
  };

  const executeRegisteredScript = async <T = unknown>(params: RegisteredComputeRequest): Promise<TEEResult<T>> => {
    const appId = String(params.appId ?? config.appId ?? "").trim();
    if (!appId) {
      throw new Error("appId is required for registered compute execution");
    }

    isRequesting.value = true;
    error.value = null;
    try {
      const response = await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/compute-app-execute", {
        method: "POST",
        body: {
          app_id: appId,
          script_name: params.scriptName,
          input: params.input,
          secret_refs: params.secretRefs,
          timeout: params.timeout,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });

      lastComputeResult.value = response as ComputeJobResult;
      return {
        result: (response.output ?? response.result ?? response) as T,
        attestation: String(response.attestation ?? ""),
        verified: Boolean(response.attestation || response.signature || response.output_hash),
        raw: response,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registered compute execution failed";
      error.value = msg;
      throw toMiniAppError(e, "Registered compute execution failed", ERROR_CODE_REGISTERED_COMPUTE_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const storeConfidentialCiphertext = async (params: ConfidentialStoreRequest): Promise<ConfidentialStoreResponse> => {
    isRequesting.value = true;
    error.value = null;
    try {
      return await requestJson<ConfidentialStoreResponse>("/api/morpheus/confidential/store", {
        method: "POST",
        body: {
          ciphertext: params.ciphertext,
          target_chain: "neo_n3",
          network,
          name: params.name,
          project_slug: params.project_slug,
          requester_script_hash: params.requester_script_hash,
          callback_contract: params.callback_contract,
          metadata: params.metadata,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Confidential store request failed";
      error.value = msg;
      throw toMiniAppError(e, "Confidential store request failed", ERROR_CODE_CONFIDENTIAL_STORE_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  return {
    network,
    isRequesting,
    error,
    lastComputeResult,
    executeTEE,
    executeRegisteredScript,
    storeConfidentialCiphertext,
  };
}
