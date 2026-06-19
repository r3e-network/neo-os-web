/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

import {
  BellRing,
  Eye,
  EyeOff,
  Gift,
  Landmark,
  LockKeyhole,
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
  { value: 1, labelKey: "categoryPersonal", hintKey: "categoryPersonalHint", icon: UserRound },
  { value: 2, labelKey: "categoryGift", hintKey: "categoryGiftHint", icon: Gift },
  { value: 3, labelKey: "categoryMemorial", hintKey: "categoryMemorialHint", icon: Landmark },
  { value: 4, labelKey: "categoryAnnouncement", hintKey: "categoryAnnouncementHint", icon: BellRing },
  { value: 5, labelKey: "categorySecret", hintKey: "categorySecretHint", icon: LockKeyhole },
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
  const fishCandidates = val<Array<Record<string, unknown>>>("fishCandidates") ?? [];
  const isLoadingCandidates = bool("isLoadingCandidates");
  const newCapsule =
    val<CapsuleFormState>("newCapsule", { title: "", content: "", days: "30", isPublic: false, category: 1 }) ??
    { title: "", content: "", days: "30", isPublic: false, category: 1 };

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
              <span className="capsule-recovery-card__text">{t("prepaidCreditHint")}</span>
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

      <NeoCard title={t("createCapsule")}>
        <div className="capsule-form">
          <NeoInput
            label={t("titleLabel")}
            placeholder={t("titlePlaceholder")}
            value={newCapsule.title ?? ""}
            onChange={(v) => updateForm({ title: v })}
          />
          <NeoInput
            type="textarea"
            label={t("secretMessage")}
            placeholder={t("secretMessagePlaceholder")}
            value={newCapsule.content ?? ""}
            onChange={(v) => updateForm({ content: v })}
          />
          <NeoInput
            type="number"
            label={t("unlockIn")}
            placeholder={t("daysPlaceholder")}
            min={1}
            max={3650}
            value={newCapsule.days ?? "30"}
            onChange={(v) => updateForm({ days: v })}
          />
          <div className="capsule-duration-presets" aria-label={t("durationPresets")}>
            {DURATION_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                className={`capsule-duration-chip${String(newCapsule.days ?? "") === days ? " is-selected" : ""}`}
                aria-pressed={String(newCapsule.days ?? "") === days}
                onClick={() => updateForm({ days })}
              >
                {days}
                {t("daysShort")}
              </button>
            ))}
          </div>
          <div className="capsule-choice-field">
            <span>{t("categoryLabel")}</span>
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
                    className={`capsule-choice-card${Number(newCapsule.category ?? 1) === option.value ? " is-selected" : ""}`}
                    role="radio"
                    aria-checked={Number(newCapsule.category ?? 1) === option.value}
                    onClick={() => updateForm({ category: option.value })}
                  >
                    <span className="capsule-choice-card__icon" aria-hidden="true">
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
          </div>
          <div className="capsule-choice-field">
            <span>{t("visibility")}</span>
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
                <span className="capsule-choice-card__icon" aria-hidden="true">
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
                <span className="capsule-choice-card__icon" aria-hidden="true">
                  <Eye />
                </span>
                <span className="capsule-choice-card__copy">
                  <strong>{t("public")}</strong>
                  <span>{t("publicHint")}</span>
                </span>
              </button>
            </div>
          </div>
          <p className="capsule-storage-note">{t("contentStorageNote")}</p>
          <p className="capsule-storage-note">{t("depositNote")}</p>
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating}
            disabled={!canCreate || isBusy}
            aria-label={t("createCapsuleButton")}
            onClick={() => dispatch("createCapsule")}
          >
            {isCreating
              ? t("creatingCapsule")
              : t("createCapsuleButton")}
          </NeoButton>
        </div>
      </NeoCard>

      <div className="capsule-side-panel">
        <div className="capsule-actions">
          <p className="capsule-actions-eyebrow">{t("fish")}</p>
          <p className="capsule-fish-note">{t("fishDescription")}</p>

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
              <span className="capsule-fish-candidates__title">{t("fishCandidatesTitle")}</span>
              <button
                type="button"
                className="capsule-fish-candidates__refresh"
                disabled={isLoadingCandidates || isBusy}
                onClick={() => dispatch("loadFishCandidates")}
              >
                {isLoadingCandidates ? t("fishCandidatesLoading") : t("fishCandidatesRefresh")}
              </button>
            </div>
            <p className="capsule-fish-note">{t("fishCandidatesHint")}</p>
            {fishCandidates.length === 0 ? (
              <p className="capsule-fish-candidates__empty">
                {isLoadingCandidates ? t("fishCandidatesLoading") : t("fishCandidatesEmpty")}
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
                    unlockTimeMs > 0 ? new Date(unlockTimeMs).toLocaleDateString() : null;
                  return (
                    <li key={id} className="capsule-fish-candidates__item">
                      <div className="capsule-fish-candidates__meta">
                        <span className="capsule-id">#{id}</span>
                        {categoryKey ? (
                          <span className="capsule-category-badge">{t(categoryKey)}</span>
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
                const itemState = isRevealed ? "revealed" : isLocked ? "locked" : "ready";
                const categoryValue = Number(cap.category);
                const categoryKey = CATEGORY_LABEL_KEYS[categoryValue];
                return (
                  <div key={String(cap.id)} className={`capsule-item ${itemState}`}>
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
                      <span className="capsule-category-badge">{t(categoryKey)}</span>
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
                    {!isRevealed && (
                      !isLocked ? (
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
                      )
                    )}
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
