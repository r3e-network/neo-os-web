import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import {
  getExternalIntegrationConfig,
  getNetwork,
  resolveNeoNetwork,
} from "@shared/constants/rpc";
import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from "@shared/utils/safe-storage";
import { getDefaultRelayPayload } from "../launch";
import {
  draftFingerprint,
  hasValidRelayReviewDigest,
  inspectRelayReceipt,
  isRelayReceipt,
  isRelayReviewPackage,
  parseRelayDraft,
  parseRelayReceipt,
  prepareRelayReviewPackage,
  previewRelayDraft,
  type RelayChainOutcome,
  type RelayReceipt,
  type RelayReviewPackage,
} from "../relay-job";

export interface UseAARelayConsoleOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  fetcher?: typeof fetch;
  now?: () => number;
}

type SponsorEvidence = {
  status: "not-checked" | "eligible" | "not-eligible" | "unavailable";
  remaining: number | null;
  dailyLimit: string;
  usedToday: string;
  checkedAt: number;
};

type PersistedRelayJob = {
  version: 1;
  network: "mainnet" | "testnet";
  fingerprint: string;
  draft: { aaAddress: string; dappId: string; payloadJson: string };
  review: RelayReviewPackage;
  receipt: RelayReceipt | null;
  outcome: RelayChainOutcome | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function validOutcome(value: unknown, review: RelayReviewPackage, receipt: RelayReceipt | null): value is RelayChainOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const outcome = value as Partial<RelayChainOutcome>;
  return ["accepted", "pending", "confirmed", "fault", "mismatch", "unreachable"].includes(clean(outcome.status))
    && clean(outcome.txid) === clean(receipt?.txid)
    && Number.isFinite(outcome.checkedAt)
    && review.packageDigest === receipt?.packageDigest;
}

