import { createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
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

  const checklistState: Record<string, boolean> = {};
  const checklistStorageKey = "checklist";

  const checklistBase = [
    { id: "backup", titleKey: "checklistBackup", descKey: "checklistBackupDesc" },
    { id: "gas", titleKey: "checklistGas", descKey: "checklistGasDesc" },
    { id: "permissions", titleKey: "checklistPermissions", descKey: "checklistPermissionsDesc" },
    { id: "device", titleKey: "checklistDevice", descKey: "checklistDeviceDesc" },
    { id: "hardware", titleKey: "checklistHardware", descKey: "checklistHardwareDesc" },
    { id: "twofa", titleKey: "checklist2fa", descKey: "checklist2faDesc" },
  ];

  const checklistItems = createDerived<ChecklistItem[]>(() =>
    checklistBase.map((item) => ({
      id: item.id,
      title: t(item.titleKey),
      desc: t(item.descKey),
      done: item.id === "gas" ? gasOk.get() : checklistState[item.id] === true,
      auto: item.id === "gas",
    }))
  , []);

  const completedChecklistCount = createDerived(() => checklistItems.get().filter((item) => item.done).length, []);
  const totalChecklistCount = createDerived(() => checklistItems.get().length, []);

  const safetyScore = createDerived(() => {
    if (totalChecklistCount.get() === 0) return 0;
    const score = (completedChecklistCount.get() / totalChecklistCount.get()) * 100;
    return Math.round(score);
  }, []);

  const riskLabel = createDerived(() => {
    if (safetyScore.get() >= 80) return t("riskLow");
    if (safetyScore.get() >= 50) return t("riskMedium");
    return t("riskHigh");
  }, []);

  const riskClass = createDerived(() => {
    if (safetyScore.get() >= 80) return "risk-low";
    if (safetyScore.get() >= 50) return "risk-medium";
    return "risk-high";
  }, []);

  const riskIcon = createDerived(() => {
    if (safetyScore.get() >= 80) return "check-circle";
    if (safetyScore.get() >= 50) return "alert-circle";
    return "alert-circle";
  }, []);

  const recommendations = createDerived(() => {
    const items: string[] = [];
    if (!checklistState.backup) items.push(t("recommendationBackup"));
    if (!gasOk.get()) items.push(t("recommendationGasLow"));
    if (!checklistState.permissions) items.push(t("recommendationPermissions"));
    return items;
  }, []);

  const loadChecklist = () => {
    storage.get(checklistStorageKey).then((result) => {
      if (result && typeof result === "object") {
        const parsed = result as Record<string, unknown>;
        Object.keys(parsed).forEach((key) => {
          checklistState[key] = Boolean(parsed[key]);
        });
      }
    }).catch((_e) => {
      console.warn("[useHealthScore] loadChecklist failed:", _e instanceof Error ? _e.message : String(_e));
    });
  };

  const saveChecklist = () => {
    storage.set(checklistStorageKey, { ...checklistState }).catch((_e) => {
      console.warn("[useHealthScore] saveChecklist failed:", _e instanceof Error ? _e.message : String(_e));
    });
  };

  const toggleChecklist = (id: string) => {
    if (id === "gas") return;
    checklistState[id] = !checklistState[id];
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
