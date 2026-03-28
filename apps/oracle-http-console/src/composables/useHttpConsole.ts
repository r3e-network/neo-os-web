/**
 * useHttpConsole -- Domain logic for Oracle HTTP Console
 *
 * Receives OracleService + EventBus from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService } from "@shared/services";

export interface UseHttpConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface HttpResponse {
  status_code: number;
  headers: Record<string, string>;
  body: string;
}

export function useHttpConsole({ oracle, t }: UseHttpConsoleOptions) {
  const url = ref("");
  const method = ref("GET");
  const secretName = ref("");
  const secretAsKey = ref("");
  const body = ref("");

  const response = ref<HttpResponse | null>(null);

  const responseHeaders = computed(() =>
    JSON.stringify(response.value?.headers ?? {}, null, 2),
  );
  const responseBody = computed(() =>
    String(response.value?.body ?? t("notAvailable")),
  );

  // State values for manifest bindings
  const methodDisplay = computed(() => method.value || t("methodPlaceholder"));
  const statusCode = computed(() =>
    String(response.value?.status_code ?? t("notAvailable")),
  );
  const oracleHash = computed(() => oracle.integration.contracts.morpheusOracle);
  const networkDisplay = computed(() => oracle.network);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);

  async function runQuery() {
    const result = await oracle.queryAllowlistedUrl({
      url: url.value,
      method: method.value || "GET",
      secret_name: secretName.value || undefined,
      secret_as_key: secretAsKey.value || undefined,
      body: body.value || undefined,
    });
    response.value = result as unknown as HttpResponse;
    return { success: true };
  }

  const loadAll = async () => {
    // No initial data to load for HTTP console
  };

  return {
    // State
    url,
    method,
    secretName,
    secretAsKey,
    body,
    response,
    responseHeaders,
    responseBody,
    methodDisplay,
    statusCode,
    oracleHash,
    networkDisplay,
    publicApiUrl,
    isRequesting: oracle.isRequesting,

    // Actions
    runQuery,
    loadAll,
  };
}

export type UseHttpConsoleReturn = ReturnType<typeof useHttpConsole>;
