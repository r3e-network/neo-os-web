import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "../locale/messages";

/**
 * Synchronous device-local checklist store — structurally satisfied by
 * `app.storage.local` (the framework local-storage surface).
 */
export interface ChecklistStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

export interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  auto: boolean;
  /** Auto item whose state can't be evaluated yet (e.g. gas before connect). */
  pending?: boolean;
}

export interface UseHealthScoreReturn {
  checklistItems: Observable<ChecklistItem[]>;
  completedChecklistCount: Observable<number>;
  totalChecklistCount: Observable<number>;
  safetyScore: Observable<number>;
  riskLabel: Observable<string>;
  riskClass: Observable<string>;
  riskIcon: Observable<string>;
  storageAvailable: Observable<boolean>;
  recommendations: Observable<string[]>;
  loadChecklist: () => void;
  saveChecklist: () => void;
  toggleChecklist: (id: string) => void;
}

/**
 * Computes device-local checklist review progress with persistent state.
 *
 * Checklist state persists synchronously via `app.storage.local` (safe-storage
 * backed localStorage). The app passes `storagePrefix: "miniapp-wallet-health:"`
 * to defineMiniApp so the persisted key stays byte-identical to the legacy
 * runtime-cache key ("miniapp-wallet-health:checklist") — existing user data
 * is not orphaned by the framework migration.
 */
export function useHealthScore(
  gasOk: Observable<boolean>,
  hasBalanceEvidence: Observable<boolean>,
  storage: ChecklistStore,
): UseHealthScoreReturn {
  const { t } = createUseI18n(messages)();

  const checklistState: Record<string, boolean> = {};
  // Composed with the app's storagePrefix this resolves to the legacy
  // "miniapp-wallet-health:checklist" localStorage key, byte-for-byte.
  const checklistStorageKey = "checklist";
  const storageAvailable = createObservable(true);
  const checklistRevision = createObservable(0);
  const notifyChecklistChanged = () => {
    checklistRevision.set(checklistRevision.get() + 1);
  };

  const checklistBase = [
    { id: "backup", titleKey: "checklistBackup", descKey: "checklistBackupDesc" },
    { id: "gas", titleKey: "checklistGas", descKey: "checklistGasDesc" },
    { id: "permissions", titleKey: "checklistPermissions", descKey: "checklistPermissionsDesc" },
    { id: "device", titleKey: "checklistDevice", descKey: "checklistDeviceDesc" },
    { id: "hardware", titleKey: "checklistHardware", descKey: "checklistHardwareDesc" },
    { id: "twofa", titleKey: "checklist2fa", descKey: "checklist2faDesc" },
  ] as const;
  const manualChecklistIds: ReadonlySet<string> = new Set(
    checklistBase.filter((item) => item.id !== "gas").map((item) => item.id),
  );

  const checklistItems = createDerived<ChecklistItem[]>(
    () => {
      const balanceObserved = hasBalanceEvidence.get();
      return checklistBase.map((item) => {
        if (item.id === "gas") {
          // The auto GAS check can only be evaluated once a wallet is connected.
          // Before that it is "pending" (shown as "connect to check"), NOT a
          // failed item — so a disconnected user doesn't see a false "top up GAS".
          return {
            id: item.id,
            title: t(item.titleKey),
            desc: balanceObserved ? t(item.descKey) : t("checklistGasPending"),
            done: balanceObserved ? gasOk.get() : false,
            auto: true,
            pending: !balanceObserved,
          };
        }
        return {
          id: item.id,
          title: t(item.titleKey),
          desc: t(item.descKey),
          done: checklistState[item.id] === true,
          auto: false,
        };
      });
    },
    [checklistRevision, gasOk, hasBalanceEvidence],
  );

  const completedChecklistCount = createDerived(
    () => checklistItems.get().filter((item) => item.done).length,
    [checklistItems],
  );
  // Pending auto items (gas before connect) are excluded from the denominator so
  // progress reflects only items that can actually be evaluated or acted on.
  const totalChecklistCount = createDerived(
    () => checklistItems.get().filter((item) => !item.pending).length,
    [checklistItems],
  );

  const safetyScore = createDerived(() => {
    if (totalChecklistCount.get() === 0) return 0;
    const score = (completedChecklistCount.get() / totalChecklistCount.get()) * 100;
    return Math.round(score);
  }, [completedChecklistCount, totalChecklistCount]);

  const riskLabel = createDerived(() => {
    if (completedChecklistCount.get() === 0) return t("reviewNotStarted");
    if (completedChecklistCount.get() >= totalChecklistCount.get()) return t("reviewComplete");
    return t("reviewInProgress");
  }, [completedChecklistCount, totalChecklistCount]);

  const riskClass = createDerived(() => {
    if (completedChecklistCount.get() === 0) return "review-empty";
    if (completedChecklistCount.get() >= totalChecklistCount.get()) return "review-complete";
    return "review-progress";
  }, [completedChecklistCount, totalChecklistCount]);

  const riskIcon = createDerived(() => {
    if (completedChecklistCount.get() >= totalChecklistCount.get()) return "check-circle";
    return "clipboard-check";
  }, [completedChecklistCount, totalChecklistCount]);

  // Per-item recommendation keys so the panel and progress status always agree:
  // every unchecked (non-pending) item contributes a recommendation.
  const RECOMMENDATION_KEY_BY_ID = {
    backup: "recommendationBackup",
    permissions: "recommendationPermissions",
    device: "recommendationDevice",
    hardware: "recommendationHardware",
    twofa: "recommendation2fa",
  } as const;

  const recommendations = createDerived(() => {
    const items: string[] = [];
    // The auto GAS item is only actionable once connected; surface its
    // recommendation only then (a disconnected user can't act on balance).
    if (hasBalanceEvidence.get() && !gasOk.get()) items.push(t("recommendationGasLow"));
    for (const item of checklistBase) {
      if (item.id === "gas") continue;
      const key = RECOMMENDATION_KEY_BY_ID[item.id as keyof typeof RECOMMENDATION_KEY_BY_ID];
      if (key && checklistState[item.id] !== true) {
        items.push(t(key));
      }
    }
    return items;
  }, [checklistRevision, gasOk, hasBalanceEvidence]);

  const loadChecklist = () => {
    try {
      const result = storage.get<Record<string, unknown>>(checklistStorageKey);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        for (const id of manualChecklistIds) {
          if (typeof result[id] === "boolean") checklistState[id] = result[id];
        }
        notifyChecklistChanged();
      }
      storageAvailable.set(true);
    } catch {
      storageAvailable.set(false);
    }
  };

  const saveChecklist = () => {
    try {
      const persisted = Object.fromEntries(
        [...manualChecklistIds]
          .filter((id) => id in checklistState)
          .map((id) => [id, checklistState[id] === true]),
      );
      storage.set(checklistStorageKey, persisted);
      storageAvailable.set(true);
    } catch {
      storageAvailable.set(false);
    }
  };

  const toggleChecklist = (id: string) => {
    if (!manualChecklistIds.has(id)) return;
    checklistState[id] = !checklistState[id];
    notifyChecklistChanged();
    saveChecklist();
  };

  return {
    checklistItems,
    completedChecklistCount,
    totalChecklistCount,
    safetyScore,
    riskLabel,
    riskClass,
    riskIcon,
    storageAvailable,
    recommendations,
    loadChecklist,
    saveChecklist,
    toggleChecklist,
  };
}
