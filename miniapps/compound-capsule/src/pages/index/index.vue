<template>
  <view class="theme-compound-capsule">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab — LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <RewardClaim :position="position" />
        </ErrorBoundary>
      </template>

      <!-- Main Tab — RIGHT panel -->
      <template #operation>
        <CapsuleCreate
          v-model="selectedPeriod"
          :is-loading="isLoading"
          :min-lock-days="MIN_LOCK_DAYS"
          @create="createCapsule"
        />
      </template>

      <template #tab-stats>
        <CapsuleDetails :vault="vault" />

        <CapsuleList :capsules="activeCapsules" :is-loading="isLoading" @unlock="unlockCapsule" />

        <!-- Statistics -->
        <NeoStats :stats="capsuleStats" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import CapsuleCreate from "./components/CapsuleCreate.vue";
import RewardClaim from "./components/RewardClaim.vue";
import CapsuleDetails from "./components/CapsuleDetails.vue";
import CapsuleList from "./components/CapsuleList.vue";

const isLoading = ref(false);

const { t, locale } = createUseI18n(messages)();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "main", labelKey: "main", icon: "💊", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const activeTab = ref("main");

const appState = computed(() => ({
  totalCapsules: stats.value.totalCapsules,
  totalLocked: stats.value.totalLocked,
  totalAccrued: stats.value.totalAccrued,
}));

const sidebarItems = computed(() => [
  { label: t("totalCapsules"), value: stats.value.totalCapsules },
  { label: t("totalLocked"), value: `${fmt(stats.value.totalLocked, 0)} NEO` },
  { label: t("totalAccrued"), value: `${fmt(stats.value.totalAccrued, 4)} GAS` },
]);

const capsuleStats = computed(() => [
  { label: t("totalCapsules"), value: stats.value.totalCapsules },
  { label: t("totalLocked"), value: `${fmt(stats.value.totalLocked, 0)} NEO` },
  { label: t("totalAccrued"), value: `${fmt(stats.value.totalAccrued, 4)} GAS` },
]);

type Vault = { totalLocked: number; totalCapsules: number };
type Position = { deposited: number; earned: number; capsules: number };
type Capsule = {
  id: string;
  amount: number;
  unlockTime: number;
  unlockDate: string;
  remaining: string;
  compound: number;
  status: "Ready" | "Locked";
};

const { address, connect, chainType, invokeContract, invokeRead } = useWallet() as WalletSDK;
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);

const MIN_LOCK_DAYS = 7;

const vault = ref<Vault>({ totalLocked: 0, totalCapsules: 0 });
const position = ref<Position>({ deposited: 0, earned: 0, capsules: 0 });
const stats = ref({ totalCapsules: 0, totalLocked: 0, totalAccrued: 0 });
const activeCapsules = ref<Capsule[]>([]);
const { status, setStatus, clearStatus } = useStatusMessage();
const selectedPeriod = ref<number>(30);

const fmt = (n: number, d = 2) => formatNumber(n, d);
const resolveDateLocale = () => (locale.value === "zh" ? "zh-CN" : "en-US");
const formatCountdown = (ms: number) => {
  if (ms <= 0) return t("ready");
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}${t("daysShort")} ${hours}${t("hoursShort")}`;
  if (hours > 0) return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
  return `${minutes}${t("minutesShort")}`;
};
const formatUnlockDate = (ms: number) =>
  new Date(ms).toLocaleDateString(resolveDateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const toTimestampMs = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1e12 ? value : value * 1000;
};

// Fetch capsules from smart contract
const fetchData = async () => {
  try {
    const contract = await ensureContractAddress();
    const totalResult = await invokeRead({
      scriptHash: contract,
      operation: "TotalCapsules",
      args: [],
    });
    const totalCapsules = Number(parseInvokeResult(totalResult) || 0);
    const lockedResult = await invokeRead({ scriptHash: contract, operation: "TotalLocked", args: [] });
    const platformLocked = Number(parseInvokeResult(lockedResult) || 0);
    const userCapsules: Capsule[] = [];
    let userLocked = 0;
    let userAccrued = 0;
    const now = Date.now();
    const userScriptHash = address.value ? addressToScriptHash(address.value) : "";

    for (let i = 1; i <= totalCapsules; i++) {
      const capsuleResult = await invokeRead({
        scriptHash: contract,
        operation: "GetCapsuleDetails",
        args: [{ type: "Integer", value: i.toString() }],
      });
      const parsed = parseInvokeResult(capsuleResult);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const data = parsed as Record<string, unknown>;
        const owner = normalizeScriptHash(String(data?.owner ?? ""));
        const principal = Number(data?.principal || 0);
        const unlockTime = Number(data?.unlockTime || 0);
        const unlockTimeMs = toTimestampMs(unlockTime);
        const isActive = Boolean(data?.active);
        const compoundRaw = Number(data?.compound || 0);

        if (userScriptHash && isActive && owner === userScriptHash) {
          const isReady = unlockTimeMs <= now;
          const compound = compoundRaw / 1e8;
          userCapsules.push({
            id: i.toString(),
            amount: principal,
            unlockTime: unlockTimeMs,
            unlockDate: formatUnlockDate(unlockTimeMs),
            remaining: isReady ? t("ready") : formatCountdown(unlockTimeMs - now),
            compound,
            status: isReady ? "Ready" : "Locked",
          });

          userLocked += principal;
          userAccrued += compound;
        }
      }
    }

    vault.value = { totalLocked: platformLocked, totalCapsules };
    activeCapsules.value = userCapsules;
    position.value = { deposited: userLocked, earned: userAccrued, capsules: userCapsules.length };
    stats.value = { totalCapsules: userCapsules.length, totalLocked: userLocked, totalAccrued: userAccrued };
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("loadFailed")), "error");
  }
};

const { handleBoundaryError } = useHandleBoundaryError("compound-capsule");
const resetAndReload = async () => {
  await fetchData();
};

watch(
  address,
  () => {
    fetchData();
  },
  { immediate: true }
);

const createCapsule = async (): Promise<void> => {
  if (isLoading.value) return;
  // Note: amount comes from CapsuleCreate component internal state
  // We'll need to access it differently - for now, keeping simple

  isLoading.value = true;
  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("connectWallet"));
    }

    const contract = await ensureContractAddress();
    const lockDays = selectedPeriod.value;

    await invokeContract({
      scriptHash: contract,
      operation: "CreateCapsule",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: String(1) }, // Default amount for now
        { type: "Integer", value: String(lockDays) },
      ],
    });

    setStatus(t("capsuleCreated"), "success");
    await fetchData();
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("contractUnavailable")), "error");
  } finally {
    isLoading.value = false;
  }
};

const unlockCapsule = async (capsuleId: string) => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("connectWallet"));
    }

    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "UnlockCapsule",
      args: [{ type: "Integer", value: capsuleId }],
    });

    setStatus(t("capsuleUnlocked"), "success");
    await fetchData();
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("unlockFailed")), "error");
  } finally {
    isLoading.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./compound-capsule-theme.scss";

:global(page) {
  background: var(--capsule-bg);
}
</style>
