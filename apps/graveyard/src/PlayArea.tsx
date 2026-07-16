/**
 * Graveyard — a warm memory-garden ritual around the real on-chain flow.
 * Raw notes and local files are reduced to SHA-256 on this device; only the
 * digest, type, owner, fees, epitaph, and later forgotten state touch Neo N3.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Droplet,
  Feather,
  FileUp,
  Hash,
  History,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { HistoryItem } from "./types";
import "./PlayArea.scss";

interface P {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type ComposeMode = "write" | "file" | "hash";

interface MemoryTypeOption {
  value: number;
  label: string;
}

interface MemoryTypeMeta {
  Icon: LucideIcon;
  tone: string;
}

const GARDEN_IMAGE = "memory-garden.webp";
const LETTER_IMAGE = "memory-letter.webp";
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const NOTE_LIMIT = 2_000;

const DEFAULT_MEMORY_TYPES: MemoryTypeOption[] = [
  { value: 1, label: "Secret" },
  { value: 2, label: "Regret" },
  { value: 3, label: "Wish" },
  { value: 4, label: "Confession" },
  { value: 5, label: "Other" },
];
const FALLBACK_MEMORY_TYPE = DEFAULT_MEMORY_TYPES[0]!;

const MEMORY_TYPE_META: Record<number, MemoryTypeMeta> = {
  1: { Icon: LockKeyhole, tone: "moss" },
  2: { Icon: Droplet, tone: "rose" },
  3: { Icon: Sparkles, tone: "stone" },
  4: { Icon: Feather, tone: "amber" },
  5: { Icon: Circle, tone: "chalk" },
};

function compactHash(value: unknown, empty = "—") {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  return text.length > 24 ? `${text.slice(0, 12)}…${text.slice(-8)}` : text;
}

function compactAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function shortTime(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  // `totalDestroyed` is `undefined` until the burial read settles, so it is read
  // raw rather than through `num()`, which coerces that unread state to NaN.
  // Absence is not zero — but for the record-count arithmetic below, an unread
  // count simply contributes nothing.
  const totalDestroyed = val<number>("totalDestroyed") ?? 0;
  const historyCount = num("historyCount");
  const burialFeeDisplay = str("burialFeeDisplay", "0.1 GAS");
  const forgetFeeDisplay = str("forgetFeeDisplay", "1 GAS");
  const isDestroying = bool("isDestroying");
  const isHashing = bool("isHashing");
  const isLoading = bool("isLoading");
  const showConfirm = bool("showConfirm");
  const showWarningShake = bool("showWarningShake");
  const walletConnected = bool("walletConnected");
  const walletAddress = str("walletAddress");
  const sourceError = str("sourceError");
  const fileName = str("fileName");
  const fileSize = num("fileSize");
  const feesReady = bool("feesReady");
  const feesSettled = bool("feesSettled");
  const contractPaused = bool("contractPaused");
  const storageHealthy = bool("storageHealthy");
  const burialRecoveryPhase = str("burialRecoveryPhase");
  const burialRecoveryTxid = str("burialRecoveryTxid");
  const forgetRecoveryPhase = str("forgetRecoveryPhase");
  const forgetRecoveryMemoryId = str("forgetRecoveryMemoryId");
  const epitaphRecoveryPhase = str("epitaphRecoveryPhase");
  const epitaphRecoveryMemoryId = str("epitaphRecoveryMemoryId");
  const epitaphRecoveryTxid = str("epitaphRecoveryTxid");
  const assetHash = str("assetHash");
  const savedMemoryText = str("memoryText");
  const composeMode = str("composeMode", "write") as ComposeMode;
  const memoryType = num("memoryType", 1);
  const historyTruncated = bool("historyTruncated");
  const showAllHistory = bool("showAllHistory");
  const forgetConfirmId = str("forgetConfirmId");
  const forgettingId = str("forgettingId");
  const epitaphDraftId = str("epitaphDraftId");
  const epitaphText = str("epitaphText");
  const epitaphSavingId = str("epitaphSavingId");
  const history = (val("history") ?? []) as HistoryItem[];
  const memoryTypeOptions = (val("memoryTypeOptions") ?? DEFAULT_MEMORY_TYPES) as MemoryTypeOption[];

  const [draftMemory, setDraftMemory] = useState(savedMemoryText);
  const [historyOpen, setHistoryOpen] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLElement>(null);
  const destroyingRef = useRef(isDestroying);

  useEffect(() => setDraftMemory(savedMemoryText), [savedMemoryText]);

  useEffect(() => {
    destroyingRef.current = isDestroying;
    if (showConfirm && isDestroying) confirmDialogRef.current?.focus();
  }, [isDestroying, showConfirm]);

  useEffect(() => {
    if (!showConfirm) return;
    const returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    // An irreversible paid action should never receive default keyboard focus.
    cancelButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !destroyingRef.current) {
        event.preventDefault();
        void dispatch("cancelDestroy");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        confirmDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      returnFocus?.focus();
    };
  }, [dispatch, showConfirm]);

  const selectedType = useMemo(
    () => memoryTypeOptions.find((option) => Number(option.value) === memoryType)
      ?? memoryTypeOptions[0]
      ?? FALLBACK_MEMORY_TYPE,
    [memoryType, memoryTypeOptions],
  );
  const hashReady = SHA256_PATTERN.test(assetHash);
  const normalizedHashDraft = draftMemory.trim().replace(/^0x/i, "");
  const hashDraftTouched = composeMode === "hash" && normalizedHashDraft.length > 0;
  const hashDraftValid = composeMode === "hash" && SHA256_PATTERN.test(normalizedHashDraft);
  const hashDraftInvalid = hashDraftTouched && !hashDraftValid;
  const hashDraftHint = !hashDraftTouched
    ? t("sha256Hint")
    : hashDraftValid
      ? t("hashReadyCopy")
      : normalizedHashDraft.length < 64
        ? t("hashTooShortCopy")
        : t("sha256InvalidHint");
  const busy = isDestroying || isHashing;
  const recordTotal = Math.max(totalDestroyed, historyCount);
  const selectedMeta = MEMORY_TYPE_META[memoryType] ?? MEMORY_TYPE_META[5]!;
  const SelectedIcon = selectedMeta.Icon;
  /**
   * Fee rails across the three honest phases. Previously both values rendered
   * `feePending` ("Checking…") whenever `feesReady` was false — including after
   * the read had settled with nothing, which is how the first screen managed to
   * say "Checking…" on the rails and "Live contract fees are unavailable" in
   * the panel below at the same time.
   */
  const feePhase = resolvePhase({
    loading: isLoading,
    settled: feesSettled,
    hasData: feesReady,
  });
  const renderFee = (value: string) => (
    <PhaseValue
      phase={feePhase}
      placeholder={t("feeNeedsConnection")}
      skeletonWidth="4.5em"
    >
      {value}
    </PhaseValue>
  );
  const hasBurialRecovery = Boolean(burialRecoveryPhase);
  const burialTargetPending = burialRecoveryPhase === "target-broadcast";

  const selectMode = (mode: ComposeMode) => {
    if (mode === composeMode || isDestroying) return;
    setDraftMemory("");
    void dispatch("setComposeMode", mode);
  };

  const handleDraftChange = (next: string) => {
    setDraftMemory(next);
    state.memoryText?.set(next);
    void dispatch("setMemoryText", {
      composeMode,
      memoryText: next,
      assetHash: composeMode === "hash" ? next : "",
    });
  };

  const handleFile = (file?: File) => {
    if (!file || isDestroying) return;
    void dispatch("hashMemoryFile", file);
  };

  const handleReview = async () => {
    if (composeMode !== "file") {
      await dispatch("setMemoryText", {
        composeMode,
        memoryText: draftMemory,
        assetHash: composeMode === "hash" ? draftMemory : assetHash,
      });
    }
    await dispatch("initiateDestroy");
  };

  // Still used by the garden header's compact "N records" chip, which sits far
  // from the records section and so genuinely needs to scroll to it. (The
  // removed duplicate was a full-width card rendered directly above that
  // section.)
  const openRecords = () => {
    setHistoryOpen(true);
    window.setTimeout(() => {
      document.getElementById("graveyard-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <main className="graveyard-app" data-mode={composeMode} data-busy={busy ? "true" : undefined}>
      <section className="graveyard-garden" aria-label={t("memoryGarden")}>
        <img src={GARDEN_IMAGE} alt="" aria-hidden="true" className="graveyard-garden__image" />
        <header className="graveyard-garden__header">
          <div>
            <span>{t("title")}</span>
            <h1>{t("memoryGarden")}</h1>
          </div>
          <button type="button" className="graveyard-record-count" onClick={openRecords}>
            <BookOpen size={17} />
            <strong>{recordTotal}</strong>
            <span>{t("records")}</span>
          </button>
        </header>

        <div className="graveyard-garden__seal" data-ready={hashReady ? "true" : undefined}>
          <span className="graveyard-garden__seal-icon"><SelectedIcon size={20} /></span>
          <span>
            <em>{selectedType.label}</em>
            <strong>{isHashing ? t("hashing") : hashReady ? compactHash(assetHash) : t("sealEmpty")}</strong>
          </span>
        </div>
      </section>

      <section className="graveyard-ritual" aria-label={t("memoryConsole")}>
        <nav className="graveyard-source-tabs" aria-label={t("memorySource")} role="tablist">
          {([
            ["write", PenLine, "composeModeWrite"],
            ["file", FileUp, "composeModeFile"],
            ["hash", Hash, "composeModeHash"],
          ] as const).map(([mode, Icon, key]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={composeMode === mode}
              className={composeMode === mode ? "is-active" : undefined}
              onClick={() => selectMode(mode)}
              disabled={isDestroying}
            >
              <Icon size={18} />
              <span>{t(key)}</span>
            </button>
          ))}
        </nav>

        <div className="graveyard-ritual__grid">
          <div className="graveyard-ritual__compose">
            <section className="graveyard-letter" aria-label={t("memorySource")}>
              <img className="graveyard-letter__paper" src={LETTER_IMAGE} alt="" aria-hidden="true" />
              {composeMode === "write" ? (
                <label className="graveyard-letter__content graveyard-letter__content--write">
                  <span>{t("memoryTextLabel")}</span>
                  <textarea
                    value={draftMemory}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder={t("memoryTextPlaceholderShort")}
                    maxLength={NOTE_LIMIT}
                    rows={5}
                    disabled={isDestroying}
                  />
                  <em>{draftMemory.length} / {NOTE_LIMIT}</em>
                </label>
              ) : composeMode === "file" ? (
                <label className="graveyard-letter__content graveyard-letter__content--file">
                  <input
                    type="file"
                    onChange={(event) => {
                      handleFile(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    disabled={isDestroying}
                  />
                  {isHashing ? (
                    <LoaderCircle className="graveyard-spin" size={31} />
                  ) : sourceError ? (
                    <X size={31} />
                  ) : fileName ? (
                    <CheckCircle2 size={31} />
                  ) : (
                    <FileUp size={31} />
                  )}
                  <strong>{isHashing ? t("hashingFile") : fileName || t("chooseLocalFile")}</strong>
                  <span>{fileName ? formatBytes(fileSize) : t("filePrivacyHint")}</span>
                </label>
              ) : (
                <label className="graveyard-letter__content graveyard-letter__content--hash">
                  <span>{t("assetHash")}</span>
                  <input
                    value={draftMemory}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder={t("sha256Placeholder")}
                    aria-invalid={hashDraftInvalid}
                    aria-describedby="graveyard-hash-hint"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={isDestroying}
                  />
                  <em
                    id="graveyard-hash-hint"
                    data-error={hashDraftInvalid ? "true" : undefined}
                    aria-live="polite"
                  >
                    {hashDraftHint}
                  </em>
                </label>
              )}
            </section>

            <div className="graveyard-privacy" data-error={sourceError ? "true" : undefined} aria-live="polite">
              {sourceError ? <X size={19} /> : <ShieldCheck size={19} />}
              <span>
                <strong>{sourceError || t("privacyFirst")}</strong>
                <em>{t("privacyBoundary")}</em>
              </span>
            </div>

            <fieldset className="graveyard-types" disabled={isDestroying}>
              <legend><Sparkles size={17} /> {t("memoryType")}</legend>
              <div className="graveyard-types__grid">
                {memoryTypeOptions.map((option) => {
                  const meta = MEMORY_TYPE_META[Number(option.value)] ?? MEMORY_TYPE_META[5]!;
                  const Icon = meta.Icon;
                  const active = memoryType === Number(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-tone={meta.tone}
                      className={active ? "is-active" : undefined}
                      onClick={() => state.memoryType?.set(Number(option.value))}
                    >
                      <span><Icon size={22} /></span>
                      <strong>{option.label}</strong>
                      {active ? <Check className="graveyard-types__check" size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <aside className="graveyard-ritual__review" aria-label={t("networkAndFee")}>
            <div className="graveyard-review-head">
              <span><Landmark size={18} /> {t("networkAndFee")}</span>
              <strong>{t("neoN3")}</strong>
            </div>

            <div className="graveyard-fees">
              <div className="graveyard-fee graveyard-fee--active">
                <span className="graveyard-fee__radio"><Check size={14} /></span>
                <CoinArt size={30} variant="gas" />
                <span><strong>{t("buryNow")}</strong><em>{t("payOnce")}</em></span>
                <b>{renderFee(burialFeeDisplay)}</b>
              </div>
              <div className="graveyard-fee">
                <span className="graveyard-fee__radio" />
                <Archive size={25} />
                <span><strong>{t("forgetLater")}</strong><em>{t("futureAction")}</em></span>
                <b>{renderFee(forgetFeeDisplay)}</b>
              </div>
            </div>

            {/*
              * A fee read that has not returned yet is not a fault, and neither
              * is one that settles empty because no wallet/network is bound —
              * that is simply the first-paint state of this app. The panel used
              * to render the amber "Live contract fees are unavailable. No GAS
              * will move until they are verified." warning plus a Retry button
              * on that state, so a visitor's very first screen accused the
              * product of being broken before they had touched it. The warning
              * tone is now reserved for a real settled failure (`feesSettled`
              * with no fees, and no contract-paused explanation); a pending read
              * just narrates itself, and the paused contract states its own case.
              */}
            {!feesReady && (feePhase === "loading" || feesSettled) ? (
              <div
                className="graveyard-fee-status"
                data-tone={feePhase === "loading" ? "pending" : "notice"}
                role="status"
                aria-live="polite"
              >
                <RefreshCw className={isLoading ? "graveyard-spin" : undefined} size={17} />
                <span>
                  <strong>{feePhase === "loading"
                    ? t("checkingLiveFees")
                    : contractPaused ? t("contractPaused") : t("feeNeedsConnectionTitle")}</strong>
                  <em>{feePhase === "loading"
                    ? t("checkingLiveFeesHint")
                    : contractPaused ? t("contractPausedHint") : t("feeNeedsConnectionHint")}</em>
                </span>
                {feePhase === "loading" ? null : (
                  <button type="button" onClick={() => void dispatch("refreshRecords")} disabled={isLoading}>
                    {t("retryFeeCheck")}
                  </button>
                )}
              </div>
            ) : null}

            {!storageHealthy ? (
              <div className="graveyard-fee-status" role="alert">
                <ShieldCheck size={17} />
                <span>
                  <strong>{t("recoveryStorageUnavailableTitle")}</strong>
                  <em>{t("recoveryStorageUnavailable")}</em>
                </span>
              </div>
            ) : null}

            {hasBurialRecovery ? (
              <div className="graveyard-recovery" role="status" aria-live="polite">
                <RefreshCw size={17} />
                <span>
                  <strong>{t("burialRecoveryReady")}</strong>
                  <em>{burialRecoveryPhase === "target-broadcast" ? t("burialRecoveryTargetHint") : t("burialRecoveryDepositHint")}</em>
                  {burialRecoveryTxid ? <b>{compactHash(burialRecoveryTxid)}</b> : null}
                </span>
                <button type="button" onClick={() => void dispatch("refreshRecords")} disabled={isLoading}>
                  {t("refresh")}
                </button>
              </div>
            ) : null}

            <div className="graveyard-wallet-state" data-connected={walletConnected ? "true" : undefined}>
              <WalletCards size={18} />
              <span>
                <strong>{walletConnected ? t("walletReady") : t("walletConnectOnConfirm")}</strong>
                <em>{walletConnected ? compactAddress(walletAddress) : t("walletNotConnected")}</em>
              </span>
            </div>

            <div className="graveyard-hash-preview" data-ready={hashReady ? "true" : undefined}>
              <Hash size={17} />
              <span><strong>{t("hashPreview")}</strong><em>{isHashing ? t("hashing") : compactHash(assetHash, t("hashPending"))}</em></span>
            </div>

            <p className="graveyard-permanence">
              <LockKeyhole size={17} />
              <span>{t("permanentHashWarning")}</span>
            </p>

            <button
              type="button"
              className="graveyard-review-button"
              onClick={() => void handleReview()}
              disabled={!hashReady || busy || !feesReady || burialTargetPending || !storageHealthy}
              data-shake={showWarningShake ? "true" : undefined}
            >
              {isHashing ? <LoaderCircle className="graveyard-spin" size={20} /> : <Archive size={20} />}
              <span><strong>{isHashing ? t("hashing") : burialTargetPending ? t("burialPending") : hasBurialRecovery ? t("recoverBurial") : t("destroyForever")}</strong><em>{burialTargetPending ? t("burialPendingHint") : hasBurialRecovery ? t("recoverBurialHint") : t("reviewBurialHint")}</em></span>
            </button>
            <small>{t("safeRetryHint")}</small>
          </aside>
        </div>

      </section>

      <section id="graveyard-records" className="graveyard-records" data-open={historyOpen ? "true" : undefined}>
        <header>
          {/* This header is the single Burial Records row. A second, identical
              row used to sit directly above it — a shortcut card that rendered
              the same `recentDestructions` title and the same `recordTotal`,
              then scrolled to this very section a few pixels below. Two
              adjacent "Burial Records 0" rows read as a rendering bug, so the
              shortcut is gone and its hint copy lives here instead, where it
              annotates the records the reader is actually looking at. */}
          <span>
            <History size={20} />
            <strong>{t("recentDestructions")}</strong>
            <em>{recordTotal}</em>
            <i>{t("historyAndEpitaphHint")}</i>
          </span>
          <div>
            <button type="button" onClick={() => void dispatch("refreshRecords")} disabled={isLoading}>
              <RefreshCw className={isLoading ? "graveyard-spin" : undefined} size={16} /> {t("refresh")}
            </button>
            <button type="button" onClick={() => setHistoryOpen((open) => !open)} aria-expanded={historyOpen}>
              {historyOpen ? t("close") : t("open")}
            </button>
          </div>
        </header>

        {historyOpen ? (
          <div className="graveyard-records__body">
            <p>{t("historyGuidance")}</p>
            {epitaphRecoveryPhase ? (
              <aside className="graveyard-epitaph-recovery" role="status">
                <span><PenLine size={19} /></span>
                <div>
                  <strong>{t("epitaphRecoveryReady")}</strong>
                  <em>{t("epitaphRecoveryHint", { id: epitaphRecoveryMemoryId })}</em>
                  {epitaphRecoveryTxid ? <b>{compactHash(epitaphRecoveryTxid)}</b> : null}
                </div>
                <button type="button" onClick={() => void dispatch("recoverEpitaph")}>
                  <RefreshCw size={15} /> {t("recoverEpitaphAction")}
                </button>
              </aside>
            ) : !storageHealthy ? (
              <aside className="graveyard-epitaph-recovery is-warning" role="alert">
                <span><ShieldCheck size={19} /></span>
                <div>
                  <strong>{t("recoveryStorageUnavailableTitle")}</strong>
                  <em>{t("recoveryStorageUnavailable")}</em>
                </div>
              </aside>
            ) : null}
            {history.length > 0 ? (
              <ul>
                {history.map((item) => {
                  const confirming = forgetConfirmId === item.id;
                  const forgetting = forgettingId === item.id;
                  const editing = epitaphDraftId === item.id;
                  const recoveringForget = Boolean(forgetRecoveryPhase) && forgetRecoveryMemoryId === item.id;
                  const forgetTargetPending = forgetRecoveryPhase === "target-broadcast";
                  const recoveringEpitaph = Boolean(epitaphRecoveryPhase)
                    && epitaphRecoveryMemoryId === item.id;
                  return (
                    <li key={item.id} data-forgotten={item.forgotten ? "true" : undefined}>
                      <div className="graveyard-record__title">
                        <span>{item.forgotten ? <X size={17} /> : <Archive size={17} />}</span>
                        <div><strong>{compactHash(item.hash || item.id)}</strong><em>#{item.id} · {shortTime(item.time)}</em></div>
                        <b>{item.forgotten ? t("forgotten") : t("destroyed")}</b>
                      </div>
                      {item.epitaph ? <blockquote>{item.epitaph}</blockquote> : null}

                      {confirming ? (
                        <div className="graveyard-record__confirm">
                          <p>{recoveringForget ? t("forgetRecoveryConfirm") : t("forgetConfirmFee", { fee: forgetFeeDisplay })}</p>
                          <button type="button" onClick={() => void dispatch("forgetMemory", item)} disabled={forgetting || !storageHealthy}>
                            {forgetting ? t("destroying") : recoveringForget ? t("recoverForgetAction") : t("forgetConfirmAction")}
                          </button>
                          <button type="button" onClick={() => void dispatch("cancelForget")}>{t("cancel")}</button>
                        </div>
                      ) : null}

                      {editing ? (
                        <div className="graveyard-record__epitaph">
                          <textarea
                            value={epitaphText}
                            onChange={(event) => void dispatch("setEpitaphText", event.target.value)}
                            placeholder={t("epitaphPlaceholder")}
                            maxLength={120}
                            rows={2}
                            disabled={recoveringEpitaph || !storageHealthy}
                          />
                          <small>{recoveringEpitaph ? t("epitaphPendingResolution") : t("epitaphNetworkFee")}</small>
                          <div>
                            {recoveringEpitaph ? (
                              <button type="button" onClick={() => void dispatch("recoverEpitaph")}>
                                {t("recoverEpitaphAction")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void dispatch("saveEpitaph", item)}
                                disabled={epitaphSavingId === item.id || !storageHealthy || Boolean(epitaphRecoveryPhase)}
                              >
                                {t("epitaphSave")}
                              </button>
                            )}
                            <button type="button" onClick={() => void dispatch("cancelEpitaph")}>{t("cancel")}</button>
                          </div>
                        </div>
                      ) : null}

                      {!confirming && !editing ? (
                        <div className="graveyard-record__actions">
                          <button
                            type="button"
                            onClick={() => void dispatch("startEpitaph", item)}
                            disabled={Boolean(epitaphRecoveryPhase) || !storageHealthy}
                            title={epitaphRecoveryPhase ? t("epitaphPendingResolution") : undefined}
                          >
                            <BookOpen size={15} /> {recoveringEpitaph ? t("epitaphPending") : item.epitaph ? t("editEpitaph") : t("addEpitaph")}
                          </button>
                          {!item.forgotten ? (
                            <button type="button" onClick={() => void dispatch("requestForget", item)} disabled={forgetTargetPending || !storageHealthy}>
                              <Archive size={15} /> {recoveringForget && forgetTargetPending ? t("forgetPending") : recoveringForget ? t("recoverForgetAction") : t("forgetAction")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="graveyard-records__empty">
                <BookOpen size={27} />
                <strong>{walletConnected ? t("noDestructions") : t("connectForRecords")}</strong>
                <span>{walletConnected ? t("noDestructionsHint") : t("connectForRecordsHint")}</span>
              </div>
            )}
            {historyTruncated ? (
              <button type="button" className="graveyard-records__more" onClick={() => void dispatch("setShowAllHistory", !showAllHistory)}>
                {showAllHistory ? t("showFewerRecords") : t("showAllRecords")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {showConfirm ? (
        <div className="graveyard-confirm" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !isDestroying) void dispatch("cancelDestroy");
        }}>
          <section
            ref={confirmDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="graveyard-confirm-title"
            aria-describedby="graveyard-confirm-copy graveyard-confirm-warning"
          >
            <div className="graveyard-confirm__mark"><SelectedIcon size={27} /></div>
            <div className="graveyard-confirm__head">
              <span>{t("burialReview")}</span>
              <h2 id="graveyard-confirm-title">{t("confirmTitle")}</h2>
              <p id="graveyard-confirm-copy">{t("confirmText")}</p>
            </div>
            <dl>
              <div><dt>{t("hashPreview")}</dt><dd>{compactHash(assetHash)}</dd></div>
              <div><dt>{t("selectedType")}</dt><dd>{selectedType.label}</dd></div>
              <div><dt>{t("burialFee")}</dt><dd><CoinArt size={22} variant="gas" /> {hasBurialRecovery ? t("prepaidCreditNoNewGas") : renderFee(burialFeeDisplay)}</dd></div>
              <div><dt>{t("walletAction")}</dt><dd>{walletConnected ? compactAddress(walletAddress) : t("connectAtWallet")}</dd></div>
            </dl>
            <div className="graveyard-confirm__route">
              <span><b>1</b>{hasBurialRecovery ? t("routeUseCredit") : t("routeDeposit")}</span>
              <span><b>2</b>{t("routeAnchor")}</span>
              <span><b>3</b>{t("routeEvent")}</span>
            </div>
            <p id="graveyard-confirm-warning" className="graveyard-confirm__warning"><LockKeyhole size={17} /> {t("warningText")}</p>
            <div className="graveyard-confirm__actions">
              <button ref={cancelButtonRef} type="button" onClick={() => void dispatch("cancelDestroy")} disabled={isDestroying}>{t("cancel")}</button>
              <button
                type="button"
                onClick={() => void dispatch("executeDestroy")}
                disabled={isDestroying || !storageHealthy}
              >
                {isDestroying ? <LoaderCircle className="graveyard-spin" size={18} /> : <WalletCards size={18} />}
                {isDestroying ? t("awaitingChain") : walletConnected ? t("confirmDestroy") : t("connectAndBury")}
              </button>
            </div>
            <small>{t("noSuccessBeforeEvent")}</small>
          </section>
        </div>
      ) : null}

      {isDestroying && !showConfirm ? (
        <div className="graveyard-chain-progress" role="status" aria-live="assertive">
          <LoaderCircle className="graveyard-spin" size={22} />
          <span><strong>{t("awaitingChain")}</strong><em>{t("awaitingChainHint")}</em></span>
        </div>
      ) : null}
    </main>
  );
}