export function useAARelayConsole({ app, t, fetcher = fetch, now = Date.now }: UseAARelayConsoleOptions) {
  const network = resolveNeoNetwork(app.platform.launch.network || getNetwork());
  const integration = getExternalIntegrationConfig(network);
  const storageKey = `miniapp-aa-relay-console:v2:${network}`;

  const aaAddress = createObservable("");
  const dappId = createObservable("");
  const payloadJson = createObservable(getDefaultRelayPayload(network));
  const reviewPackage = createObservable<RelayReviewPackage | null>(null);
  const relayReceipt = createObservable<RelayReceipt | null>(null);
  const chainOutcome = createObservable<RelayChainOutcome | null>(null);
  const sponsorEvidence = createObservable<SponsorEvidence>({
    status: "not-checked",
    remaining: null,
    dailyLimit: "",
    usedToday: "",
    checkedAt: 0,
  });

  const isPreparing = createObservable(false);
  const isCheckingSponsorship = createObservable(false);
  const isTracking = createObservable(false);

  const reviewPackageJson = createObservable("");
  // `undefined`, not "": until a review package is prepared there is no job, so
  // nothing has been set. The chrome binds this and would render "" as a blank
  // tile — a void wearing a quiet costume — so the manifest declares a
  // `pendingKey` for this state instead. See manifest.ts.
  const reviewJobId = createObservable<string | undefined>(undefined);
  const reviewDigest = createObservable("");
  const reviewReadiness = createObservable("draft");
  const previewState = createObservable("not-run");
  const targetDisplay = createObservable("");
  const methodDisplay = createObservable("");
  const preparedFingerprint = createObservable("");
  const sponsorState = createObservable("not-checked");
  const sponsorSummary = createObservable(t("sponsorNotChecked"));
  const relayReceiptJson = createObservable("");
  const receiptStatus = createObservable("none");
  // `undefined` until a relay receipt carries a txid — same reasoning as
  // `reviewJobId`: no submission has been made, so there is no id to report.
  const txidDisplay = createObservable<string | undefined>(undefined);
  const chainStatus = createObservable("not-tracked");
  const chainReason = createObservable(t("receiptNotTracked"));
  const confirmationsDisplay = createObservable("0");
  const hasReview = createObservable(false);
  const hasReceipt = createObservable(false);
  const hasTrackableReceipt = createObservable(false);

  function refreshView() {
    const review = reviewPackage.get();
    const receipt = relayReceipt.get();
    const outcome = chainOutcome.get();
    const sponsor = sponsorEvidence.get();
    reviewPackageJson.set(review ? JSON.stringify(review, null, 2) : "");
    reviewJobId.set(review?.jobId ?? undefined);
    reviewDigest.set(review?.packageDigest ?? "");
    reviewReadiness.set(review?.readiness ?? "draft");
    previewState.set(review?.validationPreview.state ?? "not-run");
    targetDisplay.set(review?.target.contract ?? "");
    methodDisplay.set(review?.target.method ?? "");
    relayReceiptJson.set(receipt ? JSON.stringify(receipt, null, 2) : "");
    receiptStatus.set(receipt?.status ?? "none");
    txidDisplay.set(receipt?.txid ?? undefined);
    chainStatus.set(outcome?.status ?? (receipt?.txid ? "pending" : receipt ? "accepted" : "not-tracked"));
    chainReason.set(outcome?.reason ?? (receipt?.txid ? t("receiptPending") : receipt ? t("receiptAcceptedOnly") : t("receiptNotTracked")));
    confirmationsDisplay.set(String(outcome?.confirmations ?? 0));
    hasReview.set(Boolean(review));
    hasReceipt.set(Boolean(receipt));
    hasTrackableReceipt.set(Boolean(receipt?.txid));
    sponsorState.set(sponsor.status);
    sponsorSummary.set(
      sponsor.status === "eligible"
        ? t("sponsorEligibleSummary", { remaining: sponsor.remaining ?? 0, dailyLimit: sponsor.dailyLimit || "—" })
        : sponsor.status === "not-eligible"
          ? t("sponsorNotEligible")
          : sponsor.status === "unavailable"
            ? t("sponsorUnavailable")
            : t("sponsorNotChecked"),
    );
  }

  function persist() {
    const review = reviewPackage.get();
    if (!review) {
      safeRemoveStorage(storageKey);
      return;
    }
    const snapshot: PersistedRelayJob = {
      version: 1,
      network,
      fingerprint: preparedFingerprint.get(),
      draft: {
        aaAddress: aaAddress.get(),
        dappId: dappId.get(),
        payloadJson: payloadJson.get(),
      },
      review,
      receipt: relayReceipt.get(),
      outcome: chainOutcome.get(),
    };
    safeWriteStorage(storageKey, JSON.stringify(snapshot));
  }

  async function prepareReview() {
    const preparedAt = now();
    isPreparing.set(true);
    try {
      const fingerprint = draftFingerprint(aaAddress.get(), dappId.get(), payloadJson.get());
      const previous = preparedFingerprint.get();
      if (previous && previous !== fingerprint) {
        relayReceipt.set(null);
        chainOutcome.set(null);
      }
      const draft = parseRelayDraft({
        network,
        aaCore: integration.contracts.aaCore,
        paymaster: integration.contracts.aaPaymaster,
        aaAddress: aaAddress.get(),
        dappId: dappId.get(),
        payloadJson: payloadJson.get(),
        now: preparedAt,
      });
      const preview = await previewRelayDraft(draft, fetcher, preparedAt);
      const review = await prepareRelayReviewPackage({
        network,
        aaCore: integration.contracts.aaCore,
        paymaster: integration.contracts.aaPaymaster,
        aaAddress: aaAddress.get(),
        dappId: dappId.get(),
        payloadJson: payloadJson.get(),
        preview,
        now: preparedAt,
      });
      reviewPackage.set(review);
      preparedFingerprint.set(fingerprint);
      refreshView();
      persist();
      return review;
    } finally {
      isPreparing.set(false);
    }
  }

  async function checkSponsor() {
    const draft = parseRelayDraft({
      network,
      aaCore: integration.contracts.aaCore,
      paymaster: integration.contracts.aaPaymaster,
      aaAddress: aaAddress.get(),
      dappId: dappId.get(),
      payloadJson: payloadJson.get(),
      now: now(),
    });
    isCheckingSponsorship.set(true);
    try {
      const result = await app.aa.sponsorship.check({ aaAddress: draft.accountId, dappId: draft.dappId });
      const remaining = Number(result.remaining);
      const hasQuotaEvidence = Number.isFinite(remaining)
        && remaining >= 0
        && Boolean(clean(result.dailyLimit));
      sponsorEvidence.set({
        status: !hasQuotaEvidence
          ? "unavailable"
          : result.eligible === true && remaining > 0
            ? "eligible"
            : "not-eligible",
        remaining: hasQuotaEvidence ? remaining : null,
        dailyLimit: clean(result.dailyLimit),
        usedToday: clean(result.usedToday),
        checkedAt: now(),
      });
      refreshView();
    } catch (error) {
      sponsorEvidence.set({ status: "unavailable", remaining: null, dailyLimit: "", usedToday: "", checkedAt: now() });
      refreshView();
      throw error;
    } finally {
      isCheckingSponsorship.set(false);
    }
  }

  async function importReceipt(receiptJson: string) {
    const review = reviewPackage.get();
    if (!review) throw new Error(t("reviewRequiredFirst"));
    const receipt = parseRelayReceipt(receiptJson, {
      network,
      packageDigest: review.packageDigest,
      now: now(),
    });
    relayReceipt.set(receipt);
    chainOutcome.set(null);
    refreshView();
    persist();
    return receipt;
  }

  async function trackReceipt() {
    const review = reviewPackage.get();
    const receipt = relayReceipt.get();
    if (!review || !receipt) throw new Error(t("receiptRequiredFirst"));
    isTracking.set(true);
    try {
      const outcome = await inspectRelayReceipt(review, receipt, fetcher, now());
      chainOutcome.set(outcome);
      refreshView();
      persist();
      return outcome;
    } finally {
      isTracking.set(false);
    }
  }

  function clearJob() {
    reviewPackage.set(null);
    relayReceipt.set(null);
    chainOutcome.set(null);
    preparedFingerprint.set("");
    sponsorEvidence.set({ status: "not-checked", remaining: null, dailyLimit: "", usedToday: "", checkedAt: 0 });
    refreshView();
    persist();
  }

  async function loadAll() {
    if (clean(aaAddress.get())) {
      refreshView();
      return;
    }
    try {
      const parsed = JSON.parse(safeReadStorage(storageKey) || "null") as Partial<PersistedRelayJob> | null;
      if (!parsed || parsed.version !== 1 || parsed.network !== network) return;
      if (!isRelayReviewPackage(parsed.review, network, integration.contracts.aaCore)) return;
      if (!(await hasValidRelayReviewDigest(parsed.review))) return;
      const recoveredReview: RelayReviewPackage = {
        ...parsed.review,
        validationPreview: {
          ...parsed.review.validationPreview,
          state: "not-run",
          deadlineValid: null,
          nonceValid: null,
          verifierConfigured: null,
          reason: "recovered-preview-stale",
          checkedAt: 0,
        },
        readiness: "needs-chain-preview",
      };
      const receipt = isRelayReceipt(parsed.receipt, recoveredReview) ? parsed.receipt : null;
      const outcome = validOutcome(parsed.outcome, recoveredReview, receipt) ? parsed.outcome : null;
      aaAddress.set(clean(parsed.draft?.aaAddress));
      dappId.set(clean(parsed.draft?.dappId));
      payloadJson.set(clean(parsed.draft?.payloadJson) || JSON.stringify({ metaInvocation: recoveredReview.request.metaInvocation }, null, 2));
      reviewPackage.set(recoveredReview);
      relayReceipt.set(receipt);
      chainOutcome.set(outcome);
      preparedFingerprint.set(clean(parsed.fingerprint) || draftFingerprint(aaAddress.get(), dappId.get(), payloadJson.get()));
    } catch {
      safeRemoveStorage(storageKey);
    } finally {
      refreshView();
    }
  }

  refreshView();

  return {
    aaAddress,
    dappId,
    payloadJson,
    reviewPackage,
    relayReceipt,
    chainOutcome,
    reviewPackageJson,
    reviewJobId,
    reviewDigest,
    reviewReadiness,
    previewState,
    targetDisplay,
    methodDisplay,
    preparedFingerprint,
    sponsorState,
    sponsorSummary,
    relayReceiptJson,
    receiptStatus,
    txidDisplay,
    chainStatus,
    chainReason,
    confirmationsDisplay,
    hasReview,
    hasReceipt,
    hasTrackableReceipt,
    isPreparing,
    isCheckingSponsorship,
    isTracking,
    aaCoreDisplay: createObservable(integration.contracts.aaCore),
    paymasterDisplay: createObservable(integration.contracts.aaPaymaster || t("notPublished")),
    relayUrlDisplay: createObservable("authorized external relay"),
    networkDisplay: createObservable(network),
    runtimeMode: createObservable("review-only"),
    prepareReview,
    checkSponsor,
    importReceipt,
    trackReceipt,
    clearJob,
    loadAll,
  };
}

export type UseAARelayConsoleReturn = ReturnType<typeof useAARelayConsole>;
