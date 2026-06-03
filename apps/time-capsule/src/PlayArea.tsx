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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, bool, val } = useStateBindings(state);

  const totalCapsules = num("totalCapsules");
  const lockedCount = num("lockedCount");
  const revealedCount = num("revealedCount");
  const isCreating = bool("isCreating");
  const isProcessing = bool("isProcessing");
  const isBusy = bool("isBusy");
  const canCreate = bool("canCreate");
  const capsules = val<unknown[]>("capsules") ?? [];
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

      <NeoCard title={t("createCapsule") || "Create Capsule"}>
        <div className="capsule-form">
          <NeoInput
            label={t("titleLabel") || "Capsule Title"}
            placeholder={t("titlePlaceholder") || "Give your capsule a name"}
            value={newCapsule.title ?? ""}
            onChange={(v) => updateForm({ title: v })}
          />
          <NeoInput
            type="textarea"
            label={t("secretMessage") || "Secret Message"}
            placeholder={t("secretMessagePlaceholder") || "Enter your secret message"}
            value={newCapsule.content ?? ""}
            onChange={(v) => updateForm({ content: v })}
          />
          <NeoInput
            type="number"
            label={t("unlockIn") || "Lock Duration"}
            placeholder={t("daysPlaceholder") || "30"}
            min={1}
            max={3650}
            value={newCapsule.days ?? "30"}
            onChange={(v) => updateForm({ days: v })}
          />
          <label className="capsule-select-field">
            <span>{t("categoryLabel") || "Category"}</span>
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
            <span>
              <strong>{t("visibility") || "Visibility"}</strong>
              {Boolean(newCapsule.isPublic)
                ? t("publicHint") || "Anyone can reveal after unlock"
                : t("privateHint") || "Only you can reveal after unlock"}
            </span>
          </label>
          <p className="capsule-storage-note">{t("contentStorageNote")}</p>
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating}
            disabled={!canCreate || isBusy}
            aria-label={t("createCapsuleButton") || "Create Capsule"}
            onClick={() => dispatch("createCapsule")}
          >
            {isCreating
              ? t("creatingCapsule") || "Sealing capsule..."
              : t("createCapsuleButton") || "Create Capsule"}
          </NeoButton>
        </div>
      </NeoCard>

      <div className="capsule-side-panel">
        <div className="capsule-actions">
          <p className="capsule-actions-eyebrow">{t("fish") || "Fish a capsule"}</p>
          <NeoButton
            variant="secondary"
            size="lg"
            block
            loading={isProcessing}
            disabled={isBusy}
            aria-label={t("fishButton") || "Fish for Capsule"}
            onClick={() => dispatch("fishCapsule")}
          >
            {isProcessing ? t("fishing") || "Fishing..." : t("fishButton") || "Fish for Capsule"}
          </NeoButton>
          <p className="capsule-fish-note">{t("fishDescription")}</p>
        </div>

        <NeoCard title={t("yourCapsules") || "Capsules"}>
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
                return (
                  <div key={String(cap.id)} className={`capsule-item ${itemState}`}>
                    <div className="capsule-item-header">
                      <span className="capsule-id">#{String(cap.id)}</span>
                      <span className={`capsule-badge badge-${itemState}`}>
                        {isRevealed
                          ? t("revealed") || "Revealed"
                          : isLocked
                            ? t("locked") || "Locked"
                            : t("unlocked") || "Unlocked"}
                      </span>
                    </div>
                    {cap.title ? (
                      <p className="capsule-title">{String(cap.title)}</p>
                    ) : null}
                    {unlockDateLabel && (
                      <p className="capsule-unlock-meta">
                        {t("unlocks") || "Unlocks:"} {unlockDateLabel}
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
                          {t("open") || "Open Capsule"}
                        </NeoButton>
                      ) : (
                        <span className="capsule-locked-hint">
                          {t("notUnlockedYet") || "Not unlocked yet"}
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
