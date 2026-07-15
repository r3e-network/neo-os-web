/**
 * NeoPay Stream Studio — a resource-led payment stream workstation.
 *
 * The bright NeoPay vault artwork and its live payment ticket own the primary
 * stage. Stream history, claim/cancel controls, exact chain parameters, and
 * guidance remain in the secondary drawer instead of becoming a form wall.
 */
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  HandCoins,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  canClaim,
  deriveSchedulePreview,
  isFinalizedStatus,
  statusLabelKey,
  type StreamItem,
} from "@shared/composables/neo-pay";
import {
  normalizeStudioNetwork,
  validateStreamDraft,
  type StudioAsset,
  type StudioServiceState,
} from "./stream-studio";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DrawerMode = "outgoing" | "incoming" | "ticket" | "guide";

const AMOUNT_PRESETS = ["10", "50", "100"];
const DURATION_PRESETS = [7, 30, 90];
const STREAM_DESK_ART = "payment-stream-desk.webp";
const GAS_FACTOR = 100_000_000n;

function TokenMark({ asset, size = 26 }: { asset: StudioAsset; size?: number }) {
  return (
    <CoinArt
      className="stream-studio__token-mark"
      variant={asset === "NEO" ? "neo" : "gas"}
      size={size}
      decorative
    />
  );
}

