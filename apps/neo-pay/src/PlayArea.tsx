/**
 * PlayArea.tsx -- Neo Pay
 *
 * Stream payment management interface with stats overview,
 * stream creation form, separate created/beneficiary stream lists
 * with progress bars, and cancel/claim actions.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { amountToBaseUnits } from "@shared/utils/amounts";
import type { StreamItem } from "./types";
import { deriveSchedule } from "./composables/deriveSchedule";
import {
  canClaim,
  deriveSchedulePreview,
  isFinalizedStatus,
  releasePerDayDisplay,
  statusLabelKey,
} from "./streamDisplay";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

type Stream = Partial<Omit<StreamItem, "status">> & {
  id: string;
  recipient?: string;
  sender?: string;
  amount?: number;
  remaining?: number;
  duration?: number;
  status?: string;
  startTime?: number;
  endTime?: number;
  token?: string;
};

const FIXED8_SCALE = 100000000n;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(value);
}

function formatAtomicAmount(value: bigint, assetSymbol: string): string {
  if (assetSymbol === "NEO") return value.toString();

  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / FIXED8_SCALE;
  const fraction = absolute % FIXED8_SCALE;
  if (fraction === 0n) return `${sign}${whole.toString()}`;

  const fractionText = fraction.toString().padStart(8, "0").replace(/0+$/u, "");
  return `${sign}${whole.toString()}.${fractionText}`;
}

function amountFromDisplayValue(
  value: bigint | number | string | undefined,
  assetSymbol: string,
): string {
  if (typeof value === "bigint") return formatAtomicAmount(value, assetSymbol);
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "0";
}

function normalizeToken(input: string): "GAS" | "NEO" {
  return input.trim().toUpperCase() === "NEO" ? "NEO" : "GAS";
}

function getLaunchValue(
  launchContext: MiniAppLaunchContext,
  keys: string[],
): string {
  for (const key of keys) {
    const value = String(launchContext.params?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  /* ---------- Bound state ---------- */
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const isCreating = bool("isCreating");
  // List cards reflect actual fetch state: the initial load and every
  // post-action refresh set isRefreshing, while isLoading is only set during
  // stream creation. Gate the list spinners on either so the cards show a
  // loading indicator during the first fetch instead of flashing the empty
  // state, and the create-button spinner stays driven by isCreating.
  const isListLoading = isLoading || isRefreshing;
  const claimingId = str("claimingId");
  const cancellingId = str("cancellingId");
  const activeCount = num("activeCount");
  const totalStreamCount = num("totalStreamCount");
  const serviceNotice = str("serviceNotice");

  const createdStreams = (val("createdStreams") ?? []) as Stream[];
  const beneficiaryStreams = (val("beneficiaryStreams") ?? []) as Stream[];
  const hasStreamActivity =
    totalStreamCount > 0 ||
    activeCount > 0 ||
    createdStreams.length > 0 ||
    beneficiaryStreams.length > 0;

  /* ---------- Local form state ---------- */
  const launchRecipient = getLaunchValue(launchContext, [
    "recipient",
    "to",
    "beneficiary",
  ]);
  const launchAmount = getLaunchValue(launchContext, ["amount", "total"]);
  const launchDuration =
    getLaunchValue(launchContext, ["duration", "durationDays", "days"]) ||
    (launchRecipient && launchAmount ? "1" : "");
  const launchToken = normalizeToken(
    getLaunchValue(launchContext, ["token", "asset"]),
  );
  const launchNotes = getLaunchValue(launchContext, ["notes", "note", "memo"]);

  const [recipient, setRecipient] = useState(launchRecipient);
  const [amount, setAmount] = useState(launchAmount);
  const [duration, setDuration] = useState(launchDuration);
  const [token, setToken] = useState(launchToken);
  const [notes, setNotes] = useState(launchNotes);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(launchNotes));
  const [localCreating, setLocalCreating] = useState(false);
  const [localClaimingId, setLocalClaimingId] = useState("");
  const [localCancellingId, setLocalCancellingId] = useState("");

  useEffect(() => {
    if (launchRecipient) setRecipient(launchRecipient);
    if (launchAmount) setAmount(launchAmount);
    if (launchDuration) setDuration(launchDuration);
    if (launchToken) setToken(launchToken);
    if (launchNotes) setNotes(launchNotes);
    setDetailsOpen(Boolean(launchNotes));
  }, [launchAmount, launchDuration, launchNotes, launchRecipient, launchToken]);

  /* ---------- Handlers ---------- */
  const handleCreateStream = async () => {
    if (!canCreateStream) return;
    setLocalCreating(true);
    try {
      await dispatch("createStream", {
        recipient,
        amount,
        duration,
        token,
        notes,
      });
      clearDraft();
    } finally {
      setLocalCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    setLocalCancellingId(id);
    try {
      await dispatch("cancelStream", id);
    } finally {
      setLocalCancellingId("");
    }
  };

  const handleClaim = async (id: string) => {
    setLocalClaimingId(id);
    try {
      await dispatch("claimStream", id);
    } finally {
      setLocalClaimingId("");
    }
  };

  /* ---------- Helpers ---------- */
  const formatAddress = (addr: string) =>
    addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;

  const getAssetSymbol = (stream: Stream): string =>
    stream.token || stream.assetSymbol || token;

  const getPrimaryAddress = (stream: Stream, direction: "to" | "from"): string => {
    const value =
      direction === "to"
        ? stream.recipient || stream.beneficiary
        : stream.sender || stream.creator;
    return String(value || "");
  };

  const getDurationDays = (stream: Stream): number | undefined =>
    stream.duration ?? stream.intervalDays;

  const getStreamTitle = (stream: Stream): string =>
    String(stream.title || "").trim();

  const getTotalDisplay = (stream: Stream): string => {
    const assetSymbol = getAssetSymbol(stream);
    return amountFromDisplayValue(
      stream.totalAmount ?? stream.amount,
      assetSymbol,
    );
  };

  const getStreamProgress = (stream: Stream): number => {
    if (typeof stream.totalAmount === "bigint" && stream.totalAmount > 0n) {
      const released =
        typeof stream.releasedAmount === "bigint"
          ? stream.releasedAmount
          : typeof stream.remainingAmount === "bigint"
            ? stream.totalAmount - stream.remainingAmount
            : 0n;
      return clampPercent(Number((released * 10000n) / stream.totalAmount) / 100);
    }

    if (stream.amount === undefined || stream.amount <= 0) return 0;
    if (stream.remaining === undefined) {
      // Fall back to time-based if remaining is not set
      if (stream.startTime && stream.endTime) {
        const now = Date.now();
        const total = stream.endTime - stream.startTime;
        const elapsed = now - stream.startTime;
        return clampPercent((elapsed / total) * 100);
      }
      return 0;
    }
    return clampPercent(((stream.amount - stream.remaining) / stream.amount) * 100);
  };

  const getStreamed = (stream: Stream): string => {
    const assetSymbol = getAssetSymbol(stream);
    if (typeof stream.releasedAmount === "bigint") {
      return amountFromDisplayValue(stream.releasedAmount, assetSymbol);
    }
    if (
      typeof stream.totalAmount === "bigint" &&
      typeof stream.remainingAmount === "bigint"
    ) {
      return amountFromDisplayValue(
        stream.totalAmount - stream.remainingAmount,
        assetSymbol,
      );
    }
    if (stream.amount === undefined) return "0";
    if (stream.remaining !== undefined) {
      return (stream.amount - stream.remaining).toFixed(2);
    }
    return "0";
  };

  const getProgressColor = (pct: number): string => {
    if (pct >= 100) return "var(--ns-info, #3e8cff)";
    return "var(--ns-brand, #16c784)";
  };

  // Per-day release the creator committed to (rateAmount over its interval),
  // surfaced on created-stream cards so the ongoing release rate is visible —
  // mirroring the create-form schedulePreview. Returns undefined when the
  // stream lacks a meaningful per-day figure (so the row is simply omitted).
  const getReleasePerDay = (
    stream: Stream,
  ): { amount: string; token: string } | undefined => {
    const assetSymbol = getAssetSymbol(stream) === "NEO" ? "NEO" : "GAS";
    const amount = releasePerDayDisplay(stream.rateAmount, stream.intervalDays, assetSymbol);
    return amount === null ? undefined : { amount, token: assetSymbol };
  };

  const getClaimable = (stream: Stream): { display: string; positive: boolean } => {
    const assetSymbol = getAssetSymbol(stream);
    if (typeof stream.claimable === "bigint") {
      return {
        display: amountFromDisplayValue(stream.claimable, assetSymbol),
        positive: stream.claimable > 0n,
      };
    }
    if (stream.remaining !== undefined && stream.amount !== undefined) {
      const value = Math.max(stream.amount - stream.remaining, 0);
      return { display: value.toFixed(2), positive: value > 0 };
    }
    return { display: "0", positive: false };
  };

  // Map the normalized status (always one of active/completed/cancelled) to its
  // locale key so zh users see translated badges, not raw English strings.
  const statusLabel = (stream: Stream): string => t(statusLabelKey(stream.status));

  // Live schedule disclosure for the create form: GAS streams release linearly
  // per day; a sub-1-NEO/day NEO total collapses into a single end-of-term cliff
  // (deriveSchedule), which is non-obvious — surface it before the deposit.
  const schedulePreview = useMemo(
    () => deriveSchedulePreview(amount, duration, token),
    [amount, duration, token],
  );

  // Both GAS and NEO are supported: the standalone MiniAppNeoPay contract takes
  // base-unit deposits for either token (GAS scaled by 1e8, NEO as an
  // indivisible integer count) and streams them directly. GAS stays the
  // default; NEO is offered for indivisible whole-token streams.
  const tokenOptions = ["GAS", "NEO"] as const;
  const creatingStream = isCreating || localCreating;
  const activeClaimingId = claimingId || localClaimingId;
  const activeCancellingId = cancellingId || localCancellingId;
  const amountInput = amount.trim();
  const durationInput = duration.trim();
  const amountValue = Number.parseFloat(amountInput);
  const durationValue = Number.parseInt(durationInput, 10);
  const derivedSchedule = useMemo(
    () => deriveSchedule(amountInput, durationInput, token),
    [amountInput, durationInput, token],
  );
  const totalBaseUnits = amountToBaseUnits(amountInput, token);
  const rateBaseUnits = amountToBaseUnits(derivedSchedule.rate, token);
  const amountReady = totalBaseUnits > 0n && rateBaseUnits > 0n;
  const durationReady =
    /^\d+$/u.test(durationInput) && durationValue >= 1 && durationValue <= 365;
  const canCreateStream =
    recipient.trim().length > 0 && amountReady && durationReady && !creatingStream;
  const draftHasValue =
    recipient.trim().length > 0 ||
    amount.trim().length > 0 ||
    duration.trim().length > 0 ||
    notes.trim().length > 0 ||
    token !== "GAS";
  const totalLabel = amountReady ? `${formatNumber(amountValue)} ${token}` : `0 ${token}`;
  const recipientPreview = recipient.trim()
    ? formatAddress(recipient.trim())
    : t("recipientPlaceholder");
  const releaseLabel =
    schedulePreview?.kind === "linear" || schedulePreview?.kind === "cliff"
      ? `${schedulePreview.amount} ${token}`
      : `0 ${token}`;
  const releaseRateLabel =
    schedulePreview?.kind === "cliff" ? t("rateAmount") : t("releasePerDay");
  const durationLabel = durationReady
    ? `${durationValue} ${t("days")}`
    : t("durationPlaceholder");
  const networkLabel =
    launchContext.network === "mainnet" ? t("networkMainnet") : t("networkTestnet");
  const stageState = creatingStream
    ? "creating"
    : canCreateStream
      ? "ready"
      : draftHasValue
        ? "draft"
        : hasStreamActivity
          ? "live"
          : "idle";
  const stageStatusLabel = creatingStream
    ? t("stageSigning")
    : canCreateStream
      ? t("stageReady")
      : draftHasValue
        ? t("stageDraft")
        : hasStreamActivity
          ? t("stageLive")
          : t("stageIdle");
  const submitLabel = creatingStream
    ? t("creatingStream")
    : canCreateStream
      ? t("createStream")
      : t("reviewStream");
  const showStreamLists = hasStreamActivity || isListLoading;
  const streamPresets = [
    { id: "weekly-gas", amount: "12", duration: "7", token: "GAS" as const },
    { id: "monthly-gas", amount: "60", duration: "30", token: "GAS" as const },
    { id: "quarter-neo", amount: "90", duration: "90", token: "NEO" as const },
  ];
  const activePresetId =
    streamPresets.find(
      (preset) =>
        preset.amount === amount.trim() &&
        preset.duration === duration.trim() &&
        preset.token === token,
    )?.id ?? "";

  function applyPreset(preset: (typeof streamPresets)[number]) {
    setAmount(preset.amount);
    setDuration(preset.duration);
    setToken(preset.token);
  }

  function clearDraft() {
    setRecipient("");
    setAmount("");
    setDuration("");
    setToken("GAS");
    setNotes("");
    setDetailsOpen(false);
  }

  return (
    <div className="neopay-play-area">
      {/* ==================== Payment Stream Stage ==================== */}
      <section
        className={`neopay-stream-stage neopay-stream-stage--${stageState}`}
        aria-label={t("paymentStageAria")}
      >
        <img
          className="neopay-stream-stage__image"
          src="./banner.jpg"
          alt=""
          aria-hidden="true"
        />
        <div className="neopay-stream-stage__shade" aria-hidden="true" />

        <div className="neopay-stream-stage__copy">
          <span className="neopay-stream-stage__eyebrow">
            {t("heroEyebrow")}
          </span>
          <h2 className="neopay-stream-stage__title">{t("heroTitle")}</h2>
          <p className="neopay-stream-stage__subtitle">
            {t("heroSubtitle")}
          </p>
          <div className="neopay-stream-stage__chips" aria-label={t("ariaStreams")}>
            <span>{networkLabel}</span>
            <span>{token}</span>
            <span>{stageStatusLabel}</span>
          </div>
        </div>

        <div className="neopay-flow-board" aria-label={t("streamFlowPreview")}>
          <div className="neopay-flow-board__top">
            <span>{t("stagedFlow")}</span>
            <strong>{totalLabel}</strong>
          </div>
          <div className="neopay-flow-path">
            <div className="neopay-flow-node neopay-flow-node--source">
              <span>{t("payerWallet")}</span>
              <strong>{totalLabel}</strong>
            </div>

            <div className="neopay-flow-track" aria-hidden="true">
              <span className="neopay-flow-track__line" />
              <span className="neopay-flow-token neopay-flow-token--one" />
              <span className="neopay-flow-token neopay-flow-token--two" />
              <span className="neopay-flow-vault">
                <span>{t("streamVault")}</span>
                <strong>{releaseLabel}</strong>
              </span>
            </div>

            <div className="neopay-flow-node neopay-flow-node--recipient">
              <span>{t("recipient")}</span>
              <strong>{recipientPreview}</strong>
            </div>
          </div>

          <div className="neopay-stage-metrics" role="group" aria-label={t("transactionPreview")}>
            <div>
              <span>{releaseRateLabel}</span>
              <strong>{releaseLabel}</strong>
            </div>
            <div>
              <span>{t("intervalLabel")}</span>
              <strong>{durationLabel}</strong>
            </div>
            <div>
              <span>{t("active")}</span>
              <strong>{activeCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {serviceNotice && (
        <div className="neopay-service-notice" role="status">
          <span className="neopay-service-notice__title">
            {t("streamListUnavailableTitle")}
          </span>
          <span>{serviceNotice}</span>
        </div>
      )}

      {/* ==================== Create Stream Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("streamConsole")}
        className="neopay-card neopay-card--form"
      >
        <div className="neopay-composer-shell">
          <div className="neopay-composer-main">
            <div className="neopay-composer">
              <div className="neopay-composer__amount">
                <span className="neopay-composer__label">{t("amount")}</span>
                <NeoInput
                  placeholder="0.00"
                  type="number"
                  value={amount}
                  suffix={token}
                  aria-label={t("amount")}
                  onChange={setAmount}
                />
              </div>

              <fieldset className="neopay-asset-switch" aria-label={t("token")}>
                {tokenOptions.map((tk) => (
                  <button
                    key={tk}
                    className={`neopay-token-option${token === tk ? " neopay-token-option--active is-active" : ""}`}
                    onClick={() => setToken(tk)}
                    type="button"
                    aria-label={tk}
                    aria-pressed={token === tk}
                  >
                    <strong>{tk}</strong>
                    <span aria-hidden="true">
                      {tk === "GAS" ? t("gasAssetHint") : t("neoAssetHint")}
                    </span>
                  </button>
                ))}
              </fieldset>

              <div className="neopay-form-grid">
                <NeoInput
                  label={t("recipient")}
                  placeholder={t("recipientPlaceholder")}
                  value={recipient}
                  onChange={setRecipient}
                />
                <NeoInput
                  label={t("duration")}
                  placeholder={t("durationPlaceholder")}
                  type="number"
                  value={duration}
                  suffix={t("days")}
                  onChange={setDuration}
                />
              </div>

              <details
                className="neopay-advanced"
                open={detailsOpen}
                onToggle={(event) => {
                  setDetailsOpen(event.currentTarget.open);
                }}
              >
                <summary>{t("streamMetadata")}</summary>
                <NeoInput
                  label={t("notes")}
                  placeholder={t("notesPlaceholder")}
                  value={notes}
                  onChange={setNotes}
                />
              </details>
            </div>

            <div className="neopay-presets" aria-label={t("createStream")}>
              {streamPresets.map((preset) => {
                const selected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={selected ? "is-active" : undefined}
                    aria-pressed={selected}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.amount} {preset.token} / {preset.duration}d
                  </button>
                );
              })}
            </div>

            <div className={`neopay-actions${draftHasValue ? " is-dirty" : ""}`}>
              <NeoButton
                variant="primary"
                className="neopay-create-cta"
                block
                loading={isCreating}
                disabled={!canCreateStream}
                onClick={handleCreateStream}
              >
                {submitLabel}
              </NeoButton>
              {draftHasValue && (
                <NeoButton variant="secondary" onClick={clearDraft}>
                  {t("clear")}
                </NeoButton>
              )}
            </div>
          </div>

          <aside
            className={`neopay-review-panel${canCreateStream ? " is-ready" : ""}`}
            aria-label={t("transactionPreview")}
          >
            <div className="neopay-review-panel__top">
              <span>{t("transactionPreview")}</span>
              <strong className={canCreateStream ? undefined : "neopay-review__pending"}>
                {canCreateStream ? totalLabel : t("enterDetails")}
              </strong>
            </div>
            <div className="neopay-summary">
              <div>
                <span>{t("recipient")}</span>
                <strong>{recipientPreview}</strong>
              </div>
              <div>
                <span>{t("totalAmount")}</span>
                <strong>{totalLabel}</strong>
              </div>
              <div>
                <span>{releaseRateLabel}</span>
                <strong>{releaseLabel}</strong>
              </div>
              <div>
                <span>{t("intervalLabel")}</span>
                <strong>{durationLabel}</strong>
              </div>
              <div>
                <span>{t("network")}</span>
                <strong>{networkLabel}</strong>
              </div>
              <div>
                <span>{t("networkFee")}</span>
                <strong className="neopay-summary__muted">{t("networkFeeValue")}</strong>
              </div>
            </div>
            <p className="neopay-review__hint">{t("transactionPreviewHint")}</p>
            {schedulePreview?.kind === "linear" && (
              <p className="neopay-form-disclosure" role="note">
                {t("schedulePreview", {
                  amount: schedulePreview.amount,
                  token,
                  days: schedulePreview.days,
                })}
              </p>
            )}
            {schedulePreview?.kind === "cliff" && (
              <p className="neopay-form-disclosure neopay-form-disclosure--warn" role="alert">
                {t("neoCliffNotice", {
                  amount: schedulePreview.amount,
                  days: schedulePreview.days,
                })}
              </p>
            )}
            <p className="neopay-form-disclosure" role="note">
              {t("twoStepSignNotice", { token })}
            </p>
          </aside>
        </div>
      </NeoCard>

      {showStreamLists ? (
        <div className="neopay-stream-grid">
          {/* ==================== Your Created Streams ==================== */}
          <NeoCard
            variant="erobo"
            title={`${t("yourCreatedStreams")} (${createdStreams.length})`}
            className="neopay-card"
          >
        {isListLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading")}</span>
          </div>
        ) : createdStreams.length === 0 ? (
          <div className="neopay-empty">
            <span className="neopay-empty-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h4l2 6 4-12 2 6h4" />
              </svg>
            </span>
            <span>
              {t("noCreatedStreams")}
            </span>
          </div>
        ) : (
          <div className="neopay-stream-list">
            {createdStreams.map((stream) => {
              const pct = getStreamProgress(stream);
              const streamed = getStreamed(stream);
              const assetSymbol = getAssetSymbol(stream);
              const totalDisplay = getTotalDisplay(stream);
              const recipientAddress = getPrimaryAddress(stream, "to");
              const durationDays = getDurationDays(stream);
              const title = getStreamTitle(stream);
              const releasePerDay = getReleasePerDay(stream);
              return (
                <div key={stream.id} className="neopay-stream-item">
                  <span
                    className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}
                  >
                    {statusLabel(stream)}
                  </span>
                  <div className="neopay-stream-info">
                    <div className="neopay-stream-heading">
                      <span className="neopay-stream-id">#{stream.id}</span>
                      {title && (
                        <span className="neopay-stream-title">{title}</span>
                      )}
                    </div>
                    <div className="neopay-stream-details">
                      {recipientAddress && (
                        <span className="neopay-stream-detail">
                          {t("to")}:{" "}
                          {formatAddress(recipientAddress)}
                        </span>
                      )}
                      <span className="neopay-stream-detail">
                        {totalDisplay} {assetSymbol}
                      </span>
                      {durationDays !== undefined && (
                        <span className="neopay-stream-detail">
                          {durationDays}d
                        </span>
                      )}
                      {/* The per-day release the creator configured — visible
                          here so the ongoing schedule isn't only on the
                          create form. */}
                      {releasePerDay && (
                        <span className="neopay-stream-detail neopay-stream-detail--rate">
                          {t("releasePerDayValue", {
                            amount: releasePerDay.amount,
                            token: releasePerDay.token,
                          })}
                        </span>
                      )}
                    </div>
                    {stream.notes && (
                      <div className="neopay-stream-note">{stream.notes}</div>
                    )}
                    <div className="neopay-stream-progress-wrap">
                      <div className="neopay-stream-progress">
                        <div
                          className="neopay-stream-progress-bar"
                          style={{
                            width: `${pct}%`,
                            background: getProgressColor(pct),
                          }}
                        />
                      </div>
                      <span className="neopay-stream-progress-label">
                        {streamed} / {totalDisplay}{" "}
                        {assetSymbol} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="neopay-stream-actions">
                    <NeoButton
                      variant="danger"
                      size="sm"
                      loading={activeCancellingId === stream.id}
                      disabled={
                        isFinalizedStatus(stream.status) ||
                        activeCancellingId === stream.id
                      }
                      onClick={() => handleCancel(stream.id)}
                    >
                      {t("cancel")}
                    </NeoButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </NeoCard>

          {/* ==================== Streams You Receive ==================== */}
          <NeoCard
            variant="erobo"
            title={`${t("streamsYouReceive")} (${beneficiaryStreams.length})`}
            className="neopay-card"
          >
        {isListLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading")}</span>
          </div>
        ) : beneficiaryStreams.length === 0 ? (
          <div className="neopay-empty">
            <span className="neopay-empty-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </span>
            <span>{t("noBeneficiaryStreams")}</span>
          </div>
        ) : (
          <div className="neopay-stream-list">
            {beneficiaryStreams.map((stream) => {
              const pct = getStreamProgress(stream);
              const streamed = getStreamed(stream);
              const assetSymbol = getAssetSymbol(stream);
              const totalDisplay = getTotalDisplay(stream);
              const senderAddress = getPrimaryAddress(stream, "from");
              const durationDays = getDurationDays(stream);
              const title = getStreamTitle(stream);
              const claimable = getClaimable(stream);
              return (
                <div key={stream.id} className="neopay-stream-item">
                  <span
                    className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}
                  >
                    {statusLabel(stream)}
                  </span>
                  <div className="neopay-stream-info">
                    <div className="neopay-stream-heading">
                      <span className="neopay-stream-id">#{stream.id}</span>
                      {title && (
                        <span className="neopay-stream-title">{title}</span>
                      )}
                    </div>
                    <div className="neopay-stream-details">
                      {senderAddress && (
                        <span className="neopay-stream-detail">
                          {t("from")}:{" "}
                          {formatAddress(senderAddress)}
                        </span>
                      )}
                      <span className="neopay-stream-detail">
                        {totalDisplay} {assetSymbol}
                      </span>
                      {durationDays !== undefined && (
                        <span className="neopay-stream-detail">
                          {durationDays}d
                        </span>
                      )}
                    </div>
                    {stream.notes && (
                      <div className="neopay-stream-note">{stream.notes}</div>
                    )}
                    <div className="neopay-stream-progress-wrap">
                      <div className="neopay-stream-progress">
                        <div
                          className="neopay-stream-progress-bar"
                          style={{
                            width: `${pct}%`,
                            background: getProgressColor(pct),
                          }}
                        />
                      </div>
                      <span className="neopay-stream-progress-label">
                        {streamed} / {totalDisplay}{" "}
                        {assetSymbol} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    {claimable.positive ? (
                      <div className="neopay-stream-claimable">
                        {t("claimable")}:{" "}
                        <strong>
                          {claimable.display} {assetSymbol}
                        </strong>
                      </div>
                    ) : (
                      !isFinalizedStatus(stream.status) && (
                        <div className="neopay-stream-claimable neopay-stream-claimable--empty">
                          {t("claimNothingYet")}
                        </div>
                      )
                    )}
                  </div>
                  <div className="neopay-stream-actions">
                    {/* Gate Claim on a positive claimable: a claim with nothing
                        vested would revert on-chain after the wallet prompt. */}
                    <NeoButton
                      variant="success"
                      size="sm"
                      loading={activeClaimingId === stream.id}
                      disabled={
                        !canClaim(stream.status, claimable.positive) ||
                        activeClaimingId === stream.id
                      }
                      onClick={() => handleClaim(stream.id)}
                    >
                      {t("claim")}
                    </NeoButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </NeoCard>
        </div>
      ) : (
        <NeoCard
          variant="default"
          title={t("howItWorksTitle")}
          className="neopay-card neopay-howto"
        >
          <ol className="neopay-howto__steps">
            <li>
              <span className="neopay-howto__num">1</span>
              <span className="neopay-howto__copy">{t("howStep1")}</span>
            </li>
            <li>
              <span className="neopay-howto__num">2</span>
              <span className="neopay-howto__copy">{t("howStep2")}</span>
            </li>
            <li>
              <span className="neopay-howto__num">3</span>
              <span className="neopay-howto__copy">{t("howStep3")}</span>
            </li>
          </ol>
          <p className="neopay-howto__foot">{t("howFootnote")}</p>
        </NeoCard>
      )}
    </div>
  );
}
