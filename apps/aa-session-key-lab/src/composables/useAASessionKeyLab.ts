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
import {
  decodeSessionKey,
  formatGasBaseUnits,
  type DecodedSessionKey,
} from "../utils/sessionKeyDecode";

/** Decoded on-chain session key plus accrued spend, for the labeled detail view. */
export interface OnChainSessionView {
  decoded: DecodedSessionKey;
  /** Accrued spend (getSpentAmount) in GAS decimal, "" when unread. */
  spentGas: string;
}

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

  const sessionVerifier = integration.contracts.aaSessionKeyVerifier || "";

  // Form state (plain object, mutations happen through actions)
  const form = {
    accountSeed: "",
    sessionPublicKey: "",
    targetContract: "",
    allowedMethod: DEFAULT_SESSION_ALLOWED_METHOD,
    expiresAt: getDefaultSessionExpiryTimestamp(),
    spendingLimit: "0",
    description: "",
    dappId: DEFAULT_SESSION_DAPP_ID,
    sponsorAmount: DEFAULT_SESSION_SPONSOR_AMOUNT,
  };

  const sponsorState = createObservable<Record<string, unknown> | null>(null);
  const generatedPrivateKey = createObservable("");
  const lastConfigured = createObservable<SessionConfiguration | null>(null);
  const isSubmitting = createObservable(false);
  const isRevoking = createObservable(false);
  // The on-chain session key read back from the verifier (or null when none).
  const onChainSession = createObservable<string | null>(null);
  const hasOnChainSession = createObservable(false);
  // Decoded labeled view of the on-chain session key + accrued spend, so the
  // owner can verify scope/expiry/spend instead of reading raw JSON.
  const onChainSessionView = createObservable<OnChainSessionView | null>(null);

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

  // Mainnet SessionKeyVerifier.setSessionKey takes 7 params (adds
  // spendingLimit:Integer, description:String); testnet still has the 5-param
  // signature. The contracts are frozen, so branch on the active network to
  // forward the right arity — a 5-arg call on mainnet arity-mismatches and
  // faults after the user signs.
  function buildSessionKeyArgs(params: {
    accountIdHash: string;
    publicKey: string;
    targetContract: string;
    allowedMethod: string;
    expiresAt: number;
    spendingLimit: string;
    description: string;
  }) {
    const base = [
      { type: "Hash160", value: `0x${params.accountIdHash}` },
      { type: "ByteArray", value: params.publicKey },
      { type: "Hash160", value: params.targetContract },
      { type: "String", value: params.allowedMethod },
      { type: "Integer", value: String(params.expiresAt) },
    ];
    if (network === "mainnet") {
      base.push({ type: "Integer", value: params.spendingLimit });
      base.push({ type: "String", value: params.description });
    }
    return base;
  }

  // GAS spending limit as a base-unit integer string (0 = unlimited). Rejects
  // non-numeric / negative input before it reaches the contract.
  function normalizeSpendingLimit(value: string): string {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "0";
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(t("invalidSpendingLimit"));
    }
    const [whole, frac = ""] = trimmed.split(".");
    const padded = (frac + "00000000").slice(0, 8);
    const base = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
    return base || "0";
  }

  function txidOf(result: { txid?: string; tx?: string } | null | undefined): string {
    return String(result?.txid || result?.tx || "");
  }

  // Poll the verifier for the configured key so "Configured" reflects on-chain
  // truth, not just a broadcast txid. A matching pubKey read means the tx
  // HALTed and the verifier stored the key; otherwise leave the prior state.
  async function confirmSessionKey(accountIdHash: string, publicKey: string): Promise<boolean> {
    if (!sessionVerifier) return false;
    const accountId = `0x${accountIdHash}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 4000 : 5000));
      try {
        const read = await chain.read(
          "getSessionKey",
          [{ type: "Hash160", value: accountId }],
          { scriptHash: sessionVerifier },
        );
        const text = JSON.stringify(read ?? "").toLowerCase();
        if (text.includes(publicKey.toLowerCase())) {
          onChainSession.set(JSON.stringify(read));
          hasOnChainSession.set(true);
          return true;
        }
      } catch {
        // RPC lag — keep retrying within the attempt budget.
      }
    }
    return false;
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
      const spendingLimit = normalizeSpendingLimit(form.spendingLimit);

      const result = await invokeContract({
        scriptHash: aaCore,
        operation: "callVerifier",
        args: [
          { type: "Hash160", value: `0x${accountIdHash}` },
          { type: "String", value: "setSessionKey" },
          {
            type: "Array",
            value: buildSessionKeyArgs({
              accountIdHash,
              publicKey,
              targetContract,
              allowedMethod,
              expiresAt,
              spendingLimit,
              description: form.description.trim(),
            }),
          },
        ],
      });

      // Confirm on-chain before flipping to "Configured" so a faulted mainnet
      // arity mismatch no longer shows a green success for a key that does not
      // exist. Only set lastConfigured (which drives the green status) once the
      // verifier actually reports the key.
      const confirmed = await confirmSessionKey(accountIdHash, publicKey);
      if (!confirmed) {
        throw new Error(t("sessionNotConfirmed"));
      }

      lastConfigured.set({
        txid: txidOf(result),
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

  // Read the active session key directly from the verifier (key/target/method/
  // expiry/spent) — the security-critical "what did I delegate?" view.
  async function inspectSessionKey() {
    if (!sessionVerifier) throw new Error(t("sessionVerifierMissing"));
    const accountIdHash = deriveAAAccountIdHash(form.accountSeed);
    const accountId = `0x${accountIdHash}`;
    const read = await chain.read(
      "getSessionKey",
      [{ type: "Hash160", value: accountId }],
      { scriptHash: sessionVerifier },
    );
    const present =
      read !== null &&
      read !== undefined &&
      read !== "" &&
      !(Array.isArray(read) && read.length === 0);
    onChainSession.set(present ? JSON.stringify(read) : null);
    hasOnChainSession.set(present);

    // Decode the struct into labeled fields and read the accrued spend so the
    // budget half of the safety model (spent vs limit) is visible — a pure
    // added read against the same verifier; failures degrade to no-view.
    if (present) {
      const decoded = decodeSessionKey(read);
      let spentGas = "";
      try {
        const spentRaw = await chain.read(
          "getSpentAmount",
          [{ type: "Hash160", value: accountId }],
          { scriptHash: sessionVerifier },
        );
        spentGas = formatGasBaseUnits(spentRaw);
      } catch {
        // getSpentAmount unavailable / RPC lag — leave spend blank, still show scope.
        spentGas = "";
      }
      onChainSessionView.set(decoded ? { decoded, spentGas } : null);
    } else {
      onChainSessionView.set(null);
    }

    eventBus.emit("session:inspected", { present });
  }

  // Revoke the delegated session key — the permission-out path the verifier
  // exposes (clearSessionKey) but the app previously never wired.
  async function revokeSessionKey() {
    try {
      isRevoking.set(true);
      if (!address.value) await connect();
      const accountIdHash = deriveAAAccountIdHash(form.accountSeed);
      await invokeContract({
        scriptHash: aaCore,
        operation: "callVerifier",
        args: [
          { type: "Hash160", value: `0x${accountIdHash}` },
          { type: "String", value: "clearSessionKey" },
          {
            type: "Array",
            value: [{ type: "Hash160", value: `0x${accountIdHash}` }],
          },
        ],
      });
      onChainSession.set(null);
      hasOnChainSession.set(false);
      onChainSessionView.set(null);
      lastConfigured.set(null);
      eventBus.emit("session:revoked", {});
    } catch (error: unknown) {
      eventBus.emit("session:error", {
        message: formatErrorMessage(error, t("sessionRevokeFailed")),
      });
      throw error;
    } finally {
      isRevoking.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    form,
    generatedPrivateKey,
    lastConfigured,
    isSubmitting,
    isRevoking,
    onChainSession,
    hasOnChainSession,
    onChainSessionView,
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
    inspectSessionKey,
    revokeSessionKey,
    loadAll,
  };
}

export type UseAASessionKeyLabReturn = ReturnType<typeof useAASessionKeyLab>;
