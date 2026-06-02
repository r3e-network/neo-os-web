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
  const isCreating = bool("isCreating");
  const activeCount = num("activeCount");
  const createdStreamCount = num("createdStreamCount");
  const beneficiaryStreamCount = num("beneficiaryStreamCount");
  const totalStreamCount = num("totalStreamCount");
  const serviceNotice = str("serviceNotice");

  const createdStreams = (val("createdStreams") ?? []) as Stream[];
  const beneficiaryStreams = (val("beneficiaryStreams") ?? []) as Stream[];
  const allStreams = (val("allStreams") ?? []) as Stream[];

  /* ---------- Local form state ---------- */
  const launchDefaults = useMemo(() => {
    const recipient = getLaunchValue(launchContext, [
      "recipient",
      "to",
      "beneficiary",
    ]);
    const amount = getLaunchValue(launchContext, ["amount", "total"]);
    const duration =
      getLaunchValue(launchContext, ["duration", "durationDays", "days"]) ||
      (recipient && amount ? "1" : "");
    const token =
      normalizeToken(getLaunchValue(launchContext, ["token", "asset"]));
    const notes = getLaunchValue(launchContext, ["notes", "note", "memo"]);
    return { recipient, amount, duration, token, notes };
  }, [launchContext.signature]);

  const [recipient, setRecipient] = useState(launchDefaults.recipient);
  const [amount, setAmount] = useState(launchDefaults.amount);
  const [duration, setDuration] = useState(launchDefaults.duration);
  const [token, setToken] = useState(launchDefaults.token);
  const [notes, setNotes] = useState(launchDefaults.notes);

  useEffect(() => {
    if (launchDefaults.recipient) setRecipient(launchDefaults.recipient);
    if (launchDefaults.amount) setAmount(launchDefaults.amount);
    if (launchDefaults.duration) setDuration(launchDefaults.duration);
    if (launchDefaults.token) setToken(launchDefaults.token);
    if (launchDefaults.notes) setNotes(launchDefaults.notes);
  }, [launchDefaults]);

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

  const isFinalized = (stream: Stream): boolean =>
    stream.status === "cancelled" || stream.status === "completed";

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
              {t("ariaStreams") || "Streams"}
            </span>
            <h2 className="neopay-hero-title">{t("title") || "NeoPay"}</h2>
            <p className="neopay-hero-subtitle">
              {t("docSubtitle") ||
                "Scheduled releases for payrolls, subscriptions, and allowances"}
            </p>
          </div>
        </div>

        <div className="neopay-hero-stats">
          <div className="neopay-hero-stat">
            <span className="neopay-hero-stat-value">{totalStreamCount}</span>
            <span className="neopay-hero-stat-label">
              {t("totalStreams") || "Total Streams"}
            </span>
          </div>
          <div className="neopay-hero-stat">
            <span className="neopay-hero-stat-value">{activeCount}</span>
            <span className="neopay-hero-stat-label">
              {t("active") || "Active"}
            </span>
          </div>
          <div className="neopay-hero-stat">
            <span className="neopay-hero-stat-value">{createdStreamCount}</span>
            <span className="neopay-hero-stat-label">
              {t("createdByYou") || "Created by You"}
            </span>
          </div>
          <div className="neopay-hero-stat">
            <span className="neopay-hero-stat-value">
              {beneficiaryStreamCount}
            </span>
            <span className="neopay-hero-stat-label">
              {t("youAreBeneficiary") || "You're Beneficiary"}
            </span>
          </div>
        </div>
      </div>

      {serviceNotice && (
        <div className="neopay-service-notice" role="status">
          <span className="neopay-service-notice__title">
            {t("streamListUnavailableTitle") || "Stream index unavailable"}
          </span>
          <span>{serviceNotice}</span>
        </div>
      )}

      {/* ==================== Create Stream Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("createStream") || "Create Stream"}
      >
        <div className="neopay-form">
          <NeoInput
            label={t("recipient") || "Recipient Address"}
            placeholder={
              t("recipientPlaceholder") || "N3 address..."
            }
            value={recipient}
            onChange={setRecipient}
          />
          <NeoInput
            label={t("amount") || "Amount"}
            placeholder="0.00"
            type="number"
            value={amount}
            suffix={token}
            onChange={setAmount}
          />
          <NeoInput
            label={t("duration") || "Duration"}
            placeholder={t("durationPlaceholder") || "Number of days"}
            type="number"
            value={duration}
            suffix={t("days") || "days"}
            onChange={setDuration}
          />
          <NeoInput
            label={t("notes") || "Notes (optional)"}
            placeholder={t("notesPlaceholder") || "Add context for the recipient"}
            value={notes}
            onChange={setNotes}
          />

          {/* Token Selector */}
          <div className="neopay-token-selector">
            <span className="neopay-token-label">
              {t("token") || "Token"}
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

          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!recipient || !amount || !duration || isCreating}
            onClick={handleCreateStream}
          >
            {t("createStream") || "Create Stream"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* ==================== Your Created Streams ==================== */}
      <NeoCard
        variant="erobo"
        title={`${t("yourCreatedStreams") || "Your Created Streams"} (${createdStreams.length})`}
      >
        {isLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading") || "Loading..."}</span>
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
              {t("noCreatedStreams") || "You haven't created any streams yet"}
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
              return (
                <div key={stream.id} className="neopay-stream-item">
                  <span
                    className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}
                  >
                    {stream.status ?? (t("active") || "Active")}
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
                          {t("to") || "To"}:{" "}
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
                      disabled={isFinalized(stream)}
                      onClick={() => handleCancel(stream.id)}
                    >
                      {t("cancel") || "Cancel"}
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
        title={`${t("streamsYouReceive") || "Streams You Receive"} (${beneficiaryStreams.length})`}
      >
        {isLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading") || "Loading..."}</span>
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
            <span>{t("noBeneficiaryStreams") || "No incoming streams"}</span>
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
                    {stream.status ?? (t("active") || "Active")}
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
                          {t("from") || "From"}:{" "}
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
                    {claimable.positive && (
                      <div className="neopay-stream-claimable">
                        {t("claimable") || "Claimable"}:{" "}
                        <strong>
                          {claimable.display} {assetSymbol}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="neopay-stream-actions">
                    <NeoButton
                      variant="success"
                      size="sm"
                      disabled={isFinalized(stream)}
                      onClick={() => handleClaim(stream.id)}
                    >
                      {t("claim") || "Claim"}
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
