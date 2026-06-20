/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

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
    hintKey: "categoryPersonalHint",
    icon: UserRound,
  },
  {
    value: 2,
    labelKey: "categoryGift",
    hintKey: "categoryGiftHint",
    icon: Gift,
  },
  {
    value: 3,
    labelKey: "categoryMemorial",
    hintKey: "categoryMemorialHint",
    icon: Landmark,
  },
  {
    value: 4,
    labelKey: "categoryAnnouncement",
    hintKey: "categoryAnnouncementHint",
    icon: BellRing,
  },
  {
    value: 5,
    labelKey: "categorySecret",
    hintKey: "categorySecretHint",
    icon: LockKeyhole,
  },
] satisfies ReadonlyArray<{
  value: number;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
}>;

const DURATION_PRESETS = ["7", "30", "365", "1825"] as const;

const CATEGORY_LABEL_KEYS: Record<number, string> = {
  1: "categoryPersonal",
  2: "categoryGift",
  3: "categoryMemorial",
  4: "categoryAnnouncement",
  5: "categorySecret",
};

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
    ) ?? CATEGORY_OPTIONS[0];
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

  const updateForm = (patch: Partial<CapsuleFormState>) => {
    if (state.newCapsule) {
      state.newCapsule.set({ ...newCapsule, ...patch });
    }
  };

  return (
    <div className="capsule-play-area">
      <CapsuleHero
        t={t}
        totalCapsules={totalCapsules}
        lockedCount={lockedCount}
        revealedCount={revealedCount}
      />

      {hasCredit && (
        <NeoCard variant="erobo" className="capsule-recovery-card">
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
              loading={isProcessing}
              disabled={isBusy}
              aria-label={t("withdrawCredit")}
              onClick={() => dispatch("withdrawCredit")}
            >
              {isProcessing ? t("withdrawingCredit") : t("withdrawCredit")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      <section
        className="capsule-seal-workbench"
        aria-label={t("createCapsule")}
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
                <NeoInput
                  type="number"
                  label={t("unlockIn")}
                  placeholder={t("daysPlaceholder")}
                  min={1}
                  max={3650}
                  value={newCapsule.days ?? "30"}
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
                        <strong>{t(option.labelKey)}</strong>
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

          <aside
            className="capsule-preview-panel"
            aria-label={t("sealPreview")}
          >
            <div className="capsule-preview-device">
              <span className="capsule-preview-device__icon" aria-hidden="true">
                <SelectedCategoryIcon size={23} />
              </span>
              <small>{t("sealPreview")}</small>
              <strong>{titlePreview}</strong>
              <p>{messagePreview}</p>
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
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isCreating}
              disabled={!canCreate || isBusy}
              aria-label={t("createCapsuleButton")}
              onClick={() => dispatch("createCapsule")}
            >
              {isCreating ? t("creatingCapsule") : t("createCapsuleButton")}
            </NeoButton>
          </aside>
        </div>
      </section>

      <div className="capsule-side-panel">
        <div className="capsule-actions">
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

          <div className="capsule-collect-tips">
            <span className="capsule-fish-note">{t("collectTipsHint")}</span>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isProcessing}
              disabled={isBusy}
              aria-label={t("collectTips")}
              onClick={() => dispatch("withdrawFishRevenue")}
            >
              {isProcessing ? t("collectingTips") : t("collectTips")}
            </NeoButton>
          </div>

          <div className="capsule-fish-candidates">
            <div className="capsule-fish-candidates__head">
              <span className="capsule-fish-candidates__title">
                {t("fishCandidatesTitle")}
              </span>
              <button
                type="button"
                className="capsule-fish-candidates__refresh"
                disabled={isLoadingCandidates || isBusy}
                onClick={() => dispatch("loadFishCandidates")}
              >
                {isLoadingCandidates
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
                  const categoryKey = CATEGORY_LABEL_KEYS[Number(cap.category)];
                  const unlockTimeMs = normalizeUnlockTimeMs(
                    cap.unlockTimestamp ?? cap.unlockTime,
                  );
                  const unlockDateLabel =
                    unlockTimeMs > 0
                      ? new Date(unlockTimeMs).toLocaleDateString()
                      : null;
                  return (
                    <li key={id} className="capsule-fish-candidates__item">
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
                        loading={isProcessing}
                        disabled={isBusy}
                        aria-label={t("fishTipThis")}
                        onClick={() => dispatch("fishCapsule", id)}
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
                const categoryValue = Number(cap.category);
                const categoryKey = CATEGORY_LABEL_KEYS[categoryValue];
                return (
                  <div
                    key={String(cap.id)}
                    className={`capsule-item ${itemState}`}
                  >
                    <div className="capsule-item-header">
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
                          loading={isProcessing}
                          disabled={isBusy}
                          onClick={() => dispatch("openCapsule", cap)}
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
