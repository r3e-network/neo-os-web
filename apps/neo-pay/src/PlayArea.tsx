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
import type { StreamItem } from "./types";
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

  useEffect(() => {
    if (launchRecipient) setRecipient(launchRecipient);
    if (launchAmount) setAmount(launchAmount);
    if (launchDuration) setDuration(launchDuration);
    if (launchToken) setToken(launchToken);
    if (launchNotes) setNotes(launchNotes);
  }, [launchAmount, launchDuration, launchNotes, launchRecipient, launchToken]);

  /* ---------- Handlers ---------- */
  const handleCreateStream = async () => {
    if (!recipient || !amount || !duration) return;
    await dispatch("createStream", { recipient, amount, duration, token, notes });
    setRecipient("");
    setAmount("");
    setDuration("");
    setToken("GAS");
    setNotes("");
  };

  const handleCancel = async (id: string) => {
    await dispatch("cancelStream", id);
  };

  const handleClaim = async (id: string) => {
    await dispatch("claimStream", id);
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

  return (
    <div className="neopay-play-area">
      {/* ==================== Hero ==================== */}
      <div className="neopay-hero">
        <div className="neopay-hero-top">
          <div className="neopay-hero-badge" aria-hidden="true">
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
          </div>
          <div className="neopay-hero-text">
            <span className="neopay-hero-eyebrow">
              {t("ariaStreams")}
            </span>
            <h2 className="neopay-hero-title">{t("title")}</h2>
            <p className="neopay-hero-subtitle">
              {t("docSubtitle")}
            </p>
          </div>
        </div>

        {/* Boxed stat tiles stay present at first run; zeroes plus a plain
            caption read as an empty wallet state instead of a broken feed. */}
        <div className="neopay-hero-summary" role="group" aria-label={t("ariaStreams")}>
          <div className="neopay-hero-stat">
            <span className={`neopay-hero-stat-value${hasStreamActivity ? "" : " neopay-hero-stat-value--empty"}`}>
              {totalStreamCount}
            </span>
            <span className="neopay-hero-stat-label">{t("totalStreams")}</span>
          </div>
          <span className="neopay-hero-stat-divider" aria-hidden="true" />
          <div className="neopay-hero-stat">
            <span className={`neopay-hero-stat-value${hasStreamActivity ? "" : " neopay-hero-stat-value--empty"}`}>
              {activeCount}
            </span>
            <span className="neopay-hero-stat-label">{t("active")}</span>
          </div>
        </div>
        {!hasStreamActivity && (
          <p className="neopay-hero-empty-note">{t("awaitingActivity")}</p>
        )}
      </div>

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
        title={t("createStream")}
      >
        <div className="neopay-form">
          <NeoInput
            label={t("recipient")}
            placeholder={
              t("recipientPlaceholder")
            }
            value={recipient}
            onChange={setRecipient}
          />
          <NeoInput
            label={t("amount")}
            placeholder="0.00"
            type="number"
            value={amount}
            suffix={token}
            onChange={setAmount}
          />
          <NeoInput
            label={t("duration")}
            placeholder={t("durationPlaceholder")}
            type="number"
            value={duration}
            suffix={t("days")}
            onChange={setDuration}
          />
          <NeoInput
            label={t("notes")}
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={setNotes}
          />

          {/* Token Selector */}
          <div className="neopay-token-selector">
            <span className="neopay-token-label">
              {t("token")}
            </span>
            <div className="neopay-token-options">
              {tokenOptions.map((tk) => (
                <button
                  key={tk}
                  className={`neopay-token-option ${token === tk ? "neopay-token-option--active" : ""}`}
                  onClick={() => setToken(tk)}
                  type="button"
                >
                  {tk}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule disclosure: per-day release for the linear case, an
              explicit cliff warning when a sub-1-NEO/day total collapses to a
              single end-of-term release. */}
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
            <p className="neopay-form-disclosure neopay-form-disclosure--warn" role="note">
              {t("neoCliffNotice", {
                amount: schedulePreview.amount,
                days: schedulePreview.days,
              })}
            </p>
          )}

          {/* Two-signature disclosure: the standalone contract takes a deposit
              first, then the createStream call — two wallet prompts. */}
          <p className="neopay-form-disclosure" role="note">
            {t("twoStepSignNotice", { token })}
          </p>

          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!recipient || !amount || !duration || isCreating}
            onClick={handleCreateStream}
          >
            {t("createStream")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* ==================== Your Created Streams ==================== */}
      <NeoCard
        variant="erobo"
        title={`${t("yourCreatedStreams")} (${createdStreams.length})`}
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
                      loading={cancellingId === stream.id}
                      disabled={isFinalizedStatus(stream.status) || cancellingId === stream.id}
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
                      loading={claimingId === stream.id}
                      disabled={
                        !canClaim(stream.status, claimable.positive) ||
                        claimingId === stream.id
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
  );
}
