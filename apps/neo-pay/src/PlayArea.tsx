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
import { OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { StreamItem } from "@shared/composables/neo-pay";
import {
  canClaim,
  deriveSchedulePreview,
  releasePerDayDisplay,
  statusLabelKey,
} from "@shared/composables/neo-pay";
import "./PlayArea.scss";

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

function positiveNumber(value: string): boolean {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeAmountForAsset(value: string, asset: AssetSymbol): string {
  const text = String(value ?? "");
  if (asset === "NEO") {
    // split() always yields at least one element; `?? ""` only satisfies
    // noUncheckedIndexedAccess (runtime no-op).
    return (text.split(/[.,]/)[0] ?? "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function positiveAmountForAsset(value: string, asset: AssetSymbol): boolean {
  if (asset === "NEO") return /^[1-9]\d*$/.test(value.trim());
  return positiveNumber(value);
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
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const serviceNotice = str("serviceNotice");
  const createdStreams = val<StreamItem[]>("createdStreams", []) ?? [];
  const beneficiaryStreams = val<StreamItem[]>("beneficiaryStreams", []) ?? [];
  const allStreams = val<StreamItem[]>("allStreams", []) ?? [];

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");
  const [asset, setAsset] = useState<AssetSymbol>("GAS");
  const [notes, setNotes] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");
  const setAssetAndNormalizeAmount = (nextAsset: AssetSymbol) => {
    setAsset(nextAsset);
    setAmount((current) => normalizeAmountForAsset(current, nextAsset));
  };
  const setDurationClamped = (value: string) => {
    const normalized = value.replace(/[^\d]/g, "");
    if (!normalized) {
      setDuration("");
      return;
    }
    setDuration(String(clampWhole(Number.parseInt(normalized, 10), 1, 365)));
  };
  const nudgeAmount = (direction: 1 | -1) => {
    const current = asset === "NEO"
      ? Number.parseInt(amount || "0", 10)
      : Number.parseFloat(amount || "0");
    const step = asset === "NEO" ? 1 : 5;
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction * step);
    setAmount(asset === "NEO" ? String(Math.trunc(next)) : next.toFixed(2).replace(/\.00$/, ""));
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
    () => deriveSchedulePreview(amount, duration, asset),
    [amount, duration, asset],
  );
  const featuredStream =
    beneficiaryStreams.find((stream) => canClaim(stream.status, stream.claimable > 0n))
    ?? createdStreams.find((stream) => stream.status === "active")
    ?? allStreams[0]
    ?? null;

  const readyToCreate = recipient.trim().length > 0 && positiveAmountForAsset(amount, asset) && positiveNumber(duration);
  const sceneState = isCreating ? "signing" : readyToCreate ? "ready" : activeCount > 0 ? "live" : "idle";
  const destinationLabel = recipient.trim()
    ? compactAddress(recipient, t("recipient"))
    : featuredStream
      ? compactAddress(featuredStream.beneficiary, t("recipient"))
      : t("recipientVessel");
  const draftStatus = isCreating
    ? t("streamDraftSigning")
    : readyToCreate
      ? t("streamDraftReady")
      : t("streamDraftIdle");
  const releaseLabel = schedulePreview
    ? schedulePreview.kind === "cliff"
      ? t("releaseCliff", { amount: schedulePreview.amount, token: asset, days: schedulePreview.days })
      : t("releaseLinear", { amount: schedulePreview.amount, token: asset })
    : t("reviewStream");
  const drawerModes: Array<{ mode: DrawerMode; label: string; count?: number }> = [
    { mode: "setup", label: t("streamDetailsTab") },
    { mode: "guide", label: t("streamGuideTab") },
    { mode: "created", label: t("streamCreatedTab"), count: createdStreams.length },
    { mode: "receiving", label: t("streamReceivingTab"), count: beneficiaryStreams.length },
  ];
  const ticketStatusLabel = readyToCreate ? t("streamTicketReady") : t("streamTicketDrafting");

  const handleCreate = () => {
    if (!readyToCreate || isCreating) return;
    void dispatch("createStream", {
      recipient,
      amount,
      duration,
      token: asset,
      notes,
    });
  };

  const scene = (
    <div className="neopay-scene" data-state={sceneState} aria-label={t("paymentStageAria")}>
      {serviceNotice && <p className="neopay-ticket__notice" role="status">{serviceNotice}</p>}
      <section className="neopay-terminal" data-ready={readyToCreate ? "true" : undefined}>
        <header className="neopay-terminal__header">
          <div>
            <span className="neopay-terminal__eyebrow">{t("streamTicket")}</span>
            <strong>{ticketStatusLabel}</strong>
          </div>
          <span className="neopay-terminal__status">
            <CoinArt size={30} variant={asset === "GAS" ? "gas" : "neo"} />
            {draftStatus}
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
              <img className="neopay-terminal__art" src={STREAM_DESK_ART} alt="" loading="eager" decoding="async" />
            </div>
            <div className="neopay-amount-console">
              <span className="neopay-amount-console__label">{t("amountModeHint")}</span>
              <div className="neopay-amount-console__main">
                <button type="button" onClick={() => nudgeAmount(-1)} disabled={isCreating || !amount}>-</button>
                <OpenUiTextField
                  id="neopay-amount"
                  className="neopay-amount-field"
                  inputClassName="neopay-input neopay-input--amount"
                  label={t("totalAmount")}
                  value={amount}
                  onChange={(event) => setAmount(normalizeAmountForAsset(event.target.value, asset))}
                  placeholder="0"
                  inputMode={asset === "NEO" ? "numeric" : "decimal"}
                  disabled={isCreating}
                />
                <button type="button" onClick={() => nudgeAmount(1)} disabled={isCreating}>+</button>
                <strong>{asset}</strong>
              </div>
              <div className="neopay-token-row" role="group" aria-label={t("assetType")}>
                {(["GAS", "NEO"] as const).map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    className={`neopay-token-option${asset === symbol ? " is-active" : ""}`}
                    data-token={symbol}
                    onClick={() => setAssetAndNormalizeAmount(symbol)}
                    disabled={isCreating}
                  >
                    <CoinArt size={24} variant={symbol === "GAS" ? "gas" : "neo"} />
                    <span>{symbol}</span>
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
                    disabled={isCreating}
                  >
                    {preset} {asset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="neopay-ticket-board__details">
            <section className="neopay-recipient-card" aria-label={t("recipient")}>
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
                  disabled={isCreating}
                  spellCheck={false}
                  mono
                />
              </div>
              <p>{recipient.trim() ? compactAddress(recipient) : t("routeModeEmpty")}</p>
            </section>

            <section className="neopay-schedule-card" aria-label={t("releasePlan")}>
              <div className="neopay-schedule-meter">
                <span>{t("releasePlan")}</span>
                <strong>{duration || "0"}d</strong>
                <p>{releaseLabel}</p>
              </div>
              <div className="neopay-duration-stepper" aria-label={t("releasePlan")}>
                <button type="button" onClick={() => nudgeDuration(-1)} disabled={isCreating}>-7d</button>
                <output>{duration || "0"}d</output>
                <button type="button" onClick={() => nudgeDuration(1)} disabled={isCreating}>+7d</button>
              </div>
              <div className="neopay-duration-grid">
                {DURATION_PRESETS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={duration === String(days) ? "is-active" : undefined}
                    onClick={() => setDuration(String(days))}
                    disabled={isCreating}
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
          <strong>{draftStatus}</strong>
          <span><ShieldCheck size={15} /> {t("transactionPreviewHint")}</span>
          <span><HandCoins size={15} /> {releaseLabel}</span>
          <span><Clock3 size={15} /> {activeCount} {activeCount === 1 ? t("streamSingular") : t("streamPlural")}</span>
        </footer>
      </section>
    </div>
  );

  const streamList = (title: string, streams: StreamItem[], role: "created" | "beneficiary") => (
    <section className="neopay-drawer__section">
      <h4>{title}</h4>
      {streams.length > 0 ? (
        <ul className="neopay-stream-list">
          {streams.slice(0, 8).map((stream) => {
            const finalized = stream.status === "completed" || stream.status === "cancelled";
            const claimEnabled = role === "beneficiary" && canClaim(stream.status, stream.claimable > 0n);
            const releasePerDay = releasePerDayDisplay(stream.rateAmount, stream.intervalDays, stream.assetSymbol);
            return (
              <li key={`${role}-${stream.id}`} className="neopay-stream-card" data-status={stream.status}>
                <div>
                  <strong>{streamTitle(stream)}</strong>
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
                      disabled={!claimEnabled}
                    >
                      {t("claim")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("cancelStream", stream.id)}
                      disabled={finalized}
                    >
                      {t("cancel")}
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
              disabled={isRefreshing || isCreating}
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
              <OpenUiSegmented
                className="neopay-drawer-field neopay-drawer-field--asset"
                label={t("assetType")}
                value={asset}
                onChange={(value) => setAssetAndNormalizeAmount(value as AssetSymbol)}
                options={[
                  { value: "GAS", label: "GAS" },
                  { value: "NEO", label: "NEO" },
                ]}
                disabled={isCreating}
                hint={asset === "NEO" ? t("neoAssetHint") : t("gasAssetHint")}
              />
              <OpenUiTextField
                id="neopay-drawer-amount"
                className="neopay-drawer-field"
                inputClassName="neopay-drawer-input--amount"
                label={t("totalAmount")}
                value={amount}
                onChange={(event) => setAmount(normalizeAmountForAsset(event.target.value, asset))}
                placeholder={t("totalAmountPlaceholder")}
                inputMode={asset === "NEO" ? "numeric" : "decimal"}
                pattern={asset === "NEO" ? "[0-9]*" : undefined}
                disabled={isCreating}
                hint={asset === "NEO" ? t("neoWholeUnitHint") : t("totalAmountHint")}
              />
              <OpenUiTextField
                id="neopay-drawer-recipient"
                className="neopay-drawer-field neopay-drawer-field--wide"
                inputClassName="neopay-drawer-input--recipient"
                label={t("recipient")}
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder={t("beneficiaryPlaceholder")}
                disabled={isCreating}
                spellCheck={false}
                mono
              />
              <OpenUiTextField
                id="neopay-drawer-duration"
                className="neopay-drawer-field"
                label={t("customDays")}
                value={duration}
                onChange={(event) => setDurationClamped(event.target.value)}
                placeholder={t("durationPlaceholder")}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isCreating}
                hint={t("intervalHint")}
              />
              <OpenUiTextField
                id="neopay-drawer-notes"
                className="neopay-drawer-field neopay-drawer-field--wide"
                label={t("notes")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("notesPlaceholder")}
                disabled={isCreating}
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
              label: isCreating ? t("creatingStream") : t("createStream"),
              onClick: handleCreate,
              disabled: isCreating || !readyToCreate,
              loading: isCreating || isLoading,
            },
          }}
          drawerToggleLabel={t("vaultsTab")}
          drawer={{ title: t("vaultsTab"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
