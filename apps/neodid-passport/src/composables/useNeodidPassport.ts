/**
 * useNeodidPassport -- Domain logic for NeoDID Passport
 *
 * Receives OracleService from PlatformServices instead of
 * using useOracle directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService, ClipboardService } from "@shared/services";
import { CREDENTIAL_REGISTRY } from "@shared/constants";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { buildMiniAppLaunchUrl } from "@shared/utils/miniapp-routes";

export interface UseNeodidPassportOptions {
  oracle: OracleService;
  clipboard: ClipboardService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeodidPassport({ oracle, clipboard, t }: UseNeodidPassportOptions) {
  const wallet = useWallet() as WalletSDK;
  const identityCredential = CREDENTIAL_REGISTRY.identity_passport;

  const did = ref("did:morpheus:neo_n3:service:neodid");
  const format = ref("resolution");
  const secretName = ref("passport-ref");
  const credentialRecipient = ref("");
  const credentialTemplateId = ref("");
  const ciphertext = ref("");
  const latestPayload = ref<Record<string, unknown> | null>(null);

  const normalizedFormat = computed<"resolution" | "document">(() =>
    String(format.value || "").trim().toLowerCase() === "document" ? "document" : "resolution",
  );

  const providerCount = computed(() => {
    const payload = latestPayload.value;
    if (!payload) return 0;
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload.providers)) return payload.providers.length;
    if (payload.providers && typeof payload.providers === "object") {
      return Object.keys(payload.providers as Record<string, unknown>).length;
    }
    return 0;
  });

  const renderedPayload = computed(() =>
    JSON.stringify(latestPayload.value ?? {}, null, 2) || t("notAvailable"),
  );

  // State values for manifest bindings
  const oracleHash = computed(() => oracle.integration.contracts.morpheusOracle);
  const networkDisplay = computed(() => oracle.network);
  const publicApiUrl = computed(() => oracle.integration.morpheusPublicApiUrl);
  const neodidDomain = computed(() => oracle.integration.domains.neodid || t("notPublished"));
  const neodidContract = computed(() => oracle.integration.contracts.morpheusNeoDid || t("externalResolver"));

  async function resolveDidDocument() {
    latestPayload.value = await oracle.resolveDidWithFormat(did.value, normalizedFormat.value) as Record<string, unknown>;
    return { success: true };
  }

  async function loadProviders() {
    latestPayload.value = await oracle.getDidProviders() as Record<string, unknown>;
    return { success: true };
  }

  async function fetchOracleKey() {
    latestPayload.value = await oracle.getOraclePublicKey() as unknown as Record<string, unknown>;
    return { success: true };
  }

  async function storeRef() {
    if (!String(ciphertext.value || "").trim()) {
      throw new Error(t("storeFailed"));
    }
    latestPayload.value = await oracle.storeConfidentialCiphertext({
      ciphertext: ciphertext.value,
      name: secretName.value || undefined,
      project_slug: "neodid-passport",
      metadata: {
        did: did.value,
        format: normalizedFormat.value,
      },
    }) as unknown as Record<string, unknown>;
    return { success: true };
  }

  function buildIdentityCredentialUrl() {
    const payload = latestPayload.value || {};
    const recipient = String(credentialRecipient.value || wallet.address.value || "").trim();
    const resolvedDid = String((payload.id as string) || did.value || "").trim();
    const achievement = resolvedDid ? "NeoDID Passport Verified" : "Identity Credential";
    const memo = resolvedDid ? `DID ${resolvedDid}` : "Identity credential draft";
    const params = new URLSearchParams({
      issueRecipient: recipient,
      issueRecipientName: "",
      issueAchievement: achievement,
      issueMemo: memo,
      issueCategory: identityCredential.category,
      issueCredentialType: identityCredential.credentialType,
      issueIssuerPolicy: identityCredential.issuerPolicy,
      issueSource: "neodid-passport",
      autoIssueDraft: "1",
    });
    if (credentialTemplateId.value.trim()) {
      params.set("issueTemplateId", credentialTemplateId.value.trim());
    }
    return buildMiniAppLaunchUrl("miniapp-soulbound-certificate", Object.fromEntries(params.entries()));
  }

  function openIdentityCredentialDraft() {
    const url = buildIdentityCredentialUrl();
    if (typeof window !== "undefined" && window.open) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return { success: true };
  }

  async function copyIdentityCredentialLink() {
    const url = buildIdentityCredentialUrl();
    await clipboard.copy(url, "identityCredentialCopied");
    return { success: true };
  }

  async function shareIdentityCredentialLink() {
    const url = buildIdentityCredentialUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("openIdentityCredential"),
          text: t("openIdentityCredential"),
          url,
        });
        return { success: true, method: "share" };
      } catch (error: unknown) {
        if (error instanceof Error && /abort|cancel/i.test(error.message)) {
          return { success: false, method: "cancelled" };
        }
      }
    }
    await clipboard.copy(url, "identityCredentialShared");
    return { success: true, method: "clipboard" };
  }

  const loadAll = async () => {
    // No initial data to load for NeoDID passport
  };

  return {
    // State
    did,
    format,
    secretName,
    credentialRecipient,
    credentialTemplateId,
    ciphertext,
    latestPayload,
    normalizedFormat,
    providerCount,
    renderedPayload,
    oracleHash,
    networkDisplay,
    publicApiUrl,
    neodidDomain,
    neodidContract,
    isRequesting: oracle.isRequesting,

    // Actions
    resolveDidDocument,
    loadProviders,
    fetchOracleKey,
    storeRef,
    openIdentityCredentialDraft,
    copyIdentityCredentialLink,
    shareIdentityCredentialLink,
    loadAll,
  };
}

export type UseNeodidPassportReturn = ReturnType<typeof useNeodidPassport>;
