/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  FileText,
  Gift,
  Hourglass,
  Landmark,
  LockKeyhole,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import CapsuleHero from "./components/CapsuleHero";
import CapsuleList from "./components/CapsuleList";
import { normalizeUnlockTimeMs } from "./utils/unlockTime";
import "./PlayArea.scss";

interface CapsuleFormState {
  title?: string;
  content?: string;
  days?: string;
  isPublic?: boolean;
  category?: number;
}

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  {
    value: 1,
    labelKey: "categoryPersonal",
    shortLabelKey: "categoryPersonalShort",
    hintKey: "categoryPersonalHint",
    icon: UserRound,
  },
  {
    value: 2,
    labelKey: "categoryGift",
    shortLabelKey: "categoryGiftShort",
    hintKey: "categoryGiftHint",
    icon: Gift,
  },
  {
    value: 3,
    labelKey: "categoryMemorial",
    shortLabelKey: "categoryMemorialShort",
    hintKey: "categoryMemorialHint",
    icon: Landmark,
  },
  {
    value: 4,
    labelKey: "categoryAnnouncement",
    shortLabelKey: "categoryAnnouncementShort",
    hintKey: "categoryAnnouncementHint",
    icon: BellRing,
  },
  {
    value: 5,
    labelKey: "categorySecret",
    shortLabelKey: "categorySecretShort",
    hintKey: "categorySecretHint",
    icon: LockKeyhole,
  },
] satisfies ReadonlyArray<{
  value: number;
  labelKey: string;
  shortLabelKey: string;
  hintKey: string;
  icon: LucideIcon;
}>;

const DURATION_PRESETS = ["7", "30", "365", "1825"] as const;
type CapsuleActionPreview =
  | "create"
  | "withdrawCredit"
  | "collectTips"
  | "loadFishCandidates"
  | `fish:${string}`
  | `open:${string}`;

const CATEGORY_LABEL_KEYS: Record<number, string> = {
  1: "categoryPersonal",
  2: "categoryGift",
  3: "categoryMemorial",
  4: "categoryAnnouncement",
  5: "categorySecret",
};

interface TimeLockDialProps {
  label: string;
  value: string;
  daysShort: string;
  fill: string;
  unlockPreview: string;
  invalidHint: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: string) => void;
}

function clampDays(value: number): number {
  return Math.min(3650, Math.max(1, value));
}

