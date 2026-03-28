/**
 * useNeodidConsole -- Domain logic for Oracle NeoDID Console
 *
 * Receives OracleService from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService } from "@shared/services";

export interface UseNeodidConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeodidConsole({ oracle, t }: UseNeodidConsoleOptions) {
  const did = ref("did:morpheus:neo_n3:service:neodid");
  const format = ref("resolution");
  const latestPayload = ref<Record<string, unknown> | null>(null);
  const providersPayload = ref<Record<string, unknown> | null>(null);

  function normalizeFormat(value: string): "resolution" | "document" {
    return String(value || "").trim().toLowerCase() === "document" ? "document" : "resolution";
  }

  function applyExample(kind: "service" | "vault" | "aa") {
    if (kind === "service") {
      did.value = "did:morpheus:neo_n3:service:neodid";
      format.value = "resolution";
      return;
    }
    if (kind === "vault") {
      did.value = "did:morpheus:neo_n3:vault:6d0656f6dd91469db1c90cc1e574380613f43738";
      format.value = "document";
      return;
    }
    did.value = "did:morpheus:neo_n3:aa:demo-account";
    format.value = "document";
  }

  const providerCount = computed(() => {
    if (Array.isArray(providersPayload.value)) return providersPayload.value.length;
    if (providersPayload.value && typeof providersPayload.value === "object") return Object.keys(providersPayload.value).length;
    return 0;
  });

  const renderedPayload = computed(() =>
    JSON.stringify(latestPayload.value ?? providersPayload.value ?? {}, null, 2) || t("notAvailable"),
  );

  // State values for manifest bindings
  const formatDisplay = computed(() => normalizeFormat(format.value));
  const networkDisplay = computed(() => oracle.network);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);
  const neodidContract = computed(() => oracle.integration.contracts.morpheusNeoDid || t("externalResolver"));
  const neodidDomain = computed(() => oracle.integration.domains.neodid || t("notPublished"));

  async function resolveDid() {
    latestPayload.value = await oracle.resolveDidWithFormat(did.value, normalizeFormat(format.value)) as Record<string, unknown>;
    return { success: true };
  }

  async function loadProviders() {
    providersPayload.value = await oracle.getDidProviders() as Record<string, unknown>;
    latestPayload.value = providersPayload.value;
    return { success: true };
  }

  const loadAll = async () => {
    // No initial data to load for NeoDID console
  };

  return {
    // State
    did,
    format,
    latestPayload,
    providersPayload,
    providerCount,
    renderedPayload,
    formatDisplay,
    networkDisplay,
    publicApiUrl,
    neodidContract,
    neodidDomain,
    isRequesting: oracle.isRequesting,

    // Actions
    normalizeFormat,
    applyExample,
    resolveDid,
    loadProviders,
    loadAll,
  };
}

export type UseNeodidConsoleReturn = ReturnType<typeof useNeodidConsole>;
