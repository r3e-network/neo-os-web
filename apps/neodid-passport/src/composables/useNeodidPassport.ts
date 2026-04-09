/**
 * useNeodidPassport -- Domain logic for NeoDID Passport (React)
 *
 * Receives OracleService from PlatformServices instead of
 * using useOracle directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
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

  const did = createObservable("did:morpheus:neo_n3:service:neodid");
  const format = createObservable("resolution");
  const secretName = createObservable("passport-ref");
  const credentialRecipient = createObservable("");
  const credentialTemplateId = createObservable("");
  const ciphertext = createObservable("");
  const latestPayload = createObservable<Record<string, unknown> | null>(null);

  const normalizedFormat: Observable<"resolution" | "document"> = {
    get: () => String(format.get() || "").trim().toLowerCase() === "document" ? "document" : "resolution",
    set: (val) => format.set(val),
    subscribe: (listener) => format.subscribe(listener),
  };

  const providerCount: Observable<number> = {
    get: () => {
      const payload = latestPayload.get();
      if (!payload) return 0;
      if (Array.isArray(payload)) return payload.length;
      if (Array.isArray(payload.providers)) return payload.providers.length;
      if (payload.providers && typeof payload.providers === "object") {
        return Object.keys(payload.providers as Record<string, unknown>).length;
      }
      return 0;
    },
    set: () => {},
    subscribe: (listener) => latestPayload.subscribe(listener),
  };

  const renderedPayload: Observable<string> = {
    get: () => JSON.stringify(latestPayload.get() ?? {}, null, 2) || t("notAvailable"),
    set: () => {},
    subscribe: (listener) => latestPayload.subscribe(listener),
  };

  // State values for manifest bindings
  const oracleHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusOracle,
    set: () => {},
    subscribe: () => () => {},
  };
  const networkDisplay: Observable<string> = {
    get: () => oracle.network,
    set: () => {},
    subscribe: () => () => {},
  };
  const publicApiUrl: Observable<string> = {
    get: () => oracle.integration.morpheusPublicApiUrl,
    set: () => {},
    subscribe: () => () => {},
  };
  const neodidDomain: Observable<string> = {
    get: () => oracle.integration.domains.neodid || t("notPublished"),
    set: () => {},
    subscribe: () => () => {},
  };
  const neodidContract: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusNeoDid || t("externalResolver"),
    set: () => {},
    subscribe: () => () => {},
  };

  async function resolveDidDocument() {
    latestPayload.set(await oracle.resolveDidWithFormat(did.get(), normalizedFormat.get()) as Record<string, unknown>);
    return { success: true };
  }

  async function loadProviders() {
    latestPayload.set(await oracle.getDidProviders() as Record<string, unknown>);
    return { success: true };
  }

  async function fetchOracleKey() {
    latestPayload.set(await oracle.getOraclePublicKey() as unknown as Record<string, unknown>);
    return { success: true };
  }

  async function storeRef() {
    if (!String(ciphertext.get() || "").trim()) {
      throw new Error(t("storeFailed"));
    }
    latestPayload.set(await oracle.storeConfidentialCiphertext({
      ciphertext: ciphertext.get(),
      name: secretName.get() || undefined,
      project_slug: "neodid-passport",
      metadata: {
        did: did.get(),
        format: normalizedFormat.get(),
      },
    }) as unknown as Record<string, unknown>);
    return { success: true };
  }

  function buildIdentityCredentialUrl() {
    const payload = latestPayload.get() || {};
    const recipient = String(credentialRecipient.get() || wallet.address.value || "").trim();
    const resolvedDid = String((payload.id as string) || did.get() || "").trim();
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
    if (credentialTemplateId.get().trim()) {
      params.set("issueTemplateId", credentialTemplateId.get().trim());
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
