/**
 * PlayArea.tsx -- Neo Pay payment stream desk
 *
 * The payment stream is the product surface: users shape a funded route, see
 * the release schedule, then send one clear wallet action. Lists and metadata
 * stay tucked in the drawer so the first screen does not read like a form.
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
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { StreamItem } from "@shared/composables/neo-pay";
import {
  canClaim,
  statusLabelKey,
} from "@shared/composables/neo-pay";
import "./PlayArea.scss";
import { normalizeNeoPayAccount } from "./neo-pay-safety";
import {
  deriveExactNeoPaySchedule,
  formatAssetBaseUnits,
  nudgeNeoPayAmount,
  parseAssetToBaseUnits,
} from "./useNeoPayProduction";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type AssetSymbol = "GAS" | "NEO";
type DrawerMode = "setup" | "guide" | "created" | "receiving";

const AMOUNT_PRESETS = ["10", "50", "100"];
const DURATION_PRESETS = [7, 30, 90];
const GAS_FACTOR = 100000000n;
const STREAM_DESK_ART = "payment-stream-desk.webp";

function TokenIcon({ asset, size = 24 }: { asset: AssetSymbol; size?: number }) {
  return (
    <CoinArt
      className="neopay-token-icon"
      variant={asset === "NEO" ? "neo" : "gas"}
      size={size}
      decorative
    />
  );
}

function normalizeAmountInput(value: string): string {
  const text = String(value ?? "").replace(",", ".");
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function compactAddress(value: string | undefined, empty = "-"): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return empty;
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

function formatBaseUnits(value: bigint | undefined, asset: AssetSymbol): string {
  if (typeof value !== "bigint") return "0";
  if (asset === "NEO") return value.toString();

  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / GAS_FACTOR;
  const fraction = (absolute % GAS_FACTOR).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function formatStreamAmount(value: bigint | undefined, asset: AssetSymbol): string {
  return `${formatBaseUnits(value, asset)} ${asset}`;
}

function exactReleasePerDay(stream: StreamItem): string | null {
  if (stream.rateAmount <= 0n || stream.intervalDays < 1) return null;
  const dailyBase = stream.rateAmount / BigInt(stream.intervalDays);
  if (dailyBase <= 0n) return null;
  return formatAssetBaseUnits(stream.assetSymbol, dailyBase);
}

function streamTitle(stream: StreamItem): string {
  return stream.title?.trim() || `Stream #${stream.id}`;
}

function clampWhole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const activeCount = num("activeCount");
  const isCreating = bool("isCreating");
  const isRecovering = bool("isRecovering");
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const serviceNotice = str("serviceNotice");
  const pendingCreateTxid = str("pendingCreateTxid");
  const claimingId = str("claimingId");
  const cancellingId = str("cancellingId");
  const listSource = str("listSource");
  const activeAction = str("activeAction");
  const operationBusy = bool("operationBusy");
  const recoveryStorageHealthy = val<boolean>("recoveryStorageHealthy", true) ?? true;
  const createdStreams = val<StreamItem[]>("createdStreams", []) ?? [];
  const beneficiaryStreams = val<StreamItem[]>("beneficiaryStreams", []) ?? [];
  const allStreams = val<StreamItem[]>("allStreams", []) ?? [];

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");
  const [asset, setAsset] = useState<AssetSymbol>("GAS");
  const [notes, setNotes] = useState("");
  const [cancelConfirmId, setCancelConfirmId] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");
  const setAssetAndNormalizeAmount = (nextAsset: AssetSymbol) => {
    setAsset(nextAsset);
  };
  const setDurationText = (value: string) => {
    const normalized = value.replace(/[^\d]/g, "");
    setDuration(normalized.slice(0, 3));
  };
  const nudgeAmount = (direction: 1 | -1) => {
    setAmount(nudgeNeoPayAmount(amount, asset, direction));
  };
  const nudgeDuration = (direction: 1 | -1) => {
    const current = Number.parseInt(duration || "30", 10);
    setDuration(String(clampWhole((Number.isFinite(current) ? current : 30) + direction * 7, 1, 365)));
  };
  const setDrawerModeSafe = (value: string) => {
    if (value === "setup" || value === "guide" || value === "created" || value === "receiving") {
      setDrawerMode(value);
    }
  };

  const schedulePreview = useMemo(
    () => deriveExactNeoPaySchedule(amount, duration, asset),
    [amount, duration, asset],
  );
  const amountIsInvalid = Boolean(amount.trim()) && parseAssetToBaseUnits(asset, amount) === null;
  const claimableStream = beneficiaryStreams.find((stream) => canClaim(stream.status, stream.claimable > 0n)) ?? null;
  const featuredStream =
    claimableStream
    ?? createdStreams.find((stream) => stream.status === "active")
    ?? allStreams[0]
    ?? null;

  const recipientIsValid = Boolean(normalizeNeoPayAccount(recipient.trim()));
  const readyToCreate = recipientIsValid && schedulePreview !== null;
  const draftLocked = isCreating || Boolean(pendingCreateTxid);
  const writesBlocked = operationBusy || Boolean(pendingCreateTxid) || !recoveryStorageHealthy;
  const sceneState = draftLocked ? "signing" : readyToCreate ? "ready" : activeCount > 0 ? "live" : "idle";
  const destinationLabel = recipient.trim()
    ? compactAddress(recipient, t("recipient"))
    : featuredStream
      ? compactAddress(featuredStream.beneficiary, t("recipient"))
      : t("recipientVessel");
  const draftStatus = pendingCreateTxid
    ? t("streamDraftPending")
    : isCreating
      ? t("streamDraftSigning")
    : readyToCreate
      ? t("streamDraftReady")
      : t("streamDraftIdle");
  const releaseLabel = schedulePreview
    ? schedulePreview.kind === "cliff"
      ? t("releaseCliff", { amount: schedulePreview.rateDisplay, token: asset, days: schedulePreview.durationDays })
      : t("releaseLinear", { amount: schedulePreview.rateDisplay, token: asset })
    : t("reviewStream");
  const hasChainView = listSource === "chain" || listSource === "partial";
  const drawerModes: Array<{ mode: DrawerMode; label: string; count?: number }> = [
    { mode: "setup", label: t("streamDetailsTab") },
    { mode: "guide", label: t("streamGuideTab") },
    { mode: "created", label: t("streamCreatedTab"), count: hasChainView ? createdStreams.length : undefined },
    { mode: "receiving", label: t("streamReceivingTab"), count: hasChainView ? beneficiaryStreams.length : undefined },
  ];
  const ticketStatusLabel = readyToCreate ? t("streamTicketReady") : t("streamTicketDrafting");
  const visibleNotice = serviceNotice || (!recoveryStorageHealthy ? t("neoPayRecoveryStorageUnavailable") : "");

  const handleCreate = () => {
    if (!readyToCreate || writesBlocked) return;
    void dispatch("createStream", {
      recipient,
      amount,
      duration,
      token: asset,
      notes,
    });
  };
  const primaryMode = pendingCreateTxid ? "recover" : !recoveryStorageHealthy ? "storage" : "create";
  const handlePrimary = () => {
    if (primaryMode === "recover") {
      if (!isRecovering) void dispatch("recoverTransaction");
      return;
    }
    if (primaryMode === "storage") {
      void dispatch("refreshRecoveryStorage");
      return;
    }
    handleCreate();
  };
  const primaryLabel = primaryMode === "recover"
    ? isRecovering ? t("checkingTransaction") : t("checkTransaction")
    : primaryMode === "storage"
      ? activeAction === "storage" ? t("checkingRecoveryStorage") : t("restoreRecoveryStorage")
      : isCreating ? t("creatingStream") : t("createStream");
  const primaryDisabled = primaryMode === "recover"
    ? isRecovering || (operationBusy && activeAction !== "recover")
    : primaryMode === "storage"
      ? operationBusy && activeAction !== "storage"
      : writesBlocked || !readyToCreate;

  const scene = (
    <div className="neopay-scene" data-state={sceneState} aria-label={t("paymentStageAria")}>
      {visibleNotice && <p className="neopay-ticket__notice" role="status">{visibleNotice}</p>}
      <section className="neopay-terminal" data-ready={readyToCreate ? "true" : undefined}>
        <header className="neopay-terminal__header">
          <div>
            <span className="neopay-terminal__eyebrow">{t("streamTicket")}</span>
            <strong>{ticketStatusLabel}</strong>
          </div>
          {/* This slot leads with a TokenIcon, so its subject is the asset being
              streamed — it was printing `draftStatus` instead, which is what the
              PlayStage badge already says, so a GAS coin icon sat next to the
              words "Stream ticket draft" and the same string appeared three
              times on one screen. Name the asset the icon is showing. */}
          <span className="neopay-terminal__status">
            <TokenIcon asset={asset} size={30} />
            {asset}
          </span>
        </header>

        <div className="neopay-stream" aria-label={t("streamFlowPreview")}>
          <div className="neopay-stream__node">
            <span>{t("payerWallet")}</span>
            <strong>{t("walletFunding")}</strong>
          </div>
          <div className="neopay-stream__rail" aria-hidden="true">
            <span className="neopay-stream__pulse neopay-stream__pulse--one" />
            <span className="neopay-stream__pulse neopay-stream__pulse--two" />
            <ArrowRight size={20} />
          </div>
          <div className="neopay-stream__node neopay-stream__node--accent">
            <span>{t("recipient")}</span>
            <strong>{destinationLabel}</strong>
          </div>
        </div>

        <section className="neopay-ticket-board" aria-label={t("streamFlowPreview")}>
          <div className="neopay-ticket-board__hero">
            <div className="neopay-ticket-board__media">
              <img
                className="neopay-terminal__art"
                src={STREAM_DESK_ART}
                alt={t("paymentArtAlt")}
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="neopay-amount-console">
              <span className="neopay-amount-console__label">{t("amountModeHint")}</span>
              <div className="neopay-amount-console__main">
                <button type="button" onClick={() => nudgeAmount(-1)} disabled={draftLocked || !amount}>-</button>
                <OpenUiTextField
                  id="neopay-amount"
                  className="neopay-amount-field"
                  inputClassName="neopay-input neopay-input--amount"
                  label={t("totalAmount")}
                  value={amount}
                  onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
                  placeholder="0"
                  inputMode={asset === "NEO" ? "numeric" : "decimal"}
                  pattern={asset === "NEO" ? "[0-9]*" : undefined}
                  aria-invalid={amountIsInvalid || undefined}
                  disabled={draftLocked}
                />
                <button type="button" onClick={() => nudgeAmount(1)} disabled={draftLocked}>+</button>
                <strong>{asset}</strong>
              </div>
              {amountIsInvalid && (
                <p className="neopay-amount-console__hint" role="status">
                  {asset === "NEO" ? t("neoWholeUnitHint") : t("neoPayAmountPrecisionHint")}
                </p>
              )}
              <div className="neopay-token-row" role="group" aria-label={t("assetType")}>
                {(["GAS", "NEO"] as const).map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    className={`neopay-token-option${asset === symbol ? " is-active" : ""}`}
                    data-token={symbol}
                    onClick={() => setAssetAndNormalizeAmount(symbol)}
                    disabled={draftLocked}
                  >
                    <TokenIcon asset={symbol} size={24} />
                    <span>{symbol}</span>
                    <small>{t("officialToken")}</small>
                  </button>
                ))}
              </div>
              <div className="neopay-preset-row" aria-label={t("totalAmount")}>
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`neopay-preset-option${amount === preset ? " is-active" : ""}`}
                    onClick={() => setAmount(preset)}
                    disabled={draftLocked}
                  >
                    {preset} {asset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="neopay-ticket-board__details">
            <section
              className="neopay-recipient-card"
              aria-label={t("recipient")}
              data-state={!recipient.trim() ? "empty" : recipientIsValid ? "valid" : "invalid"}
            >
              <span><UserRound size={18} /> {t("recipient")}</span>
              <div className="neopay-recipient-card__entry">
                <OpenUiTextField
                  id="neopay-recipient"
                  className="neopay-recipient-field"
                  inputClassName="neopay-input neopay-input--recipient"
                  label={t("recipient")}
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder={t("beneficiaryPlaceholder")}
                  disabled={draftLocked}
                  spellCheck={false}
                  mono
                />
              </div>
              <p>{!recipient.trim() ? t("routeModeEmpty") : recipientIsValid ? compactAddress(recipient) : t("invalidAddress")}</p>
            </section>

            <section className="neopay-schedule-card" aria-label={t("releasePlan")}>
              <div className="neopay-schedule-meter">
                <span>{t("releasePlan")}</span>
                <strong>{duration || "0"}d</strong>
                <p>{releaseLabel}</p>
              </div>
              <div className="neopay-duration-stepper" aria-label={t("releasePlan")}>
                <button type="button" onClick={() => nudgeDuration(-1)} disabled={draftLocked}>-7d</button>
                <output>{duration || "0"}d</output>
                <button type="button" onClick={() => nudgeDuration(1)} disabled={draftLocked}>+7d</button>
              </div>
              <div className="neopay-duration-grid">
                {DURATION_PRESETS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={duration === String(days) ? "is-active" : undefined}
                    onClick={() => setDuration(String(days))}
                    disabled={draftLocked}
                  >
                    <CalendarDays size={15} />
                    {days}d
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>

        <footer className="neopay-ticket__review">
          {/* The lead chip labels the three facts beside it (network fee, release
              schedule, live streams) rather than repeating the draft status the
              PlayStage badge already carries — the third of the three identical
              "Stream ticket draft" chips this screen used to show. */}
          <strong>{t("reviewBeforeSigning")}</strong>
          <span><ShieldCheck size={15} /> {t("transactionPreviewHint")}</span>
          <span><HandCoins size={15} /> {releaseLabel}</span>
          <span><Clock3 size={15} /> {hasChainView
            ? `${activeCount} ${activeCount === 1 ? t("streamSingular") : t("streamPlural")}`
            : t("chainViewUnavailable")}</span>
        </footer>
      </section>
    </div>
  );

  const streamList = (title: string, streams: StreamItem[], role: "created" | "beneficiary") => (
    <section className="neopay-drawer__section">
      <h4>{title}</h4>
      {streams.length > 0 ? (
        <ul className="neopay-stream-list">
          {streams.map((stream) => {
            const finalized = stream.status === "completed" || stream.status === "cancelled";
            const claimEnabled = role === "beneficiary" && canClaim(stream.status, stream.claimable > 0n);
            const releasePerDay = exactReleasePerDay(stream);
            return (
              <li key={`${role}-${stream.id}`} className="neopay-stream-card" data-status={stream.status}>
                <div>
                  <strong><TokenIcon asset={stream.assetSymbol} size={20} /> {streamTitle(stream)}</strong>
                  <span>{compactAddress(role === "created" ? stream.beneficiary : stream.creator)}</span>
                </div>
                <dl>
                  <div><dt>{t("totalLocked")}</dt><dd>{formatStreamAmount(stream.totalAmount, stream.assetSymbol)}</dd></div>
                  <div><dt>{t("claimable")}</dt><dd>{formatStreamAmount(stream.claimable, stream.assetSymbol)}</dd></div>
                  {releasePerDay && <div><dt>{t("releasePerDay")}</dt><dd>{releasePerDay} {stream.assetSymbol}</dd></div>}
                  <div><dt>{t("streamStatus")}</dt><dd>{t(statusLabelKey(stream.status))}</dd></div>
                </dl>
                <div className="neopay-stream-card__actions">
                  {role === "beneficiary" ? (
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("claimStream", stream.id)}
                      disabled={!claimEnabled || writesBlocked}
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
                      disabled={finalized || writesBlocked}
                    >
                      {cancellingId === stream.id
                        ? t("cancelling")
                        : cancelConfirmId === stream.id
                          ? t("confirmCancelStream")
                          : t("cancel")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="neopay-empty">{role === "created" ? t("noCreatedStreams") : t("noBeneficiaryStreams")}</p>
      )}
    </section>
  );

  const drawer = (
    <div className="neopay-drawer">
      <OpenUiSegmented
        className="neopay-drawer-tabs"
        segmentedClassName="neopay-drawer-tabs__group"
        label={t("vaultsTab")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: (
            <span className="neopay-drawer-tab">
              <span>{item.label}</span>
              {typeof item.count === "number" && <em>{item.count}</em>}
            </span>
          ),
        }))}
      />

      {drawerMode === "setup" && (
        <section className="neopay-drawer__section neopay-drawer__section--setup">
          <div className="neopay-drawer__head">
            <h4>{t("streamMetadata")}</h4>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost neopay-drawer__refresh"
              onClick={() => void dispatch("refreshStreams")}
              disabled={isRefreshing || operationBusy}
            >
              <RefreshCw size={15} />
              <span>{t("refresh")}</span>
            </button>
          </div>
          <OpenUiPanel
            className="neopay-drawer-panel"
            icon={<HandCoins size={16} />}
            title={t("streamDetailsTab")}
            subtitle={t("drawerDetailsSubtitle")}
          >
            <div className="neopay-drawer-fields">
              <OpenUiTextField
                id="neopay-drawer-duration"
                className="neopay-drawer-field"
                label={t("customDays")}
                value={duration}
                onChange={(event) => setDurationText(event.target.value)}
                placeholder={t("durationPlaceholder")}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                disabled={draftLocked}
                hint={t("intervalHint")}
              />
              <OpenUiTextField
                id="neopay-drawer-notes"
                className="neopay-drawer-field"
                label={t("notes")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("notesPlaceholder")}
                maxLength={240}
                disabled={draftLocked}
                hint={t("neoPayNotesHint")}
              />
            </div>
          </OpenUiPanel>
          <div className="neopay-drawer-summary" aria-label={t("transactionPreview")}>
            <span>{t("transactionPreview")}</span>
            <strong>{amount || "0"} {asset} · {duration || "0"}d</strong>
            <p>{releaseLabel}</p>
          </div>
        </section>
      )}

      {drawerMode === "guide" && (
        <section className="neopay-drawer__section">
          <h4>{t("howItWorksTitle")}</h4>
          <ol className="neopay-steps">
            <li>{t("howStep1")}</li>
            <li>{t("howStep2")}</li>
            <li>{t("howStep3")}</li>
          </ol>
        </section>
      )}

      {drawerMode === "created" && streamList(t("yourCreatedStreams"), createdStreams, "created")}
      {drawerMode === "receiving" && streamList(t("streamsYouReceive"), beneficiaryStreams, "beneficiary")}
    </div>
  );

  const secondaryActions = claimableStream && !pendingCreateTxid ? [{
    label: t("claimAvailable", {
      amount: formatBaseUnits(claimableStream.claimable, claimableStream.assetSymbol),
      asset: claimableStream.assetSymbol,
    }),
    onClick: () => void dispatch("claimStream", claimableStream.id),
    disabled: writesBlocked,
    loading: claimingId === claimableStream.id,
    icon: <HandCoins size={16} />,
    hint: t("claimAvailableHint"),
  }] : [];

  return (
    <OpenUiProvider>
      <div className="neo-pay-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          className="neo-pay-playstage"
          stage={{
            eyebrow: t("heroEyebrow"),
            title: t("heroTitle"),
            subtitle: t("docSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {draftStatus}</span>,
          }}
          scene={scene}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: handlePrimary,
              disabled: primaryDisabled,
              loading: isCreating || isRecovering || activeAction === "storage" || isLoading,
            },
            secondary: secondaryActions,
          }}
          drawerToggleLabel={t("vaultsTab")}
          drawer={{ title: t("vaultsTab"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
