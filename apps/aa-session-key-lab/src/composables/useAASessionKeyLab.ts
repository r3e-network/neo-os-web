/**
 * useAASessionKeyLab -- Domain logic for AA Session Key Lab
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { AAService, ChainService, EventBus } from "@shared/services";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import {
  deriveAAAccountIdHash,
  generateAASessionKeyPair,
} from "@shared/utils/aa-account";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";
import {
  DEFAULT_SESSION_ALLOWED_METHOD,
  DEFAULT_SESSION_DAPP_ID,
  DEFAULT_SESSION_SPONSOR_AMOUNT,
  getDefaultSessionExpiryTimestamp,
} from "../launch";

type SessionConfiguration = {
  txid: string;
  accountIdHash: string;
  publicKey: string;
  targetContract: string;
  allowedMethod: string;
  expiresAt: number;
};

export interface UseAASessionKeyLabOptions {
  aa: AAService;
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAASessionKeyLab({
  aa,
  chain,
  eventBus,
  t,
}: UseAASessionKeyLabOptions) {
  const wallet = useWallet() as WalletSDK;
  const { address, connect, invokeContract } = wallet;
  const network = getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const aaCore = integration.contracts.aaCore;

  // Form state (plain object, mutations happen through actions)
  const form = {
    accountSeed: "",
    sessionPublicKey: "",
    targetContract: "",
    allowedMethod: DEFAULT_SESSION_ALLOWED_METHOD,
    expiresAt: getDefaultSessionExpiryTimestamp(),
    dappId: DEFAULT_SESSION_DAPP_ID,
    sponsorAmount: DEFAULT_SESSION_SPONSOR_AMOUNT,
  };

  const sponsorState = createObservable<Record<string, unknown> | null>(null);
  const generatedPrivateKey = createObservable("");
  const lastConfigured = createObservable<SessionConfiguration | null>(null);
  const isSubmitting = createObservable(false);

  // Helpers
  function normalizeHashOrAddress(value: string): string {
    const trimmed = String(value || "").trim();
    if (!trimmed) throw new Error(t("invalidTargetContract"));
    const normalized = trimmed.startsWith("N")
      ? addressToScriptHash(trimmed)
      : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized))
      throw new Error(t("invalidTargetContract"));
    return normalized.toLowerCase();
  }

  function normalizeSessionPublicKey(value: string): string {
    const normalized = String(value || "")
      .trim()
      .replace(/^0x/i, "")
      .toLowerCase();
    if (!/^[0-9a-f]{66}$/i.test(normalized))
      throw new Error(t("invalidSessionPublicKey"));
    return normalized;
  }

  function normalizeExpiry(value: string): number {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= Math.floor(Date.now() / 1000))
      throw new Error(t("invalidExpiry"));
    return parsed;
  }

  function sponsorStatusText(state: Record<string, unknown> | null): string {
    if (!state) return t("sponsorNotChecked");
    if (typeof state.approved === "boolean") {
      return state.approved ? t("sponsorApproved") : t("sponsorNotApproved");
    }
    if (typeof state.eligible === "boolean") {
      return state.eligible ? t("sponsorEligible") : t("sponsorNotEligible");
    }
    return t("checked");
  }

  function pickSponsorValue(
    state: Record<string, unknown>,
    keys: string[],
  ): string {
    for (const key of keys) {
      const value = state[key];
      if (value === undefined || value === null || value === "") continue;
      return String(value);
    }
    return "";
  }

  function sponsorDetailItems(
    state: Record<string, unknown> | null,
  ): Array<{ label: string; value: string }> {
    if (!state) {
      return [{ label: t("sponsorship"), value: t("sponsorNotChecked") }];
    }

    const items = [{ label: t("sponsorship"), value: sponsorStatusText(state) }];
    const amount = pickSponsorValue(state, [
      "amount",
      "sponsorAmount",
      "sponsoredAmount",
      "gas",
      "budget",
    ]);
    const requestId = pickSponsorValue(state, [
      "requestId",
      "id",
      "sponsorRequestId",
      "txid",
    ]);

    if (amount) items.push({ label: t("sponsorAmount"), value: amount });
    if (requestId) {
      items.push({ label: t("sponsorRequestId"), value: requestId });
    }

    return items;
  }

  // Derived values
  const derivedAccountIdHash: Observable<string> = {
    get: () => {
      try {
        return form.accountSeed.trim()
          ? `0x${deriveAAAccountIdHash(form.accountSeed)}`
          : "";
      } catch (_e) {
        return "";
      }
    },
    set: () => {},
    subscribe: () => () => {},
  };

  const normalizedAllowedMethod: Observable<string> = {
    get: () => String(form.allowedMethod || "").trim() || t("anyMethod"),
    set: () => {},
    subscribe: () => () => {},
  };

  const normalizedTargetContract: Observable<string> = {
    get: () => {
      try {
        return form.targetContract.trim()
          ? normalizeHashOrAddress(form.targetContract)
          : "";
      } catch (_e) {
        return "";
      }
    },
    set: () => {},
    subscribe: () => () => {},
  };

  // Display values
  const sessionStatusDisplay: Observable<string> = {
    get: () => (lastConfigured.get() ? t("configured") : t("pending")),
    set: () => {},
    subscribe: (fn) => lastConfigured.subscribe(fn),
  };

  const sessionVerifierDisplay: Observable<string> = {
    get: () => integration.contracts.aaSessionKeyVerifier || t("notAvailable"),
    set: () => {},
    subscribe: () => () => {},
  };

  const aaCoreDisplay: Observable<string> = {
    get: () => aaCore,
    set: () => {},
    subscribe: () => () => {},
  };

  const walletDisplay: Observable<string> = {
    get: () => address.value || t("notConnected"),
    set: () => {},
    subscribe: () => () => {},
  };

  const sponsorStatusDisplay: Observable<string> = {
    get: () => sponsorStatusText(sponsorState.get()),
    set: () => {},
    subscribe: (fn) => sponsorState.subscribe(fn),
  };

  // Delegate to the live AA flag so host bindings re-render on toggle. A no-op
  // subscribe here would leave the sponsorship spinner stuck on after the
  // request completes, because the finally(false) would never notify React.
  const isCheckingSponsorship: Observable<boolean> = {
    get: () => aa.isCheckingSponsorship.get(),
    set: () => {},
    subscribe: (fn) => aa.isCheckingSponsorship.subscribe(fn),
  };

  // Detail items for display
  const detailItems: Observable<Array<{ label: string; value: string }>> = {
    get: () => {
      const lc = lastConfigured.get();
      return [
        {
          label: t("accountIdHash"),
          value:
            lc?.accountIdHash ||
            derivedAccountIdHash.get() ||
            t("notAvailable"),
        },
        {
          label: t("sessionPublicKey"),
          value: lc?.publicKey || form.sessionPublicKey || t("notAvailable"),
        },
        {
          label: t("targetContract"),
          value:
            lc?.targetContract ||
            normalizedTargetContract.get() ||
            t("notAvailable"),
        },
        {
          label: t("allowedMethod"),
          value:
            lc?.allowedMethod ||
            normalizedAllowedMethod.get() ||
            t("anyMethod"),
        },
        {
          label: t("expiresAt"),
          value: String(lc?.expiresAt || form.expiresAt || t("notAvailable")),
        },
        { label: t("lastTx"), value: lc?.txid || t("notAvailable") },
        ...sponsorDetailItems(sponsorState.get()),
      ];
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = lastConfigured.subscribe(fn);
      const u2 = generatedPrivateKey.subscribe(fn);
      const u3 = sponsorState.subscribe(fn);
      return () => {
        u1();
        u2();
        u3();
      };
    },
  };

  // Actions
  function generateSessionKey() {
    const pair = generateAASessionKeyPair();
    form.sessionPublicKey = pair.publicKey;
    generatedPrivateKey.set(pair.privateKey);
    eventBus.emit("sessionKey:generated", {});
  }

  async function checkSponsor() {
    try {
      const result = await aa.checkSponsorship({
        dappId: form.dappId,
      });
      sponsorState.set(result as unknown as Record<string, unknown>);
      eventBus.emit("sponsor:checked", {});
    } catch (error: unknown) {
      eventBus.emit("sponsor:error", {
        message: formatErrorMessage(error, t("sponsorCheckFailed")),
      });
      throw error;
    }
  }

  async function requestSponsor() {
    try {
      const result = await aa.requestSponsorship(
        form.sponsorAmount || DEFAULT_SESSION_SPONSOR_AMOUNT,
        {
          dappId: form.dappId,
        },
      );
      sponsorState.set(result as unknown as Record<string, unknown>);
      if (!result.approved) {
        throw new Error(t("sponsorRequestUnavailable"));
      }
      eventBus.emit("sponsor:requested", {});
    } catch (error: unknown) {
      eventBus.emit("sponsor:error", {
        message: formatErrorMessage(error, t("sponsorRequestFailed")),
      });
      throw error;
    }
  }

  async function configureSessionKey() {
    try {
      isSubmitting.set(true);
      if (!address.value) await connect();

      const accountIdHash = deriveAAAccountIdHash(form.accountSeed);
      const publicKey = normalizeSessionPublicKey(form.sessionPublicKey);
      const targetContract = normalizeHashOrAddress(form.targetContract);
      const allowedMethod = normalizedAllowedMethod.get();
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

      lastConfigured.set({
        txid: String(result.txid || result.tx || ""),
        accountIdHash: `0x${accountIdHash}`,
        publicKey,
        targetContract,
        allowedMethod,
        expiresAt,
      });
      eventBus.emit("session:configured", { txid: lastConfigured.get()!.txid });
    } catch (error: unknown) {
      eventBus.emit("session:error", {
        message: formatErrorMessage(error, t("sessionConfigureFailed")),
      });
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    form,
    generatedPrivateKey,
    lastConfigured,
    isSubmitting,
    sponsorState,
    derivedAccountIdHash,
    normalizedAllowedMethod,
    normalizedTargetContract,
    sessionStatusDisplay,
    sessionVerifierDisplay,
    aaCoreDisplay,
    walletDisplay,
    sponsorStatusDisplay,
    detailItems,
    isCheckingSponsorship,
    aaCore,
    integration,
    generateSessionKey,
    checkSponsor,
    requestSponsor,
    configureSessionKey,
    loadAll,
  };
}

export type UseAASessionKeyLabReturn = ReturnType<typeof useAASessionKeyLab>;
