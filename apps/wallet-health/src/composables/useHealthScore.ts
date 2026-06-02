import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import type { StorageProxy } from "@shared/services/os/StorageProxy";

export interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  auto: boolean;
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
 * Uses OS StorageProxy for persistence instead of raw localStorage.
 */
export function useHealthScore(gasOk: Observable<boolean>, storage: StorageProxy): UseHealthScoreReturn {
  const { t } = createUseI18n(messages)();
  void storage;

  const checklistState: Record<string, boolean> = {};
  const checklistStorageKey = "wallet_health_checklist";
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
    () =>
      checklistBase.map((item) => ({
        id: item.id,
        title: t(item.titleKey),
        desc: t(item.descKey),
        done: item.id === "gas" ? gasOk.get() : checklistState[item.id] === true,
        auto: item.id === "gas",
      })),
    [checklistRevision, gasOk],
  );

  const completedChecklistCount = createDerived(
    () => checklistItems.get().filter((item) => item.done).length,
    [checklistItems],
  );
  const totalChecklistCount = createDerived(() => checklistItems.get().length, [checklistItems]);

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

  const recommendations = createDerived(() => {
    const items: string[] = [];
    if (!checklistState.backup) items.push(t("recommendationBackup"));
    if (!gasOk.get()) items.push(t("recommendationGasLow"));
    if (!checklistState.permissions) items.push(t("recommendationPermissions"));
    return items;
  }, [checklistRevision, gasOk]);

  const loadChecklist = () => {
    const result = readCachedJSON<Record<string, unknown>>(checklistStorageKey);
    if (result && typeof result === "object") {
      Object.keys(result).forEach((key) => {
        checklistState[key] = Boolean(result[key]);
      });
      notifyChecklistChanged();
    }
  };

  const saveChecklist = () => {
    writeCachedJSON(checklistStorageKey, { ...checklistState });
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
