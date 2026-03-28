/**
 * useAASessionKeyLab — Domain logic for AA Session Key Lab
 *
 * Encapsulates session key generation, configuration, and sponsorship logic.
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, reactive, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { useAbstractAccount } from "@shared/composables/useAbstractAccount";
import type { GasSponsorCheckResponse } from "@shared/composables/useAbstractAccount";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { deriveAAAccountIdHash, generateAASessionKeyPair } from "@shared/utils/aa-account";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";

type SessionConfiguration = {
  txid: string;
  accountIdHash: string;
  publicKey: string;
  targetContract: string;
  allowedMethod: string;
  expiresAt: number;
};

export interface UseAASessionKeyLabOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAASessionKeyLab({ chain, eventBus, t }: UseAASessionKeyLabOptions) {
  const wallet = useWallet() as WalletSDK;
  const { address, connect, invokeContract } = wallet;
  const integration = getExternalIntegrationConfig("testnet");
  const aaCore = integration.contracts.aaCore;
  const aa = useAbstractAccount({
    network: "testnet",
    paymasterDappId: "miniapp-aa-session-key-lab",
  });

  const form = reactive({
    accountSeed: "",
    sessionPublicKey: "",
    targetContract: "",
    allowedMethod: "*",
    expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
  });

  const sponsorState = ref<GasSponsorCheckResponse | null>(null);
  const generatedPrivateKey = ref("");
  const lastConfigured = ref<SessionConfiguration | null>(null);
  const isSubmitting = ref(false);

  // -- Derived values --
  const derivedAccountIdHash = computed(() => {
    try {
      return form.accountSeed.trim() ? `0x${deriveAAAccountIdHash(form.accountSeed)}` : "";
    } catch (_e: unknown) {
      console.warn("[aa-session-key-lab] deriveAAAccountIdHash failed:", _e instanceof Error ? _e.message : String(_e));
      return "";
    }
  });

  const normalizedAllowedMethod = computed(() => String(form.allowedMethod || "").trim() || t("anyMethod"));

  const normalizedTargetContract = computed(() => {
    try {
      return form.targetContract.trim() ? normalizeHashOrAddress(form.targetContract) : "";
    } catch (_e: unknown) {
      console.warn("[aa-session-key-lab] normalizeHashOrAddress failed:", _e instanceof Error ? _e.message : String(_e));
      return "";
    }
  });

  const sponsorStateText = computed(() => JSON.stringify(sponsorState.value ?? {}, null, 2));

  // -- Display values --
  const sessionStatusDisplay = computed(() => lastConfigured.value ? t("configured") : t("pending"));
  const sessionVerifierDisplay = computed(() => integration.contracts.aaSessionKeyVerifier || t("notAvailable"));
  const aaCoreDisplay = computed(() => aaCore);
  const walletDisplay = computed(() => address.value || t("notConnected"));
  const sponsorStatusDisplay = computed(() => sponsorState.value ? t("checked") : t("idle"));

  // -- Detail items for display --
  const detailItems = computed(() => [
    { label: t("accountIdHash"), value: lastConfigured.value?.accountIdHash || derivedAccountIdHash.value || t("notAvailable") },
    { label: t("sessionPublicKey"), value: lastConfigured.value?.publicKey || form.sessionPublicKey || t("notAvailable") },
    { label: t("targetContract"), value: lastConfigured.value?.targetContract || normalizedTargetContract.value || t("notAvailable") },
    { label: t("allowedMethod"), value: lastConfigured.value?.allowedMethod || normalizedAllowedMethod.value || t("anyMethod") },
    { label: t("expiresAt"), value: lastConfigured.value?.expiresAt || form.expiresAt || t("notAvailable") },
    { label: t("lastTx"), value: lastConfigured.value?.txid || t("notAvailable") },
    { label: t("generatedPrivateKey"), value: generatedPrivateKey.value || t("notAvailable") },
    { label: t("sponsorship"), value: sponsorStateText.value },
  ]);

  // -- Helpers --
  function normalizeHashOrAddress(value: string): string {
    const trimmed = String(value || "").trim();
    if (!trimmed) throw new Error(t("invalidTargetContract"));
    const normalized = trimmed.startsWith("N") ? addressToScriptHash(trimmed) : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidTargetContract"));
    return normalized.toLowerCase();
  }

  function normalizeSessionPublicKey(value: string): string {
    const normalized = String(value || "").trim().replace(/^0x/i, "").toLowerCase();
    if (!/^[0-9a-f]{66}$/i.test(normalized)) throw new Error(t("invalidSessionPublicKey"));
    return normalized;
  }

  function normalizeExpiry(value: string): number {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= Math.floor(Date.now() / 1000)) throw new Error(t("invalidExpiry"));
    return parsed;
  }

  // -- Actions --
  function generateSessionKey() {
    const pair = generateAASessionKeyPair();
    form.sessionPublicKey = pair.publicKey;
    generatedPrivateKey.value = pair.privateKey;
    eventBus.emit("sessionKey:generated", {});
  }

  async function checkSponsor() {
    try {
      sponsorState.value = await aa.checkGasSponsorship();
      eventBus.emit("sponsor:checked", {});
    } catch (error: unknown) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(error, t("sponsorCheckFailed")) });
      throw error;
    }
  }

  async function requestSponsor() {
    try {
      sponsorState.value = await aa.requestGasSponsorship("0.1");
      eventBus.emit("sponsor:requested", {});
    } catch (error: unknown) {
      eventBus.emit("sponsor:error", { message: formatErrorMessage(error, t("sponsorRequestFailed")) });
      throw error;
    }
  }

  async function configureSessionKey() {
    try {
      isSubmitting.value = true;
      if (!address.value) await connect();

      const accountIdHash = deriveAAAccountIdHash(form.accountSeed);
      const publicKey = normalizeSessionPublicKey(form.sessionPublicKey);
      const targetContract = normalizeHashOrAddress(form.targetContract);
      const allowedMethod = normalizedAllowedMethod.value;
      const expiresAt = normalizeExpiry(form.expiresAt);

      const result = await invokeContract({
        scriptHash: aaCore,
        operation: "callVerifier",
        args: [
          { type: "Hash160", value: `0x${accountIdHash}` },
          { type: "String", value: "setSessionKey" },
          {
            type: "Array",
            value: [
              { type: "Hash160", value: `0x${accountIdHash}` },
              { type: "ByteArray", value: publicKey },
              { type: "Hash160", value: targetContract },
              { type: "String", value: allowedMethod },
              { type: "Integer", value: String(expiresAt) },
            ],
          },
        ],
      });

      lastConfigured.value = {
        txid: String(result.txid || result.tx || ""),
        accountIdHash: `0x${accountIdHash}`,
        publicKey,
        targetContract,
        allowedMethod,
        expiresAt,
      };
      eventBus.emit("session:configured", { txid: lastConfigured.value.txid });
    } catch (error: unknown) {
      eventBus.emit("session:error", { message: formatErrorMessage(error, t("sessionConfigureFailed")) });
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  const loadAll = async () => {
    // No initial data to load — session config is user-triggered
  };

  return {
    // -- Form state --
    form,
    generatedPrivateKey,
    lastConfigured,
    isSubmitting,
    sponsorState,

    // -- AA instance --
    aa,

    // -- Derived --
    derivedAccountIdHash,
    normalizedAllowedMethod,
    normalizedTargetContract,
    sponsorStateText,

    // -- Display values --
    sessionStatusDisplay,
    sessionVerifierDisplay,
    aaCoreDisplay,
    walletDisplay,
    sponsorStatusDisplay,
    detailItems,

    // -- Constants --
    aaCore,
    integration,

    // -- Actions --
    generateSessionKey,
    checkSponsor,
    requestSponsor,
    configureSessionKey,
    loadAll,
  };
}

export type UseAASessionKeyLabReturn = ReturnType<typeof useAASessionKeyLab>;