function TimeLockDial({
  label,
  value,
  daysShort,
  fill,
  unlockPreview,
  invalidHint,
  decreaseLabel,
  increaseLabel,
  onChange,
}: TimeLockDialProps) {
  const numericValue = Number(value);
  const isValid = Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 3650;
  const displayValue = isValid ? String(Math.round(numericValue)) : value;

  const nudge = (direction: 1 | -1) => {
    const base = Number.isFinite(numericValue) ? numericValue : 30;
    onChange(String(clampDays(Math.round(base + direction))));
  };

  return (
    <div
      className={`capsule-time-lock-dial${isValid ? " is-valid" : ""}`}
      style={{ "--capsule-time-fill": fill } as CSSProperties}
    >
      <div className="capsule-time-lock-dial__face" aria-hidden="true">
        <span className="capsule-time-lock-dial__ring" />
        <span className="capsule-time-lock-dial__core">
          <Hourglass size={20} />
        </span>
      </div>
      <div className="capsule-time-lock-dial__console">
        <div className="capsule-time-lock-dial__head">
          <span>{label}</span>
          <strong>{isValid ? unlockPreview : invalidHint}</strong>
        </div>
        <div className="capsule-time-lock-dial__control">
          <button
            type="button"
            aria-label={decreaseLabel}
            disabled={isValid && numericValue <= 1}
            onClick={() => nudge(-1)}
          >
            <Minus size={14} />
          </button>
          <label>
            <input
              aria-label={label}
              type="number"
              min={1}
              max={3650}
              step={1}
              inputMode="numeric"
              value={displayValue}
              onChange={(event) => onChange(event.target.value)}
            />
            <span>{daysShort}</span>
          </label>
          <button
            type="button"
            aria-label={increaseLabel}
            disabled={isValid && numericValue >= 3650}
            onClick={() => nudge(1)}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="capsule-time-lock-dial__track" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, bool, val } = useStateBindings(state);

  const totalCapsules = num("totalCapsules");
  const lockedCount = num("lockedCount");
  const revealedCount = num("revealedCount");
  const isCreating = bool("isCreating");
  const isProcessing = bool("isProcessing");
  const isBusy = bool("isBusy");
  const canCreate = bool("canCreate");
  const hasCredit = bool("hasCredit");
  const reusableCredit = val<string>("reusableCredit", "0") ?? "0";
  const capsules = val<unknown[]>("capsules") ?? [];
  const fishCandidates =
    val<Array<Record<string, unknown>>>("fishCandidates") ?? [];
  const isLoadingCandidates = bool("isLoadingCandidates");
  const [actionPreview, setActionPreview] =
    useState<CapsuleActionPreview | null>(null);
  const actionPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const newCapsule = val<CapsuleFormState>("newCapsule", {
    title: "",
    content: "",
    days: "30",
    isPublic: false,
    category: 1,
  }) ?? { title: "", content: "", days: "30", isPublic: false, category: 1 };
  const selectedCategory =
    CATEGORY_OPTIONS.find(
      (option) => option.value === Number(newCapsule.category ?? 1),
    ) ?? CATEGORY_OPTIONS[0]!;
  const SelectedCategoryIcon = selectedCategory.icon;
  const titlePreview = (newCapsule.title ?? "").trim() || t("untitledCapsule");
  const contentPreview = (newCapsule.content ?? "").trim();
  const dayCount = Number(newCapsule.days ?? "30");
  const unlockPreview =
    Number.isFinite(dayCount) && dayCount >= 1
      ? new Date(Date.now() + dayCount * 86_400_000).toLocaleDateString()
      : t("unlockDateHelper");
  const visibilityLabel = newCapsule.isPublic ? t("public") : t("private");
  const visibilityHint = newCapsule.isPublic
    ? t("publicHint")
    : t("privateHint");
  const messagePreview =
    contentPreview.length > 0
      ? contentPreview.length > 120
        ? `${contentPreview.slice(0, 120)}...`
        : contentPreview
      : t("secretMessagePlaceholder");
  const hasMessageDraft = Boolean((newCapsule.title ?? "").trim() || contentPreview);
  const hasValidLockDuration =
    Number.isFinite(dayCount) && dayCount >= 1 && dayCount <= 3650;
  const timeLockProgress = Number.isFinite(dayCount)
    ? `${Math.max(6, Math.min(100, (Math.log10(dayCount + 1) / Math.log10(3651)) * 100))}%`
    : "6%";
  const createPreview = actionPreview === "create";
  const withdrawCreditPreview = actionPreview === "withdrawCredit";
  const collectTipsPreview = actionPreview === "collectTips";
  const loadFishCandidatesPreview = actionPreview === "loadFishCandidates";
  const fishPreviewId = actionPreview?.startsWith("fish:")
    ? actionPreview.slice("fish:".length)
    : "";
  const openPreviewId = actionPreview?.startsWith("open:")
    ? actionPreview.slice("open:".length)
    : "";
  const hasPreviewAction = actionPreview !== null;
  const isCreateBusy = isCreating || createPreview;
  const isWithdrawCreditBusy = isProcessing || withdrawCreditPreview;
  const isCollectTipsBusy = isProcessing || collectTipsPreview;
  const isLoadFishCandidatesBusy =
    isLoadingCandidates || loadFishCandidatesPreview;
  const isFishBusy = isProcessing || Boolean(fishPreviewId);
  const isOpenBusy = isProcessing || Boolean(openPreviewId);
  const isLocalActionBusy = hasPreviewAction || isCreating || isProcessing;

  const updateForm = (patch: Partial<CapsuleFormState>) => {
    if (state.newCapsule) {
      state.newCapsule.set({ ...newCapsule, ...patch });
    }
  };

  const readyStateClass = canCreate ? " is-ready" : "";
  const sealingStateClass = isCreateBusy ? " is-sealing" : "";

  useEffect(
    () => () => {
      if (actionPreviewTimeout.current !== null) {
        clearTimeout(actionPreviewTimeout.current);
      }
    },
    [],
  );

  const startActionPreview = (action: CapsuleActionPreview) => {
    if (actionPreviewTimeout.current !== null) {
      clearTimeout(actionPreviewTimeout.current);
    }
    setActionPreview(action);
    actionPreviewTimeout.current = setTimeout(() => {
      setActionPreview(null);
      actionPreviewTimeout.current = null;
    }, 1400);
  };

  const handleCreateCapsule = async () => {
    if (!canCreate || isBusy || isCreateBusy || isLocalActionBusy) return;
    startActionPreview("create");
    await dispatch("createCapsule");
  };

  const handleWithdrawCredit = async () => {
    if (isBusy || isWithdrawCreditBusy || isLocalActionBusy) return;
    startActionPreview("withdrawCredit");
    await dispatch("withdrawCredit");
  };

  const handleCollectTips = async () => {
    if (isBusy || isCollectTipsBusy || isLocalActionBusy) return;
    startActionPreview("collectTips");
    await dispatch("withdrawFishRevenue");
  };

  const handleLoadFishCandidates = async () => {
    if (isBusy || isLoadFishCandidatesBusy || isLocalActionBusy) return;
    startActionPreview("loadFishCandidates");
    await dispatch("loadFishCandidates");
  };

  const handleFishCapsule = async (id: string) => {
    if (isBusy || isFishBusy || isLocalActionBusy) return;
    startActionPreview(`fish:${id}`);
    await dispatch("fishCapsule", id);
  };

  const handleOpenCapsule = async (capsule: Record<string, unknown>) => {
    const id = String(capsule.id);
    if (isBusy || isOpenBusy || isLocalActionBusy) return;
    startActionPreview(`open:${id}`);
    await dispatch("openCapsule", capsule);
  };

  const playAreaClassName = [
    "capsule-play-area",
    readyStateClass.trim(),
    sealingStateClass.trim(),
    isFishBusy ? "is-fishing" : "",
    isOpenBusy ? "is-opening" : "",
    isCollectTipsBusy ? "is-collecting" : "",
    isWithdrawCreditBusy ? "is-recovering" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={playAreaClassName}
      aria-busy={isLocalActionBusy || undefined}
    >
      <CapsuleHero
        t={t}
        totalCapsules={totalCapsules}
        lockedCount={lockedCount}
        revealedCount={revealedCount}
      />

      {hasCredit && (
        <NeoCard
          variant="erobo"
          className={`capsule-recovery-card${isWithdrawCreditBusy ? " is-recovering" : ""}`}
        >
          <div className="capsule-recovery-card__body">
            <div className="capsule-recovery-card__copy">
              <span className="capsule-recovery-card__title">
                {t("prepaidCreditLabel")} · {reusableCredit} {t("tokenGas")}
              </span>
              <span className="capsule-recovery-card__text">
                {t("prepaidCreditHint")}
              </span>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isWithdrawCreditBusy}
              disabled={isBusy || isWithdrawCreditBusy || isLocalActionBusy}
              aria-label={t("withdrawCredit")}
              onClick={handleWithdrawCredit}
            >
              {isWithdrawCreditBusy ? t("withdrawingCredit") : t("withdrawCredit")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      <section
        className={`capsule-seal-workbench${readyStateClass}${sealingStateClass}`}
        aria-label={t("createCapsule")}
        aria-busy={isCreateBusy || undefined}
      >
        <header className="capsule-section-head">
          <span aria-hidden="true">
            <Sparkles size={19} />
          </span>
          <div>
            <small>{t("sealWorkbenchEyebrow")}</small>
            <h3>{t("createCapsule")}</h3>
            <p>{t("sealWorkbenchCopy")}</p>
          </div>
        </header>

        <div className="capsule-seal-layout">
          <div className="capsule-seal-form">
            <section
              className="capsule-seal-panel"
              aria-label={t("messageStage")}
            >
              <div className="capsule-panel-head">
                <FileText size={18} aria-hidden="true" />
                <span>
                  <strong>{t("messageStage")}</strong>
                  <small>{t("messageStageCopy")}</small>
                </span>
              </div>
              <div
                className={[
                  "capsule-letter-dock",
                  hasMessageDraft ? "is-writing" : "",
                  canCreate ? "is-ready" : "",
                  isCreateBusy ? "is-sealing" : "",
                ].filter(Boolean).join(" ")}
                aria-label={t("letterDockLabel")}
              >
                <span className="capsule-letter-dock__stamp" aria-hidden="true">
                  <SelectedCategoryIcon size={18} />
                </span>
                <span className="capsule-letter-dock__copy">
                  <small>{t("letterDockKicker")}</small>
                  <strong>{titlePreview}</strong>
                  <span>
                    {contentPreview
                      ? t("letterDockCount", { count: contentPreview.length })
                      : t("letterDockEmpty")}
                  </span>
                </span>
                <span className="capsule-letter-dock__rail" aria-hidden="true">
                  <span />
                </span>
                <span className="capsule-letter-dock__seal" aria-hidden="true">
                  <LockKeyhole size={16} />
                </span>
              </div>
              <NeoInput
                label={t("titleLabel")}
                placeholder={t("titlePlaceholder")}
                value={newCapsule.title ?? ""}
                onChange={(v) => updateForm({ title: v })}
              />
              <NeoInput
                className="capsule-message-input"
                type="textarea"
                label={t("secretMessage")}
                placeholder={t("secretMessagePlaceholder")}
                value={newCapsule.content ?? ""}
                onChange={(v) => updateForm({ content: v })}
              />
            </section>

            <section
              className="capsule-seal-panel"
              aria-label={t("timeLockStage")}
            >
              <div className="capsule-panel-head">
                <CalendarClock size={18} aria-hidden="true" />
                <span>
                  <strong>{t("timeLockStage")}</strong>
                  <small>{t("timeLockStageCopy")}</small>
                </span>
              </div>
              <div className="capsule-duration-row">
                <TimeLockDial
                  label={t("unlockIn")}
                  value={newCapsule.days ?? "30"}
                  daysShort={t("daysShort")}
                  fill={timeLockProgress}
                  unlockPreview={unlockPreview}
                  invalidHint={t("unlockDateHelper")}
                  decreaseLabel={t("decreaseLockDuration")}
                  increaseLabel={t("increaseLockDuration")}
                  onChange={(v) => updateForm({ days: v })}
                />
                <div
                  className="capsule-duration-presets"
                  aria-label={t("durationPresets")}
                >
                  {DURATION_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`capsule-duration-chip${
                        String(newCapsule.days ?? "") === days
                          ? " is-selected"
                          : ""
                      }`}
                      aria-pressed={String(newCapsule.days ?? "") === days}
                      onClick={() => updateForm({ days })}
                    >
                      {days}
                      {t("daysShort")}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="capsule-seal-panel"
              aria-label={t("categoryLabel")}
            >
              <div className="capsule-panel-head">
                <SelectedCategoryIcon size={18} aria-hidden="true" />
                <span>
                  <strong>{t("categoryLabel")}</strong>
                  <small>{t("categoryStageCopy")}</small>
                </span>
              </div>
              <div
                className="capsule-category-grid"
                role="radiogroup"
                aria-label={t("categoryLabel")}
              >
                {CATEGORY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`capsule-choice-card${
                        Number(newCapsule.category ?? 1) === option.value
                          ? " is-selected"
                          : ""
                      }`}
                      role="radio"
                      aria-label={`${t(option.labelKey)} ${t(option.hintKey)}`}
                      aria-checked={
                        Number(newCapsule.category ?? 1) === option.value
                      }
                      onClick={() => updateForm({ category: option.value })}
                    >
                      <span
                        className="capsule-choice-card__icon"
                        aria-hidden="true"
                      >
                        <Icon />
                      </span>
                      <span className="capsule-choice-card__copy">
                        <strong>
                          <span className="capsule-choice-card__label-full">
                            {t(option.labelKey)}
                          </span>
                          <span className="capsule-choice-card__label-short">
                            {t(option.shortLabelKey)}
                          </span>
                        </strong>
                        <span>{t(option.hintKey)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              className="capsule-seal-panel"
              aria-label={t("visibility")}
            >
              <div className="capsule-panel-head">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>{t("visibility")}</strong>
                  <small>{t("visibilityStageCopy")}</small>
                </span>
              </div>
              <div
                className="capsule-visibility-grid"
                role="radiogroup"
                aria-label={t("visibility")}
              >
                <button
                  type="button"
                  className={`capsule-choice-card${!newCapsule.isPublic ? " is-selected" : ""}`}
                  role="radio"
                  aria-checked={!newCapsule.isPublic}
                  onClick={() => updateForm({ isPublic: false })}
                >
                  <span
                    className="capsule-choice-card__icon"
                    aria-hidden="true"
                  >
                    <EyeOff />
                  </span>
                  <span className="capsule-choice-card__copy">
                    <strong>{t("private")}</strong>
                    <span>{t("privateHint")}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`capsule-choice-card${newCapsule.isPublic ? " is-selected" : ""}`}
                  role="radio"
                  aria-checked={Boolean(newCapsule.isPublic)}
                  onClick={() => updateForm({ isPublic: true })}
                >
                  <span
                    className="capsule-choice-card__icon"
                    aria-hidden="true"
                  >
                    <Eye />
                  </span>
                  <span className="capsule-choice-card__copy">
                    <strong>{t("public")}</strong>
                    <span>{t("publicHint")}</span>
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div className="capsule-mobile-action">
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isCreateBusy}
              disabled={!canCreate || isBusy || isCreateBusy || isLocalActionBusy}
              aria-label={t("createCapsuleButton")}
              onClick={handleCreateCapsule}
            >
              {isCreateBusy ? t("creatingCapsule") : t("createCapsuleButton")}
            </NeoButton>
            <span>
              <CheckCircle2 size={15} aria-hidden="true" />
              {t("depositNote")}
            </span>
          </div>

          <aside
            className={`capsule-preview-panel${readyStateClass}${sealingStateClass}`}
            aria-label={t("sealPreview")}
            aria-busy={isCreateBusy || undefined}
          >
            <div className="capsule-preview-device">
              <img
                className="capsule-preview-device__stage"
                src="./time-capsule-stage.jpg"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              <span className="capsule-preview-device__icon" aria-hidden="true">
                <SelectedCategoryIcon size={23} />
              </span>
              <small>{t("sealPreview")}</small>
              <strong>{titlePreview}</strong>
              <p>{messagePreview}</p>
            </div>
            <div
              className={[
                "capsule-game-board",
                hasMessageDraft ? "is-draft" : "",
                canCreate ? "is-ready" : "",
                isCreateBusy ? "is-sealing" : "",
              ].filter(Boolean).join(" ")}
              aria-label={t("capsuleBoardTitle")}
            >
              <picture className="capsule-game-token" aria-hidden="true">
                <source srcSet="./logo.avif" type="image/avif" />
                <source srcSet="./logo.webp" type="image/webp" />
                <img
                  src="./logo.jpg"
                  alt=""
                  loading="eager"
                  decoding="sync"
                />
              </picture>
              <span className={`capsule-game-slot capsule-game-slot--draft${hasMessageDraft ? " is-active" : ""}`}>
                <FileText size={16} aria-hidden="true" />
                <small>{t("capsuleBoardDraft")}</small>
                <strong>{titlePreview}</strong>
              </span>
              <span className={`capsule-game-slot capsule-game-slot--seal${canCreate ? " is-active" : ""}${isCreateBusy ? " is-sealing" : ""}`}>
                <LockKeyhole size={16} aria-hidden="true" />
                <small>{isCreateBusy ? t("creatingCapsule") : t("capsuleBoardReadySeal")}</small>
                <strong>{hasValidLockDuration ? unlockPreview : t("unlockDateHelper")}</strong>
              </span>
              <span className={`capsule-game-slot capsule-game-slot--unlock${hasValidLockDuration ? " is-active" : ""}`}>
                <Hourglass size={16} aria-hidden="true" />
                <small>{t("capsuleBoardLocked")}</small>
                <strong>{visibilityLabel}</strong>
              </span>
            </div>
            <div className="capsule-preview-grid">
              <span>
                <CalendarClock size={15} aria-hidden="true" />
                <small>{t("unlockPreview")}</small>
                <strong>{unlockPreview}</strong>
              </span>
              <span>
                <ShieldCheck size={15} aria-hidden="true" />
                <small>{visibilityLabel}</small>
                <strong>{visibilityHint}</strong>
              </span>
              <span>
                <Coins size={15} aria-hidden="true" />
                <small>{t("depositLabel")}</small>
                <strong>0.2 GAS</strong>
              </span>
              <span>
                <CheckCircle2 size={15} aria-hidden="true" />
                <small>{t("storageLabel")}</small>
                <strong>{t("hashStored")}</strong>
              </span>
            </div>
            <div className="capsule-note-stack">
              <span>
                <LockKeyhole size={16} aria-hidden="true" />
                {t("contentStorageNote")}
              </span>
              <span>
                <Hourglass size={16} aria-hidden="true" />
                {t("depositNote")}
              </span>
            </div>
            <div className="capsule-preview-primary">
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isCreateBusy}
                disabled={!canCreate || isBusy || isCreateBusy || isLocalActionBusy}
                aria-label={t("createCapsuleButton")}
                onClick={handleCreateCapsule}
              >
                {isCreateBusy ? t("creatingCapsule") : t("createCapsuleButton")}
              </NeoButton>
            </div>
          </aside>
        </div>
      </section>

      <div className="capsule-side-panel">
        <div
          className={[
            "capsule-actions",
            isFishBusy ? "is-fishing" : "",
            isCollectTipsBusy ? "is-collecting" : "",
            isLoadFishCandidatesBusy ? "is-loading-candidates" : "",
          ].filter(Boolean).join(" ")}
          aria-busy={
            isFishBusy || isCollectTipsBusy || isLoadFishCandidatesBusy || undefined
          }
        >
          <div className="capsule-actions-head">
            <span aria-hidden="true">
              <Gift size={18} />
            </span>
            <div>
              <small>{t("fish")}</small>
              <strong>{t("fishSummary")}</strong>
            </div>
          </div>

          <div className="capsule-tip-facts">
            <span>
              <Coins size={15} aria-hidden="true" />
              {t("fishFactTip")}
            </span>
            <span>
              <LockKeyhole size={15} aria-hidden="true" />
              {t("fishFactSealed")}
            </span>
            <span>
              <CheckCircle2 size={15} aria-hidden="true" />
              {t("fishFactCharged")}
            </span>
          </div>

          <div
            className={`capsule-collect-tips${isCollectTipsBusy ? " is-collecting" : ""}`}
          >
            <span className="capsule-fish-note">{t("collectTipsHint")}</span>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isCollectTipsBusy}
              disabled={isBusy || isCollectTipsBusy || isLocalActionBusy}
              aria-label={t("collectTips")}
              onClick={handleCollectTips}
            >
              {isCollectTipsBusy ? t("collectingTips") : t("collectTips")}
            </NeoButton>
          </div>

          <div className="capsule-fish-candidates">
            <div className="capsule-fish-candidates__head">
              <span className="capsule-fish-candidates__title">
                {t("fishCandidatesTitle")}
              </span>
              <button
                type="button"
                className={`capsule-fish-candidates__refresh${isLoadFishCandidatesBusy ? " is-loading" : ""}`}
                disabled={isLoadFishCandidatesBusy || isBusy || isLocalActionBusy}
                onClick={handleLoadFishCandidates}
              >
                {isLoadFishCandidatesBusy
                  ? t("fishCandidatesLoading")
                  : t("fishCandidatesRefresh")}
              </button>
            </div>
            <p className="capsule-fish-note">{t("fishCandidatesHint")}</p>
            {fishCandidates.length === 0 ? (
              <p className="capsule-fish-candidates__empty">
                {isLoadingCandidates
                  ? t("fishCandidatesLoading")
                  : t("fishCandidatesEmpty")}
              </p>
            ) : (
              <ul className="capsule-fish-candidates__list">
                {fishCandidates.map((cap) => {
                  const id = String(cap.id);
                  const isThisFishBusy =
                    isProcessing || fishPreviewId === id;
                  const categoryKey = CATEGORY_LABEL_KEYS[Number(cap.category)];
                  const unlockTimeMs = normalizeUnlockTimeMs(
                    cap.unlockTimestamp ?? cap.unlockTime,
                  );
                  const unlockDateLabel =
                    unlockTimeMs > 0
                      ? new Date(unlockTimeMs).toLocaleDateString()
                      : null;
                  return (
                    <li
                      key={id}
                      className={`capsule-fish-candidates__item${isThisFishBusy ? " is-fishing" : ""}`}
                      aria-busy={isThisFishBusy || undefined}
                    >
                      <div className="capsule-fish-candidates__meta">
                        <span className="capsule-id">#{id}</span>
                        {categoryKey ? (
                          <span className="capsule-category-badge">
                            {t(categoryKey)}
                          </span>
                        ) : null}
                        {unlockDateLabel ? (
                          <span className="capsule-unlock-meta">
                            {t("unlocks")} {unlockDateLabel}
                          </span>
                        ) : null}
                      </div>
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        loading={isThisFishBusy}
                        disabled={isBusy || isThisFishBusy || isLocalActionBusy}
                        aria-label={t("fishTipThis")}
                        onClick={() => handleFishCapsule(id)}
                      >
                        {t("fishTipThis")}
                      </NeoButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <NeoCard title={t("yourCapsules")}>
          {capsules.length === 0 ? (
            <CapsuleList t={t} totalCapsules={totalCapsules} />
          ) : (
            <div className="capsule-grid">
              {(capsules as Array<Record<string, unknown>>).map((cap) => {
                const isRevealed = Boolean(cap.revealed);
                const unlockTimeMs = normalizeUnlockTimeMs(
                  cap.unlockTimestamp ?? cap.unlockTime,
                );
                const isUnlockable =
                  !isRevealed && unlockTimeMs > 0 && Date.now() >= unlockTimeMs;
                const isLocked =
                  Boolean(cap.locked ?? !isRevealed) && !isUnlockable;
                const unlockDateLabel =
                  unlockTimeMs > 0
                    ? new Date(unlockTimeMs).toLocaleDateString()
                    : null;
                const itemState = isRevealed
                  ? "revealed"
                  : isLocked
                    ? "locked"
                    : "ready";
                const isThisOpenBusy =
                  isProcessing || openPreviewId === String(cap.id);
                const categoryValue = Number(cap.category);
                const categoryKey = CATEGORY_LABEL_KEYS[categoryValue];
                return (
                  <div
                    key={String(cap.id)}
                    className={`capsule-item capsule-board-card capsule-board-card--${itemState} ${itemState}${isThisOpenBusy ? " is-opening" : ""}`}
                    aria-busy={isThisOpenBusy || undefined}
                  >
                    <div className="capsule-item-header">
                      <span className={`capsule-item-state-icon capsule-item-state-icon--${itemState}`} aria-hidden="true">
                        {isRevealed ? (
                          <Eye size={16} />
                        ) : isLocked ? (
                          <LockKeyhole size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                      </span>
                      <span className="capsule-id">#{String(cap.id)}</span>
                      <span className={`capsule-badge badge-${itemState}`}>
                        {isRevealed
                          ? t("revealed")
                          : isLocked
                            ? t("locked")
                            : t("unlocked")}
                      </span>
                    </div>
                    {categoryKey ? (
                      <span className="capsule-category-badge">
                        {t(categoryKey)}
                      </span>
                    ) : null}
                    {cap.title ? (
                      <p className="capsule-title">{String(cap.title)}</p>
                    ) : null}
                    {unlockDateLabel && (
                      <p className="capsule-unlock-meta">
                        {t("unlocks")} {unlockDateLabel}
                      </p>
                    )}
                    {cap.revealed && cap.content ? (
                      <p className="capsule-content">{String(cap.content)}</p>
                    ) : null}
                    {!isRevealed &&
                      (!isLocked ? (
                        <NeoButton
                          variant="secondary"
                          size="sm"
                          loading={isThisOpenBusy}
                          disabled={isBusy || isThisOpenBusy || isLocalActionBusy}
                          onClick={() => handleOpenCapsule(cap)}
                        >
                          {t("open")}
                        </NeoButton>
                      ) : (
                        <span className="capsule-locked-hint">
                          {t("notUnlockedYet")}
                        </span>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </NeoCard>
      </div>
    </div>
  );
}
