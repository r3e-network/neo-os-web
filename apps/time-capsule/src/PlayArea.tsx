/**
 * PlayArea.tsx — React version of Time Capsule PlayArea.
 */

import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import CapsuleHero from "./components/CapsuleHero";
import CapsuleList from "./components/CapsuleList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const address = str("address");
  const totalCapsules = num("totalCapsules");
  const lockedCount = num("lockedCount");
  const revealedCount = num("revealedCount");
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isProcessing = bool("isProcessing");
  const isBusy = bool("isBusy");
  const canCreate = bool("canCreate");
  const capsules = val<unknown[]>("capsules") ?? [];
  const newCapsule = val<Record<string, unknown> | null>("newCapsule") ?? null;

  return (
    <div className="capsule-play-area">
      <CapsuleHero
        t={t}
        totalCapsules={totalCapsules}
        lockedCount={lockedCount}
        revealedCount={revealedCount}
      />

      {/* Actions */}
      <div className="capsule-actions">
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
              return (
                <div key={String(cap.id)} className={`capsule-item${isLocked ? " locked" : " revealed"}`}>
                  <div className="capsule-item-header">
                    <span className="capsule-id">#{String(cap.id)}</span>
                    <span className={`capsule-badge ${isLocked ? "badge-locked" : "badge-revealed"}`}>
                      {isLocked ? t("locked") || "Locked" : t("revealed") || "Revealed"}
                    </span>
                  </div>
                  {cap.revealed && cap.content && (
                    <p className="capsule-content">{String(cap.content)}</p>
                  )}
                  {isLocked && (
                    <NeoButton
                      variant="secondary"
                      size="sm"
                      loading={isProcessing}
                      disabled={isBusy}
                      onClick={() => dispatch("openCapsule", cap)}
                    >
                      {t("openCapsule") || "Open"}
                    </NeoButton>
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
