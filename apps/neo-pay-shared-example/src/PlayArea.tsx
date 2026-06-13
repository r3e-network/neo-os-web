import { useEffect, useMemo, useState } from "react";
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoSelect,
} from "@shared/components-react";
import type { Observable } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { deriveSchedule } from "../../neo-pay/src/composables/deriveSchedule";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

type StreamToken = "GAS" | "NEO";

type SharedStream = {
  id?: string | number;
  creator?: string;
  sender?: string;
  beneficiary?: string;
  recipient?: string;
  title?: string;
  name?: string;
  notes?: string;
  status?: string;
  token?: string;
  assetSymbol?: string;
  amount?: number;
  remaining?: number;
  duration?: number;
  intervalDays?: number;
  totalAmount?: bigint | number | string;
  releasedAmount?: bigint | number | string;
  remainingAmount?: bigint | number | string;
  claimable?: bigint | number | string;
  rateAmount?: bigint | number | string;
};

type LaunchDefaults = {
  recipient: string;
  amount: string;
  duration: string;
  token: StreamToken;
  title: string;
  notes: string;
};

type StreamPreset = {
  id: string;
  label: string;
  values: {
    title: string;
    amount: string;
    duration: string;
    token: StreamToken;
    notes: string;
  };
};

const STREAM_PRESETS: StreamPreset[] = [
  {
    id: "7d-gas",
    label: "7d GAS",
    values: {
      title: "Weekly contributor stream",
      amount: "0.7",
      duration: "7",
      token: "GAS",
      notes: "Contributor weekly release",
    },
  },
  {
    id: "30d-gas",
    label: "30d GAS",
    values: {
      title: "Monthly payroll stream",
      amount: "20",
      duration: "30",
      token: "GAS",
      notes: "Monthly payroll release",
    },
  },
  {
    // NEO is supported by the standalone MiniAppNeoPay contract: it takes
    // indivisible integer NEO deposits and streams them directly. 90 NEO over
    // 90 days = exactly 1 NEO/day, so the per-interval integer rate is valid.
    id: "90d-neo",
    label: "90d NEO",
    values: {
      title: "Quarterly NEO vesting stream",
      amount: "90",
      duration: "90",
      token: "NEO",
      notes: "Quarterly NEO vesting release",
    },
  },
];

const FIXED8_SCALE = 100000000n;
const BASE58_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{25,40}$/u;

function text(
  t: PlayAreaProps["t"],
  key: string,
  fallback: string,
): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function normalizeToken(input: string): StreamToken {
  return input.trim().toUpperCase() === "NEO" ? "NEO" : "GAS";
}

