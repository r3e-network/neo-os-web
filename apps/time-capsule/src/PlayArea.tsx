/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

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
  { value: 1, labelKey: "categoryPersonal" },
  { value: 2, labelKey: "categoryGift" },
  { value: 3, labelKey: "categoryMemorial" },
  { value: 4, labelKey: "categoryAnnouncement" },
  { value: 5, labelKey: "categorySecret" },
] as const;

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
          <label className="capsule-select-field">
            <span>{t("categoryLabel")}</span>
            <select
              value={newCapsule.category ?? 1}
              onChange={(e) => updateForm({ category: Number(e.target.value) })}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="capsule-public-toggle">
            <input
              type="checkbox"
              checked={Boolean(newCapsule.isPublic)}
              onChange={(e) => updateForm({ isPublic: e.target.checked })}
            />
            <span className="capsule-checkbox-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="capsule-checkbox-copy">
              <strong>{t("visibility")}</strong>
              {Boolean(newCapsule.isPublic)
                ? t("publicHint")
                : t("privateHint")}
            </span>
          </label>
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