function compact(value: string | undefined, empty = "—"): string {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  if (text.length <= 17) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function formatBaseUnits(value: bigint | undefined, asset: StudioAsset): string {
  if (typeof value !== "bigint") return "—";
  if (asset === "NEO") return value.toString();
  const whole = value / GAS_FACTOR;
  const fraction = (value % GAS_FACTOR).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}

function formatStreamAmount(value: bigint | undefined, asset: StudioAsset): string {
  const amount = formatBaseUnits(value, asset);
  return amount === "—" ? amount : `${amount} ${asset}`;
}

function serviceLabelKey(value: StudioServiceState): string {
  switch (value) {
    case "live": return "serviceLive";
    case "partial": return "servicePartial";
    case "pending": return "servicePending";
    case "loading": return "serviceLoading";
    case "unavailable": return "serviceUnavailable";
    default: return "serviceDisconnected";
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const isCreating = bool("isCreating");
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const serviceNotice = str("serviceNotice");
  const pendingCreateTxid = str("pendingCreateTxid");
  const claimingId = str("claimingId");
  const cancellingId = str("cancellingId");
  const networkValue = str("network");
  const contractHash = str("contractHash");
  const chainBindingState = str("chainBindingState");
  const serviceState = (str("serviceState") || "disconnected") as StudioServiceState;
  const createdStreams = val<StreamItem[]>("createdStreams", []) ?? [];
  const beneficiaryStreams = val<StreamItem[]>("beneficiaryStreams", []) ?? [];

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");
  const [asset, setAsset] = useState<StudioAsset>("GAS");
  const [notes, setNotes] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("outgoing");
  const [cancelConfirmId, setCancelConfirmId] = useState("");

  const validation = useMemo(
    () => validateStreamDraft({ recipient, amount, duration, asset }),
    [recipient, amount, duration, asset],
  );
  const schedule = useMemo(
    () => validation.amountValid && validation.durationValid
      ? deriveSchedulePreview(amount.trim(), duration.trim(), asset)
      : null,
    [amount, asset, duration, validation.amountValid, validation.durationValid],
  );
  const releaseLabel = schedule
    ? schedule.kind === "cliff"
      ? t("releaseCliff", { amount: schedule.amount, token: asset, days: schedule.days })
      : t("releaseLinear", { amount: schedule.amount, token: asset })
    : t("releaseWaiting");
  const network = normalizeStudioNetwork(networkValue);
  // No network yet is "we have not been told", not "the network is down".
  const awaitingContext = chainBindingState === "awaiting-context";
  const networkLabel = network === "mainnet"
    ? t("networkMainnet")
    : network === "testnet"
      ? t("networkTestnet")
      : awaitingContext
        ? t("networkAwaiting")
        : t("networkUnknown");
  const actionBusy = isCreating || isLoading || isRefreshing;
  const pending = Boolean(pendingCreateTxid);
  const chainReady = chainBindingState === "verified";
  const readyToCreate = validation.valid && chainReady && !pending;
  const ticketStatus = pending
    ? t("ticketPending")
    : readyToCreate
      ? t("ticketReady")
      : t("ticketDraft");
  const countsAreAuthoritative = serviceState === "live";

  const handlePrimary = () => {
    if (pending) {
      if (!actionBusy) void dispatch("recoverPendingCreate");
      return;
    }
    if (!readyToCreate || actionBusy) return;
    void dispatch("createStream", {
      recipient: recipient.trim(),
      amount: amount.trim(),
      duration: duration.trim(),
      token: asset,
      notes,
    });
  };

  const primaryLabel = pending
    ? actionBusy ? t("checkingPendingStream") : t("checkPendingStream")
    : isCreating ? t("creatingStudioStream") : t("createStudioStream");
  const primaryDisabled = pending
    ? actionBusy
    : actionBusy || !readyToCreate;

  const scene = (
    <div
      className="stream-studio"
      data-state={pending ? "pending" : readyToCreate ? "ready" : "draft"}
      aria-label={t("studioStageAria")}
    >
      {serviceNotice && (
        <OpenUiNotice
          className="stream-studio__notice"
          type={serviceState === "unavailable" ? "error" : pending || serviceState === "partial" ? "warning" : "info"}
          icon={serviceState === "unavailable" ? <Clock3 size={17} /> : <ShieldCheck size={17} />}
          title={t(serviceLabelKey(serviceState))}
        >
          {serviceNotice}
        </OpenUiNotice>
      )}

      <section className="stream-studio__workbench">
        <div className="stream-studio__visual">
          <img
            className="stream-studio__art"
            src={STREAM_DESK_ART}
            alt={t("paymentArtAlt")}
            loading="eager"
            decoding="async"
          />
          <div className="stream-studio__network-ticket">
            <span>{t("liveContract")}</span>
            <strong>{networkLabel}</strong>
            <em data-state={chainReady ? "verified" : awaitingContext ? "awaiting" : "mismatch"}>
              <ShieldCheck size={14} />
              {chainReady
                ? t("bindingVerified")
                : awaitingContext
                  ? t("bindingAwaiting")
                  : t("bindingMismatch")}
            </em>
          </div>
          <div className="stream-studio__receipt" aria-label={t("releasePreview")}>
            <span>{t("paymentTicket")}</span>
            {/* The ticket headline is the first thing the overlay says. With no
                amount yet there is no figure to print and nothing is loading —
                the visitor simply has not typed one — so it asks for the amount
                instead of heading the card with an em-dash. The asset suffix is
                dropped with it: "— GAS" claimed a denomination for a value that
                does not exist. */}
            <strong data-empty={amount.trim() ? undefined : "true"}>
              {amount.trim() ? `${amount.trim()} ${asset}` : t("amountEmptyValue")}
            </strong>
            <div>
              <small>{t("recipientRoute")}</small>
              <b>{compact(recipient, t("recipientEmptyHint"))}</b>
            </div>
            <div>
              <small>{t("releasePlan")}</small>
              <b>{releaseLabel}</b>
            </div>
          </div>
        </div>

        <section className="stream-studio__composer" aria-label={t("paymentTicket")}>
          {/* The service state is already announced once by the PlayStage badge;
              repeating it verbatim here read as a duplicated chip on one screen. */}
          <header className="stream-studio__composer-head">
            <div>
              <span>{t("paymentTicket")}</span>
              <strong>{ticketStatus}</strong>
            </div>
          </header>

          <OpenUiSegmented
            className="stream-studio__asset-field"
            segmentedClassName="stream-studio__asset-options"
            label={t("assetPicker")}
            value={asset}
            onChange={(value) => setAsset(value === "NEO" ? "NEO" : "GAS")}
            options={(["GAS", "NEO"] as StudioAsset[]).map((symbol) => ({
              value: symbol,
              disabled: pending || isCreating,
              label: (
                <span className="stream-studio__asset-option">
                  <TokenMark asset={symbol} size={25} />
                  <span><strong>{symbol}</strong><small>{t("officialAsset")}</small></span>
                </span>
              ),
            }))}
          />

          <div className="stream-studio__amount-zone" data-invalid={amount && !validation.amountValid ? "true" : undefined}>
            <OpenUiTextField
              id="stream-studio-amount"
              className="stream-studio__amount-field"
              inputClassName="stream-studio__amount-input"
              label={t("streamAmount")}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              inputMode="decimal"
              disabled={pending || isCreating}
              aria-invalid={Boolean(amount && !validation.amountValid)}
            />
            <strong className="stream-studio__amount-asset">{asset}</strong>
            <div className="stream-studio__amount-presets" aria-label={t("amountPresets")}>
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={amount === preset ? "is-active" : undefined}
                  onClick={() => setAmount(preset)}
                  disabled={pending || isCreating}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p role={amount && !validation.amountValid ? "alert" : undefined}>
              {amount
                ? validation.amountValid ? t("atomicFundingHint") : t(validation.amountIssue)
                : t("amountEmptyHint")}
            </p>
          </div>

          <div
            className="stream-studio__route-field"
            data-state={!recipient.trim() ? "empty" : validation.recipientValid ? "valid" : "invalid"}
          >
            <OpenUiTextField
              id="stream-studio-recipient"
              className="stream-studio__recipient-field"
              inputClassName="stream-studio__recipient-input"
              label={t("recipientRoute")}
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={t("beneficiaryPlaceholder")}
              disabled={pending || isCreating}
              spellCheck={false}
              mono
              aria-invalid={Boolean(recipient.trim() && !validation.recipientValid)}
            />
            <div className="stream-studio__route-preview" aria-hidden="true">
              <span><HandCoins size={17} /> {asset}</span>
              <ArrowRight size={18} />
              <span><UserRound size={17} /> {compact(recipient, t("routeRecipientPending"))}</span>
            </div>
            <p role={recipient.trim() && !validation.recipientValid ? "alert" : undefined}>
              {!recipient.trim()
                ? t("recipientEmptyHint")
                : validation.recipientValid
                  ? compact(recipient)
                  : t(validation.recipientIssue)}
            </p>
          </div>

          <div className="stream-studio__duration" data-invalid={!validation.durationValid ? "true" : undefined}>
            <div className="stream-studio__duration-head">
              <span><CalendarDays size={16} /> {t("durationDays")}</span>
              <strong>{t("daysValue", { days: duration || "—" })}</strong>
            </div>
            <div className="stream-studio__duration-controls">
              <div className="stream-studio__duration-presets">
                {DURATION_PRESETS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={duration === String(days) ? "is-active" : undefined}
                    onClick={() => setDuration(String(days))}
                    disabled={pending || isCreating}
                  >
                    {t("daysValue", { days })}
                  </button>
                ))}
              </div>
              <OpenUiTextField
                id="stream-studio-duration"
                className="stream-studio__duration-field"
                inputClassName="stream-studio__duration-input"
                label={t("customDays")}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                inputMode="numeric"
                disabled={pending || isCreating}
                aria-invalid={!validation.durationValid}
              />
            </div>
            <p role={!validation.durationValid ? "alert" : undefined}>
              {validation.durationValid ? releaseLabel : t(validation.durationIssue)}
            </p>
          </div>
        </section>
      </section>
    </div>
  );

  const renderStreamList = (role: "outgoing" | "incoming") => {
    const streams = role === "outgoing" ? createdStreams : beneficiaryStreams;
    if (serviceState === "unavailable" || (serviceState === "partial" && streams.length === 0)) {
      return <p className="stream-studio__empty stream-studio__empty--warning">{t("streamDataUnavailable")}</p>;
    }
    if ((serviceState === "disconnected" || serviceState === "loading") && streams.length === 0) {
      return <p className="stream-studio__empty">{t("streamDataWaiting")}</p>;
    }
    if (streams.length === 0) {
      return (
        <p className="stream-studio__empty">
          {role === "outgoing" ? t("noCreatedStudioStreams") : t("noIncomingStudioStreams")}
        </p>
      );
    }
    return (
      <ul className="stream-studio__stream-list">
        {streams.slice(0, 12).map((stream) => {
          const finalized = isFinalizedStatus(stream.status);
          const claimEnabled = role === "incoming" && canClaim(stream.status, stream.claimable > 0n);
          const actionLocked = pending || Boolean(claimingId) || Boolean(cancellingId);
          return (
            <li key={`${role}-${stream.id}`} className="stream-studio__stream-card" data-status={stream.status}>
              <header>
                <span><TokenMark asset={stream.assetSymbol} size={21} /></span>
                <div>
                  <strong>{stream.title?.trim() || t("streamLabel", { id: stream.id })}</strong>
                  <small>{compact(role === "outgoing" ? stream.beneficiary : stream.creator)}</small>
                </div>
                <em>{t(statusLabelKey(stream.status))}</em>
              </header>
              <dl>
                <div><dt>{t("totalLocked")}</dt><dd>{formatStreamAmount(stream.totalAmount, stream.assetSymbol)}</dd></div>
                <div><dt>{t("remaining")}</dt><dd>{formatStreamAmount(stream.remainingAmount, stream.assetSymbol)}</dd></div>
                <div><dt>{t("claimable")}</dt><dd>{formatStreamAmount(stream.claimable, stream.assetSymbol)}</dd></div>
                <div><dt>{t("intervalLabel")}</dt><dd>{t("daysValue", { days: stream.intervalDays || 1 })}</dd></div>
              </dl>
              <footer>
                <span>{t("authoritativeActionHint")}</span>
                {role === "incoming" ? (
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("claimStream", stream.id)}
                    disabled={!claimEnabled || actionLocked}
                  >
                    {claimingId === stream.id ? t("claiming") : t("claim")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => {
                      if (cancelConfirmId === stream.id) {
                        setCancelConfirmId("");
                        void dispatch("cancelStream", stream.id);
                      } else {
                        setCancelConfirmId(stream.id);
                      }
                    }}
                    disabled={finalized || actionLocked}
                  >
                    {cancellingId === stream.id
                      ? t("cancelling")
                      : cancelConfirmId === stream.id
                        ? t("confirmCancel")
                        : t("cancel")}
                  </button>
                )}
              </footer>
            </li>
          );
        })}
      </ul>
    );
  };

  const drawerModes: Array<{ value: DrawerMode; label: string; count?: number }> = [
    { value: "outgoing", label: t("outgoingTab"), count: countsAreAuthoritative ? createdStreams.length : undefined },
    { value: "incoming", label: t("incomingTab"), count: countsAreAuthoritative ? beneficiaryStreams.length : undefined },
    { value: "ticket", label: t("exactTab") },
    { value: "guide", label: t("guideTab") },
  ];

  const drawer = (
    <div className="stream-studio__drawer">
      <div className="stream-studio__drawer-toolbar">
        <OpenUiSegmented
          className="stream-studio__drawer-tabs"
          segmentedClassName="stream-studio__drawer-tab-options"
          label={t("streamWorkspace")}
          value={drawerMode}
          onChange={(value) => setDrawerMode(value as DrawerMode)}
          options={drawerModes.map((item) => ({
            value: item.value,
            label: (
              <span className="stream-studio__drawer-tab">
                {item.label}
                {typeof item.count === "number" && <em>{item.count}</em>}
              </span>
            ),
          }))}
        />
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost stream-studio__refresh"
          onClick={() => void dispatch("refreshStreams")}
          disabled={actionBusy || pending}
        >
          <RefreshCw size={15} />
          <span>{t("refreshStreams")}</span>
        </button>
      </div>

      {drawerMode === "outgoing" && renderStreamList("outgoing")}
      {drawerMode === "incoming" && renderStreamList("incoming")}
      {drawerMode === "ticket" && (
        <OpenUiPanel
          className="stream-studio__exact-panel"
          icon={<HandCoins size={17} />}
          title={t("exactTicketTitle")}
          subtitle={t("exactTicketSubtitle")}
        >
          <div className="stream-studio__exact-grid">
            <div><span>{t("network")}</span><strong>{networkLabel}</strong></div>
            <div><span>{t("contractAddress")}</span><strong>{compact(contractHash)}</strong></div>
            <div><span>{t("streamAmount")}</span><strong>{amount.trim() || "—"} {asset}</strong></div>
            <div><span>{t("durationDays")}</span><strong>{t("daysValue", { days: duration || "—" })}</strong></div>
            <div className="stream-studio__exact-grid-wide"><span>{t("recipientRoute")}</span><strong>{recipient.trim() || "—"}</strong></div>
            <div className="stream-studio__exact-grid-wide"><span>{t("releaseRate")}</span><strong>{releaseLabel}</strong></div>
            <div className="stream-studio__exact-grid-wide"><span>{t("pendingTransaction")}</span><strong>{pendingCreateTxid || t("noPendingTransaction")}</strong></div>
          </div>
          <OpenUiTextField
            id="stream-studio-notes"
            className="stream-studio__notes-field"
            label={t("notes")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t("notesPlaceholder")}
            maxLength={240}
            disabled={pending || isCreating}
          />
        </OpenUiPanel>
      )}
      {drawerMode === "guide" && (
        <section className="stream-studio__guide">
          <h4>{t("guideTitle")}</h4>
          <ol>
            <li>{t("guideStep1")}</li>
            <li>{t("guideStep2")}</li>
            <li>{t("guideStep3")}</li>
          </ol>
        </section>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neo-pay-shared-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          className="neo-pay-shared-playstage"
          stage={{
            eyebrow: t("studioEyebrow"),
            title: t("studioHeroTitle"),
            subtitle: t("studioHeroSubtitle"),
            badges: (
              <span className="mx2-badge" data-tone={serviceState === "unavailable" || serviceState === "partial" ? "warning" : "accent"}>
                <span className="mx2-badge__dot" />
                {t(serviceLabelKey(serviceState))}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: handlePrimary,
              disabled: primaryDisabled,
              loading: actionBusy,
            },
          }}
          drawerToggleLabel={t("streamWorkspace")}
          drawer={{ title: t("streamWorkspace"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
