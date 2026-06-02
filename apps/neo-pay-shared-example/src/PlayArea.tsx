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
};

type LaunchDefaults = {
  recipient: string;
  amount: string;
  duration: string;
  token: StreamToken;
  title: string;
  notes: string;
};

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

  useEffect(() => {
    setRecipient(launchDefaults.recipient);
    setAmount(launchDefaults.amount);
    setDuration(launchDefaults.duration);
    setTitle(launchDefaults.title);
    setNotes(launchDefaults.notes);
    setToken(launchDefaults.token);
  }, [launchDefaults]);

  const amountValue = parseAmount(amount);
  const durationValue = parseDays(duration);
  const recipientReady =
    recipient.trim().length === 0 || BASE58_ADDRESS_PATTERN.test(recipient.trim());
  const amountReady = amountValue > 0;
  const durationReady = durationValue >= 1 && durationValue <= 365;
  const canSubmit =
    recipient.trim().length > 0 &&
    recipientReady &&
    amountReady &&
    durationReady &&
    !isCreating;
  const releasePerDay =
    amountReady && durationReady ? amountValue / durationValue : 0;
  const scheduleLabel = durationReady
    ? `${durationValue} ${copy("days", "days")}`
    : copy("durationPlaceholder", "Number of days");
  const totalLabel = amountReady
    ? `${formatDisplayNumber(amountValue)} ${token}`
    : `0 ${token}`;
  const releaseLabel = releasePerDay > 0
    ? `${formatDisplayNumber(releasePerDay)} ${token}`
    : `0 ${token}`;
  const recipientLabel = recipient.trim()
    ? shortAddress(recipient.trim())
    : copy("recipientPlaceholder", "N3 address...");
  const buttonLabel = canSubmit
    ? copy("createStream", "Create Stream")
    : copy("reviewStream", "Complete stream details");

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
    if (next.amount !== undefined) setAmount(next.amount);
    if (next.duration !== undefined) setDuration(next.duration);
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
                    disabled={isFinal(stream)}
                    onClick={() => claimStream(stream)}
                  >
                    {copy("claim", "Claim")}
                  </NeoButton>
                ) : (
                  <NeoButton
                    size="sm"
                    variant="danger"
                    disabled={isFinal(stream)}
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
        <div className="shared-pay-hero__copy">
          <span className="shared-pay-eyebrow">
            {copy("sharedRuntime", "Shared runtime")}
          </span>
          <h2 id="shared-pay-title">
            {copy("sharedRuntimeTitle", "NeoPay shared streams")}
          </h2>
          <p>
            {copy(
              "sharedRuntimeSubtitle",
              "Create a funded payment stream through the shared vault and vesting modules.",
            )}
          </p>
        </div>
        <div className="shared-pay-metrics" aria-label="Stream totals">
          <div>
            <strong>{totalStreamCount}</strong>
            <span>{copy("totalStreams", "Total Streams")}</span>
          </div>
          <div>
            <strong>{activeCount}</strong>
            <span>{copy("active", "Active")}</span>
          </div>
          <div>
            <strong>{createdStreamCount}</strong>
            <span>{copy("createdByYou", "Created by You")}</span>
          </div>
          <div>
            <strong>{beneficiaryStreamCount}</strong>
            <span>{copy("youAreBeneficiary", "You're Beneficiary")}</span>
          </div>
        </div>
      </section>

      {serviceNotice && (
        <div className="shared-pay-notice" role="status">
          <strong>{copy("streamListUnavailableTitle", "Stream index unavailable")}</strong>
          <span>{serviceNotice}</span>
        </div>
      )}

      <div className="shared-pay-grid">
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
              error={amount || amountReady ? "" : copy("invalidAmount", "Enter an amount")}
              required
              onChange={setAmount}
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
                duration || durationReady
                  ? ""
                  : copy("intervalInvalid", "Use 1 to 365 days")
              }
              required
              onChange={setDuration}
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
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  title: "Weekly contributor stream",
                  amount: "0.7",
                  duration: "7",
                  token: "GAS",
                  notes: "Contributor weekly release",
                })
              }
            >
              7d GAS
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  title: "Monthly payroll stream",
                  amount: "20",
                  duration: "30",
                  token: "GAS",
                  notes: "Monthly payroll release",
                })
              }
            >
              30d GAS
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  title: "Governance vesting stream",
                  amount: "1",
                  duration: "90",
                  token: "NEO",
                  notes: "Governance vesting release",
                })
              }
            >
              90d NEO
            </button>
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
        </NeoCard>

        <NeoCard
          variant="default"
          title={copy("transactionPreview", "Transaction preview")}
          className="shared-pay-card shared-pay-card--preview"
        >
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
              <span>{copy("rateAmount", "Release per interval")}</span>
              <strong>{releaseLabel}</strong>
            </div>
            <div>
              <span>{copy("intervalLabel", "Interval")}</span>
              <strong>{scheduleLabel}</strong>
            </div>
          </div>

          <div className="shared-pay-route" aria-label="Shared runtime route">
            <div>
              <span>1</span>
              <strong>funding_vault</strong>
              <small>0x958b...1537</small>
            </div>
            <div>
              <span>2</span>
              <strong>stream_vesting</strong>
              <small>0x4fa6...33cf</small>
            </div>
            <div>
              <span>3</span>
              <strong>{copy("createStream", "Create Stream")}</strong>
              <small>neo-n3-testnet</small>
            </div>
          </div>

          <div
            className={`shared-pay-readiness ${
              canSubmit ? "shared-pay-readiness--ready" : ""
            }`}
          >
            {canSubmit
              ? copy("readyForWallet", "Ready for wallet signing")
              : copy("missingStreamFields", "Complete stream details")}
          </div>
        </NeoCard>
      </div>

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
    </div>
  );
}
