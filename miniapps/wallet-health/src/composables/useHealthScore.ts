import { computed, reactive } from "vue";
import { useI18n } from "@/composables/useI18n";

export interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  auto: boolean;
}

export function useHealthScore(gasOk: { value: boolean }) {
  const { t } = useI18n();

  const checklistState = reactive<Record<string, boolean>>({});
  const checklistStorageKey = "wallet-health-checklist";

  const checklistBase = [
    { id: "backup", titleKey: "checklistBackup", descKey: "checklistBackupDesc" },
    { id: "gas", titleKey: "checklistGas", descKey: "checklistGasDesc" },
    { id: "permissions", titleKey: "checklistPermissions", descKey: "checklistPermissionsDesc" },
    { id: "device", titleKey: "checklistDevice", descKey: "checklistDeviceDesc" },
    { id: "hardware", titleKey: "checklistHardware", descKey: "checklistHardwareDesc" },
    { id: "twofa", titleKey: "checklist2fa", descKey: "checklist2faDesc" },
  ];

  const checklistItems = computed<ChecklistItem[]>(() =>
    checklistBase.map((item) => ({
      id: item.id,
      title: t(item.titleKey),
      desc: t(item.descKey),
      done: item.id === "gas" ? gasOk.value : checklistState[item.id] === true,
      auto: item.id === "gas",
    }))
  );

  const completedChecklistCount = computed(() => checklistItems.value.filter((item) => item.done).length);
  const totalChecklistCount = computed(() => checklistItems.value.length);

  const safetyScore = computed(() => {
    const score = (completedChecklistCount.value / totalChecklistCount.value) * 100;
    return Math.round(score);
  });

  const riskLabel = computed(() => {
    if (safetyScore.value >= 80) return t("riskLow");
    if (safetyScore.value >= 50) return t("riskMedium");
    return t("riskHigh");
  });

  const riskClass = computed(() => {
    if (safetyScore.value >= 80) return "risk-low";
    if (safetyScore.value >= 50) return "risk-medium";
    return "risk-high";
  });

  const riskIcon = computed(() => {
    if (safetyScore.value >= 80) return "check-circle";
    if (safetyScore.value >= 50) return "alert-circle";
    return "alert-circle";
  });

  const recommendations = computed(() => {
    const items: string[] = [];
    if (!checklistState.backup) items.push(t("recommendationBackup"));
    if (!gasOk.value) items.push(t("recommendationGasLow"));
    if (!checklistState.permissions) items.push(t("recommendationPermissions"));
    return items;
  });

  const loadChecklist = () => {
    try {
      const stored = uni.getStorageSync(checklistStorageKey);
      if (stored) {
        const parsed = JSON.parse(String(stored));
        if (parsed && typeof parsed === "object") {
          Object.keys(parsed).forEach((key) => {
            checklistState[key] = Boolean(parsed[key]);
          });
        }
      }
    } catch {
      /* Local storage read is non-critical — checklist resets on failure */
    }
  };

  const saveChecklist = () => {
    try {
      uni.setStorageSync(checklistStorageKey, JSON.stringify(checklistState));
    } catch {
      /* Local storage write is non-critical */
    }
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
