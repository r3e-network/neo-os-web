import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

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
  recommendations: Observable<string[]>;
  loadChecklist: () => void;
  saveChecklist: () => void;
  toggleChecklist: (id: string) => void;
}

/**
 * Computes wallet health score from a security checklist with persistent state.
 *
 * Checklist state persists synchronously via `app.storage.local` (safe-storage
 * backed localStorage). The app passes `storagePrefix: "miniapp-wallet-health:"`
 * to defineMiniApp so the persisted key stays byte-identical to the legacy
 * runtime-cache key ("miniapp-wallet-health:checklist") — existing user data
 * is not orphaned by the framework migration.
 */
export function useHealthScore(
  gasOk: Observable<boolean>,
  isConnected: Observable<boolean>,
  storage: ChecklistStore,
): UseHealthScoreReturn {
  const { t } = createUseI18n(messages)();

  const checklistState: Record<string, boolean> = {};
  // Composed with the app's storagePrefix this resolves to the legacy
  // "miniapp-wallet-health:checklist" localStorage key, byte-for-byte.
  const checklistStorageKey = "checklist";
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

  const checklistItems = createDerived<ChecklistItem[]>(
    () => {
      const connected = isConnected.get();
      return checklistBase.map((item) => {
        if (item.id === "gas") {
          // The auto GAS check can only be evaluated once a wallet is connected.
          // Before that it is "pending" (shown as "connect to check"), NOT a
          // failed item — so a disconnected user doesn't see a false "top up GAS".
          return {
            id: item.id,
            title: t(item.titleKey),
            desc: connected ? t(item.descKey) : t("checklistGasPending"),
            done: connected ? gasOk.get() : false,
            auto: true,
            pending: !connected,
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
    [checklistRevision, gasOk, isConnected],
  );

  const completedChecklistCount = createDerived(
    () => checklistItems.get().filter((item) => item.done).length,
    [checklistItems],
  );
  // Pending auto items (gas before connect) are excluded from the denominator so
  // the score reflects only items that can actually be evaluated/acted on.
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
    if (safetyScore.get() >= 80) return t("riskLow");
    if (safetyScore.get() >= 50) return t("riskMedium");
    return t("riskHigh");
  }, [safetyScore]);

  const riskClass = createDerived(() => {
    if (safetyScore.get() >= 80) return "risk-low";
    if (safetyScore.get() >= 50) return "risk-medium";
    return "risk-high";
  }, [safetyScore]);

  const riskIcon = createDerived(() => {
    if (safetyScore.get() >= 80) return "check-circle";
    if (safetyScore.get() >= 50) return "alert-circle";
    return "alert-circle";
  }, [safetyScore]);

  // Per-item recommendation keys so the panel and the score/risk chip always
  // agree: every unchecked (non-pending) item contributes a recommendation.
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
    if (isConnected.get() && !gasOk.get()) items.push(t("recommendationGasLow"));
    for (const item of checklistBase) {
      if (item.id === "gas") continue;
      const key = RECOMMENDATION_KEY_BY_ID[item.id as keyof typeof RECOMMENDATION_KEY_BY_ID];
      if (key && checklistState[item.id] !== true) {
        items.push(t(key));
      }
    }
    return items;
  }, [checklistRevision, gasOk, isConnected]);

  const loadChecklist = () => {
    const result = storage.get<Record<string, unknown>>(checklistStorageKey);
    if (result && typeof result === "object") {
      Object.keys(result).forEach((key) => {
        checklistState[key] = Boolean(result[key]);
      });
      notifyChecklistChanged();
    }
  };

  const saveChecklist = () => {
    storage.set(checklistStorageKey, { ...checklistState });
  };

  const toggleChecklist = (id: string) => {
    if (id === "gas") return;
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
    recommendations,
    loadChecklist,
    saveChecklist,
    toggleChecklist,
  };
}
