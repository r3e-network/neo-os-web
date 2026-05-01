/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import CapsuleHero from "./components/CapsuleHero";
import CapsuleList from "./components/CapsuleList";
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

      {/* New Capsule Form */}
      <NeoCard title={t("createCapsule") || "Create Capsule"}>
        <div className="capsule-form">
          <NeoInput
            label={t("capsuleTitle") || "Title"}
            placeholder={t("capsuleTitlePlaceholder") || "A note to your future self"}
            value={newCapsule.title ?? ""}
            onChange={(v) => updateForm({ title: v })}
          />
          <NeoInput
            type="textarea"
            label={t("capsuleContent") || "Content"}
            placeholder={t("capsuleContentPlaceholder") || "Anything — text, a memory, advice..."}
            value={newCapsule.content ?? ""}
            onChange={(v) => updateForm({ content: v })}
          />
          <NeoInput
            type="number"
            label={t("capsuleDays") || "Lock for (days)"}
            placeholder="30"
            min={1}
            max={3650}
            value={newCapsule.days ?? "30"}
            onChange={(v) => updateForm({ days: v })}
          />
          <label className="capsule-public-toggle">
            <input
              type="checkbox"
              checked={Boolean(newCapsule.isPublic)}
              onChange={(e) => updateForm({ isPublic: e.target.checked })}
            />
            <span>{t("capsulePublic") || "Make publicly fishable"}</span>
          </label>
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating}
            disabled={!canCreate || isBusy}
            aria-label={t("createCapsule") || "Create Capsule"}
            onClick={() => dispatch("createCapsule")}
          >
            {isCreating ? t("creating") || "Creating..." : t("createCapsule") || "Create Capsule"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Fish action */}
      <div className="capsule-actions">
        <NeoButton
          variant="secondary"
          size="lg"
          block
          loading={isProcessing}
          disabled={isBusy}
          aria-label={t("fishCapsule") || "Fish for Capsule"}
          onClick={() => dispatch("fishCapsule")}
        >
          {isProcessing ? t("fishing") || "Fishing..." : t("fishCapsule") || "Fish for Capsule"}
        </NeoButton>
      </div>

      {/* Capsule List */}
      <NeoCard title={t("capsules") || "Capsules"}>
        {capsules.length === 0 ? (
          <CapsuleList t={t} totalCapsules={totalCapsules} />
        ) : (
          <div className="capsule-grid">
            {(capsules as Array<Record<string, unknown>>).map((cap) => {
              const isLocked = !cap.revealed;
              const unlockTimeRaw = Number(cap.unlockTimestamp ?? cap.unlockTime ?? 0);
              const isUnlockable =
                unlockTimeRaw > 0 && Date.now() >= unlockTimeRaw;
              const unlockDateLabel =
                unlockTimeRaw > 0
                  ? new Date(unlockTimeRaw).toLocaleDateString()
                  : null;
              return (
                <div key={String(cap.id)} className={`capsule-item${isLocked ? " locked" : " revealed"}`}>
                  <div className="capsule-item-header">
                    <span className="capsule-id">#{String(cap.id)}</span>
                    <span className={`capsule-badge ${isLocked ? "badge-locked" : "badge-revealed"}`}>
                      {isLocked ? t("locked") || "Locked" : t("revealed") || "Revealed"}
                    </span>
                  </div>
                  {cap.title ? (
                    <p className="capsule-title">{String(cap.title)}</p>
                  ) : null}
                  {unlockDateLabel && (
                    <p className="capsule-unlock-meta">
                      {t("unlocksOn") || "Unlocks"}: {unlockDateLabel}
                    </p>
                  )}
                  {cap.revealed && cap.content ? (
                    <p className="capsule-content">{String(cap.content)}</p>
                  ) : null}
                  {isLocked && (
                    isUnlockable ? (
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        loading={isProcessing}
                        disabled={isBusy}
                        onClick={() => dispatch("openCapsule", cap)}
                      >
                        {t("openCapsule") || "Open"}
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
  );
}