function launchValue(
  launchContext: MiniAppLaunchContext,
  keys: string[],
): string {
  for (const key of keys) {
    const value = String(launchContext.params?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDays(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDisplayNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(value);
}

function formatAtomic(value: bigint, asset: string): string {
  if (asset === "NEO") return value.toString();

  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / FIXED8_SCALE;
  const fraction = absolute % FIXED8_SCALE;
  if (fraction === 0n) return `${sign}${whole.toString()}`;

  const fractionText = fraction.toString().padStart(8, "0").replace(/0+$/u, "");
  return `${sign}${whole.toString()}.${fractionText}`;
}

function amountText(
  value: bigint | number | string | undefined,
  asset: string,
): string {
  if (typeof value === "bigint") return formatAtomic(value, asset);
  if (typeof value === "number") return formatDisplayNumber(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "0";
}

function asBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^\d+$/u.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function shortAddress(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function streamAsset(stream: SharedStream, fallback: StreamToken): string {
  return stream.assetSymbol || stream.token || fallback;
}

function streamTitle(stream: SharedStream): string {
  return String(stream.title || stream.name || "").trim();
}

function streamCounterparty(
  stream: SharedStream,
  direction: "incoming" | "outgoing",
): string {
  const value =
    direction === "incoming"
      ? stream.creator || stream.sender
      : stream.beneficiary || stream.recipient;
  return String(value || "");
}

function streamProgress(stream: SharedStream): number {
  const total = asBigInt(stream.totalAmount);
  if (total && total > 0n) {
    const released =
      asBigInt(stream.releasedAmount) ??
      (asBigInt(stream.remainingAmount) !== null
        ? total - (asBigInt(stream.remainingAmount) ?? 0n)
        : 0n);
    return clampPercent(Number((released * 10000n) / total) / 100);
  }

  if (typeof stream.amount === "number" && stream.amount > 0) {
    if (typeof stream.remaining === "number") {
      return clampPercent(
        ((stream.amount - stream.remaining) / stream.amount) * 100,
      );
    }
  }

  return 0;
}

function releasedText(stream: SharedStream, asset: string): string {
  const released = asBigInt(stream.releasedAmount);
  if (released !== null) return amountText(released, asset);

  const total = asBigInt(stream.totalAmount);
  const remaining = asBigInt(stream.remainingAmount);
  if (total !== null && remaining !== null) {
    return amountText(total - remaining, asset);
  }

  if (
    typeof stream.amount === "number" &&
    typeof stream.remaining === "number"
  ) {
    return formatDisplayNumber(Math.max(stream.amount - stream.remaining, 0));
  }

  return "0";
}

function claimableInfo(stream: SharedStream, asset: string) {
  const claimable = asBigInt(stream.claimable);
  if (claimable !== null) {
    return {
      positive: claimable > 0n,
      display: `${amountText(claimable, asset)} ${asset}`,
    };
  }

  return { positive: false, display: `0 ${asset}` };
}

function isFinal(stream: SharedStream): boolean {
  const status = String(stream.status || "").toLowerCase();
  return status === "cancelled" || status === "completed";
}

/**
 * Per-day release for a created stream, derived from the on-chain rateAmount
 * (base units) over its intervalDays, so the ongoing release rate the creator
 * configured is visible on the card (not only in the create-form preview).
 * Returns null when there is no meaningful per-day figure (no rate, or a
 * sub-1-NEO/day cliff where a fractional NEO/day would mislead).
 */
function releasePerDayText(stream: SharedStream, asset: string): string | null {
  const rate = asBigInt(stream.rateAmount);
  if (rate === null || rate <= 0n) return null;
  const days =
    typeof stream.intervalDays === "number" && stream.intervalDays > 0
      ? stream.intervalDays
      : 1;
  if (asset === "NEO") {
    const perDay = days === 1 ? rate : rate / BigInt(days);
    if (perDay < 1n) return null;
    return perDay.toString();
  }
  // GAS rateAmount is in 1e8 base units.
  const perDay = Number(rate) / Number(FIXED8_SCALE) / days;
  if (!(perDay > 0)) return null;
  return formatDisplayNumber(perDay);
}

function statusClass(status: string): string {
  return status.trim().toLowerCase().replace(/[^a-z0-9-]/gu, "-") || "active";
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const claimingId = str("claimingId");
  const cancellingId = str("cancellingId");
  const serviceNotice = str("serviceNotice");
  const activeCount = num("activeCount");
  const createdStreamCount = num("createdStreamCount");
  const beneficiaryStreamCount = num("beneficiaryStreamCount");
  const totalStreamCount = num("totalStreamCount");
  const createdStreams = (val("createdStreams") ?? []) as SharedStream[];
  const beneficiaryStreams = (val("beneficiaryStreams") ?? []) as SharedStream[];

  const copy = (key: string, fallback: string) => text(t, key, fallback);

  const launchDefaults = useMemo<LaunchDefaults>(() => {
    const recipient = launchValue(launchContext, [
      "recipient",
      "to",
      "beneficiary",
    ]);
    const amount = launchValue(launchContext, [
      "amount",
      "total",
      "totalAmount",
    ]);
    const duration =
      launchValue(launchContext, ["duration", "durationDays", "days"]) ||
      (recipient && amount ? "7" : "");
    const title =
      launchValue(launchContext, ["title", "streamName", "name"]) ||
      (recipient ? "Shared runtime stream" : "");
    const notes = launchValue(launchContext, ["notes", "note", "memo"]);
    const token = normalizeToken(launchValue(launchContext, ["token", "asset"]));
    return { recipient, amount, duration, title, notes, token };
  }, [launchContext.signature]);

  const [recipient, setRecipient] = useState(launchDefaults.recipient);
  const [amount, setAmount] = useState(launchDefaults.amount);
  const [duration, setDuration] = useState(launchDefaults.duration);
  const [title, setTitle] = useState(launchDefaults.title);
  const [notes, setNotes] = useState(launchDefaults.notes);
  const [token, setToken] = useState<StreamToken>(launchDefaults.token);
  const [amountTouched, setAmountTouched] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);

  useEffect(() => {
    setRecipient(launchDefaults.recipient);
    setAmount(launchDefaults.amount);
    setDuration(launchDefaults.duration);
    setTitle(launchDefaults.title);
    setNotes(launchDefaults.notes);
    setToken(launchDefaults.token);
    setAmountTouched(Boolean(launchDefaults.amount));
    setDurationTouched(Boolean(launchDefaults.duration));
  }, [launchDefaults]);

  const amountValue = parseAmount(amount);
  const durationValue = parseDays(duration);
  const recipientReady =
    recipient.trim().length === 0 || BASE58_ADDRESS_PATTERN.test(recipient.trim());
  const amountReady = amountValue > 0;
  const durationReady = durationValue >= 1 && durationValue <= 365;

  // Derive the EXACT schedule the dispatch will send (same canonical helper as
  // main.tsx) so the preview's rate/interval equal what gets submitted
  // on-chain, and the form can block submit when the rounded per-interval rate
  // would be zero (e.g. a GAS amount whose per-day value is < 1e-8).
  const schedule = useMemo(
    () => deriveSchedule(amount.trim(), String(durationValue), token),
    [amount, durationValue, token],
  );
  const derivedRate = amountReady && durationReady ? parseAmount(schedule.rate) : 0;
  const derivedIntervalDays = amountReady && durationReady
    ? Math.max(parseDays(schedule.intervalDays), 1)
    : durationValue;
  const rateRoundsToZero =
    amountReady && durationReady && derivedRate <= 0;

  const canSubmit =
    recipient.trim().length > 0 &&
    recipientReady &&
    amountReady &&
    durationReady &&
    !rateRoundsToZero &&
    !isCreating;
  // The interval shown matches the derived schedule: GAS streams release daily
  // (intervalDays = 1); a collapsed sub-1-NEO/day stream releases once over the
  // full span. Showing the true interval keeps the rate and interval consistent.
  const scheduleLabel = amountReady && durationReady
    ? `${derivedIntervalDays} ${copy("days", "days")}`
    : durationReady
      ? `${durationValue} ${copy("days", "days")}`
      : copy("durationPlaceholder", "Number of days");
  const totalLabel = amountReady
    ? `${formatDisplayNumber(amountValue)} ${token}`
    : `0 ${token}`;
  const releaseLabel = derivedRate > 0
    ? `${formatDisplayNumber(derivedRate)} ${token}`
    : `0 ${token}`;
  // Daily-release streams (GAS, or NEO >= 1/day) read more clearly as a
  // per-day rate; a collapsed single-interval NEO stream keeps the neutral
  // "per interval" label since it releases once.
  const releaseRateLabel = derivedIntervalDays === 1
    ? copy("releasePerDay", "Release per day")
    : copy("rateAmount", "Release per interval");
  const recipientLabel = recipient.trim()
    ? shortAddress(recipient.trim())
    : copy("recipientPlaceholder", "N3 address...");
  const buttonLabel = canSubmit
    ? copy("createStream", "Create Stream")
    : copy("reviewStream", "Complete stream details");
  const hasStreams =
    createdStreams.length > 0 ||
    beneficiaryStreams.length > 0 ||
    totalStreamCount > 0 ||
    activeCount > 0;
  const activePresetId =
    STREAM_PRESETS.find(
      (preset) =>
        preset.values.amount === amount.trim() &&
        preset.values.duration === duration.trim() &&
        preset.values.token === token,
    )?.id ?? "";

  async function createStream() {
    if (!canSubmit) return;
    await dispatch("createStream", {
      recipient: recipient.trim(),
      amount: amount.trim(),
      duration: String(durationValue),
      token,
      title: title.trim(),
      notes: notes.trim(),
    });
  }

  async function cancelStream(stream: SharedStream) {
    await dispatch("cancelStream", String(stream.id ?? ""));
  }

  async function claimStream(stream: SharedStream) {
    await dispatch("claimStream", String(stream.id ?? ""));
  }

  function applyPreset(next: Partial<LaunchDefaults>) {
    if (next.title !== undefined) setTitle(next.title);
    if (next.amount !== undefined) {
      setAmount(next.amount);
      setAmountTouched(true);
    }
    if (next.duration !== undefined) {
      setDuration(next.duration);
      setDurationTouched(true);
    }
    if (next.notes !== undefined) setNotes(next.notes);
    if (next.token !== undefined) setToken(next.token);
  }

  function clearDraft() {
    setRecipient("");
    setAmount("");
    setDuration("");
    setTitle("");
    setNotes("");
    setToken("GAS");
    setAmountTouched(false);
    setDurationTouched(false);
  }

  function renderStreamList(
    streams: SharedStream[],
    direction: "incoming" | "outgoing",
  ) {
    if (isLoading) {
      return (
        <div className="shared-pay-empty" role="status">
          {copy("loading", "Loading streams")}
        </div>
      );
    }

    if (streams.length === 0) {
      return (
        <div className="shared-pay-empty">
          {direction === "incoming"
            ? copy("noBeneficiaryStreams", "No incoming streams")
            : copy("noCreatedStreams", "No outgoing streams")}
        </div>
      );
    }

    return (
      <div className="shared-pay-stream-list">
        {streams.map((stream, index) => {
          const asset = streamAsset(stream, token);
          const total = amountText(stream.totalAmount ?? stream.amount, asset);
          const released = releasedText(stream, asset);
          const progress = streamProgress(stream);
          const status = String(stream.status || copy("active", "Active"));
          const counterparty = streamCounterparty(stream, direction);
          const claimable = claimableInfo(stream, asset);
          // Only the creator (outgoing) cards surface the per-day release the
          // creator committed to; the beneficiary side shows Claimable instead.
          const perDay =
            direction === "outgoing" ? releasePerDayText(stream, asset) : null;
          const label =
            streamTitle(stream) || `${copy("streamSingular", "Stream")} #${stream.id ?? index + 1}`;

          return (
            <article
              className="shared-pay-stream"
              key={`${stream.id ?? index}-${direction}`}
            >
              <div className="shared-pay-stream__main">
                <div className="shared-pay-stream__header">
                  <span className="shared-pay-stream__title">{label}</span>
                  <span
                    className={`shared-pay-status shared-pay-status--${statusClass(status)}`}
                  >
                    {status}
                  </span>
                </div>
                <div className="shared-pay-stream__meta">
                  {counterparty && (
                    <span>
                      {direction === "incoming"
                        ? copy("from", "From")
                        : copy("to", "To")}
                      : {shortAddress(counterparty)}
                    </span>
                  )}
                  <span>{total} {asset}</span>
                  {(stream.duration || stream.intervalDays) && (
                    <span>{stream.duration || stream.intervalDays}d</span>
                  )}
                  {perDay && (
                    <span className="shared-pay-stream__rate">
                      {copy("releasePerDayValue", `${perDay} ${asset} / day`)
                        .replace("{amount}", perDay)
                        .replace("{token}", asset)}
                    </span>
                  )}
                </div>
                {stream.notes && (
                  <p className="shared-pay-stream__note">{stream.notes}</p>
                )}
                <div className="shared-pay-progress" aria-label="Stream release progress">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="shared-pay-stream__progress-copy">
                  {released} / {total} {asset} ({progress.toFixed(0)}%)
                </div>
                {direction === "incoming" && claimable.positive && (
                  <div className="shared-pay-claimable">
                    {copy("claimable", "Claimable")}: <strong>{claimable.display}</strong>
                  </div>
                )}
              </div>
              <div className="shared-pay-stream__actions">
                {direction === "incoming" ? (
                  <NeoButton
                    size="sm"
                    variant="success"
                    loading={claimingId === String(stream.id ?? "")}
                    disabled={isFinal(stream) || claimingId === String(stream.id ?? "")}
                    onClick={() => claimStream(stream)}
                  >
                    {copy("claim", "Claim")}
                  </NeoButton>
                ) : (
                  <NeoButton
                    size="sm"
                    variant="danger"
                    loading={cancellingId === String(stream.id ?? "")}
                    disabled={isFinal(stream) || cancellingId === String(stream.id ?? "")}
                    onClick={() => cancelStream(stream)}
                  >
                    {copy("cancel", "Cancel")}
                  </NeoButton>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="shared-pay-play-area">
      <section className="shared-pay-hero" aria-labelledby="shared-pay-title">
        <div className="shared-pay-hero__top">
          <span className="shared-pay-hero__badge" aria-hidden="true">
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
              <path d="M3 12h6l1.5-4 3 8 1.5-4H21" />
            </svg>
          </span>
          <div className="shared-pay-hero__heading">
            <span className="shared-pay-eyebrow">
              {copy("sharedRuntime", "Shared runtime")}
            </span>
            <h2 id="shared-pay-title">
              {copy("sharedRuntimeTitle", "NeoPay shared streams")}
            </h2>
          </div>
        </div>
        <p>
          {copy(
            "sharedRuntimeSubtitle",
            "Create a funded payment stream through the shared vault and vesting modules.",
          )}
        </p>
        {hasStreams && (
          <div className="shared-pay-hero__stats" aria-label="Stream totals">
            <span>
              <strong>{totalStreamCount}</strong>
              {copy("totalStreams", "Total Streams")}
            </span>
            <span>
              <strong>{activeCount}</strong>
              {copy("active", "Active")}
            </span>
            <span>
              <strong>{createdStreamCount}</strong>
              {copy("createdByYou", "Created by You")}
            </span>
            <span>
              <strong>{beneficiaryStreamCount}</strong>
              {copy("youAreBeneficiary", "You're Beneficiary")}
            </span>
          </div>
        )}
      </section>

      {serviceNotice && (
        <div className="shared-pay-notice" role="status">
          <strong>{copy("streamListUnavailableTitle", "Stream index unavailable")}</strong>
          <span>{serviceNotice}</span>
        </div>
      )}

      <div className="shared-pay-primary">
        <NeoCard
          variant="erobo"
          title={copy("createStream", "Create Stream")}
          className="shared-pay-card shared-pay-card--form"
        >
          <div className="shared-pay-form">
            <NeoInput
              label={copy("vaultName", "Stream name")}
              placeholder={copy("vaultNamePlaceholder", "Monthly payroll stream")}
              value={title}
              onChange={setTitle}
            />
            <NeoInput
              label={copy("recipient", "Recipient Address")}
              placeholder={copy("recipientPlaceholder", "N3 address...")}
              value={recipient}
              error={
                recipientReady
                  ? ""
                  : copy("invalidAddress", "Enter a valid Neo N3 address")
              }
              required
              onChange={setRecipient}
            />
            <NeoInput
              label={copy("amount", "Amount")}
              placeholder="0.00"
              suffix={token}
              type="number"
              min={0}
              value={amount}
              error={
                !amountTouched || amountReady
                  ? ""
                  : copy("invalidAmount", "Enter an amount")
              }
              required
              onChange={(value) => {
                setAmount(value);
                setAmountTouched(true);
              }}
            />
            <NeoInput
              label={copy("duration", "Duration")}
              placeholder={copy("durationPlaceholder", "Number of days")}
              suffix={copy("days", "days")}
              type="number"
              min={1}
              max={365}
              value={duration}
              error={
                !durationTouched || durationReady
                  ? ""
                  : copy("intervalInvalid", "Use 1 to 365 days")
              }
              required
              onChange={(value) => {
                setDuration(value);
                setDurationTouched(true);
              }}
            />
            <NeoSelect
              label={copy("token", "Token")}
              value={token}
              required
              options={[
                { value: "GAS", label: "GAS" },
                { value: "NEO", label: "NEO" },
              ]}
              onChange={(value) => setToken(normalizeToken(value))}
            />
            <NeoInput
              label={copy("notes", "Notes (optional)")}
              placeholder={copy("notesPlaceholder", "Add context for the recipient")}
              value={notes}
              type="textarea"
              onChange={setNotes}
            />
          </div>

          <div className="shared-pay-presets" aria-label="Stream presets">
            {STREAM_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={isActive ? "is-active" : undefined}
                  aria-pressed={isActive}
                  onClick={() => applyPreset(preset.values)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="shared-pay-actions">
            <NeoButton
              variant="primary"
              block
              loading={isCreating}
              disabled={!canSubmit}
              onClick={createStream}
            >
              {buttonLabel}
            </NeoButton>
            <NeoButton variant="secondary" onClick={clearDraft}>
              {copy("clear", "Clear")}
            </NeoButton>
          </div>

          <details className="shared-pay-review" open={canSubmit}>
            <summary>
              <span>{copy("transactionPreview", "Transaction preview")}</span>
              <strong>{totalLabel}</strong>
            </summary>
            <div className="shared-pay-summary">
              <div>
                <span>{copy("recipient", "Recipient Address")}</span>
                <strong>{recipientLabel}</strong>
              </div>
              <div>
                <span>{copy("totalAmount", "Total amount")}</span>
                <strong>{totalLabel}</strong>
              </div>
              <div>
                <span>{releaseRateLabel}</span>
                <strong>{releaseLabel}</strong>
              </div>
              <div>
                <span>{copy("intervalLabel", "Interval")}</span>
                <strong>{scheduleLabel}</strong>
              </div>
            </div>
            {rateRoundsToZero && (
              <p className="shared-pay-review__warning" role="alert">
                {copy(
                  "rateRoundsToZero",
                  "Amount is too small for this duration — increase the amount or shorten the duration.",
                )}
              </p>
            )}
          </details>
        </NeoCard>
      </div>

      {hasStreams && (
        <div className="shared-pay-stream-grid">
          <NeoCard
            variant="default"
            title={`${copy("yourCreatedStreams", "Your Created Streams")} (${createdStreams.length})`}
            className="shared-pay-card"
          >
            {renderStreamList(createdStreams, "outgoing")}
          </NeoCard>
          <NeoCard
            variant="default"
            title={`${copy("streamsYouReceive", "Streams You Receive")} (${beneficiaryStreams.length})`}
            className="shared-pay-card"
          >
            {renderStreamList(beneficiaryStreams, "incoming")}
          </NeoCard>
        </div>
      )}
    </div>
  );
}
