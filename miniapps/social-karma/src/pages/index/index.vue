<template>
  <view class="theme-social-karma">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="errorStatus"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Leaderboard Tab (default) — LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <MobileKarmaSummary v-if="!isDesktop" :karma="userKarma" :rank="userRank" />
          <LeaderboardSection :leaderboard="leaderboard" :user-address="address" @refresh="loadLeaderboard" />
        </ErrorBoundary>
      </template>

      <!-- RIGHT panel — Earn actions -->
      <template #operation>
        <CheckInSection
          :streak="checkInStreak"
          :has-checked-in="hasCheckedIn"
          :is-checking-in="isCheckingIn"
          :next-time="nextCheckInTime"
          :base-reward="10"
          @check-in="dailyCheckIn"
        />
        <GiveKarmaForm ref="giveKarmaFormRef" :is-giving="isGiving" @give="handleGiveKarma" />
      </template>

      <!-- Profile Tab -->
      <template #tab-profile>
        <BadgesGrid :badges="userBadges" />
        <AchievementsList :achievements="computedAchievements" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import LeaderboardSection, { type LeaderboardEntry } from "./components/LeaderboardSection.vue";
import CheckInSection from "./components/CheckInSection.vue";
import GiveKarmaForm from "./components/GiveKarmaForm.vue";
import BadgesGrid, { type Badge } from "./components/BadgesGrid.vue";
import AchievementsList, { type Achievement } from "./components/AchievementsList.vue";
import MobileKarmaSummary from "./components/MobileKarmaSummary.vue";

const { t } = useI18n();
const APP_ID = "miniapp-social-karma";

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "leaderboard", labelKey: "leaderboard", icon: "🏆", default: true },
    { key: "profile", labelKey: "profile", icon: "👤" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
        { nameKey: "feature4Name", descKey: "feature4Desc" },
      ],
    },
  },
};

const activeTab = ref("leaderboard");

const appState = computed(() => ({
  karma: userKarma.value,
  rank: userRank.value,
}));
const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);
const { contractAddress, ensureSafe: ensureContractAddress } = useContractAddress(t);
const leaderboard = ref<LeaderboardEntry[]>([]);
const userKarma = ref(0);
const userRank = ref(0);
const checkInStreak = ref(0);
const hasCheckedIn = ref(false);
const nextCheckInTime = ref("-");
const isCheckingIn = ref(false);
const isGiving = ref(false);
const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const errorMessage = computed(() => errorStatus.value?.msg ?? null);
const giveKarmaFormRef = ref<InstanceType<typeof GiveKarmaForm> | null>(null);

const sidebarItems = computed(() => [
  { label: t("leaderboard"), value: `#${userRank.value || "-"}` },
  { label: t("sidebarKarma"), value: userKarma.value },
  { label: t("sidebarStreak"), value: checkInStreak.value },
  { label: t("profile"), value: userBadges.value.filter((b) => b.unlocked).length },
]);

const isDesktop = computed(() => {
  try {
    return window.matchMedia("(min-width: 768px)").matches;
  } catch {
    return false;
  }
});

const userBadges = ref<Badge[]>([
  { id: "first", icon: "🌟", name: t("earlyAdopter"), unlocked: true, hint: t("joinEarly") },
  { id: "helpful", icon: "🤝", name: t("helpful"), unlocked: false, hint: t("helpHint") },
  { id: "generous", icon: "🎁", name: t("generous"), unlocked: false, hint: t("giveHint") },
  { id: "verified", icon: "✓", name: t("verified"), unlocked: false, hint: t("verifyHint") },
  { id: "contributor", icon: "⭐", name: t("contributor"), unlocked: false, hint: t("contribHint") },
  { id: "champion", icon: "🏆", name: t("champion"), unlocked: false, hint: t("championHint") },
  { id: "legend", icon: "👑", name: t("legend"), unlocked: false, hint: t("legendHint") },
  { id: "streak7", icon: "🔥", name: t("weekStreak"), unlocked: false, hint: t("streak7Hint") },
]);

const computedAchievements = computed<Achievement[]>(() => [
  {
    id: "first",
    name: t("firstKarma"),
    progress: `${Math.min(userKarma.value, 1)}/1`,
    percent: Math.min((userKarma.value / 1) * 100, 100),
    unlocked: userKarma.value >= 1,
  },
  {
    id: "k10",
    name: t("karma10"),
    progress: `${Math.min(userKarma.value, 10)}/10`,
    percent: Math.min((userKarma.value / 10) * 100, 100),
    unlocked: userKarma.value >= 10,
  },
  {
    id: "k100",
    name: t("karma100"),
    progress: `${Math.min(userKarma.value, 100)}/100`,
    percent: Math.min((userKarma.value / 100) * 100, 100),
    unlocked: userKarma.value >= 100,
  },
  {
    id: "k1000",
    name: t("karma1000"),
    progress: `${Math.min(userKarma.value, 1000)}/1000`,
    percent: Math.min((userKarma.value / 1000) * 100, 100),
    unlocked: userKarma.value >= 1000,
  },
  { id: "gifter", name: t("gifter"), progress: "0/1", percent: 0, unlocked: false },
  { id: "philanthropist", name: t("philanthropist"), progress: "0/100", percent: 0, unlocked: false },
]);

const { handleBoundaryError } = useHandleBoundaryError("social-karma");
const resetAndReload = async () => {
  await loadLeaderboard();
  await loadUserState();
};

const loadLeaderboard = async () => {
  if (!(await ensureContractAddress())) return;
  try {
    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getLeaderboard",
      args: [],
    });
    const parsed = parseInvokeResult(result) as unknown[];
    if (Array.isArray(parsed)) {
      leaderboard.value = parsed.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        return {
          address: String(entry.address || ""),
          karma: Number(entry.karma || 0),
        };
      });
    }
    const userEntry = leaderboard.value.find((e) => e.address === address.value);
    if (userEntry) {
      userKarma.value = userEntry.karma;
      userRank.value = leaderboard.value.indexOf(userEntry) + 1;
    }
  } catch (e: unknown) {
    setErrorStatus(formatErrorMessage(e, t("leaderboardError")), "error");
  }
};

const loadUserState = async () => {
  if (!address.value || !(await ensureContractAddress())) return;
  try {
    const state = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getUserCheckInState",
      args: [{ type: "Hash160", value: address.value }],
    });
    if (state) {
      const parsed = state as Record<string, unknown>;
      hasCheckedIn.value = Boolean(parsed.checkedIn) || false;
      checkInStreak.value = Number(parsed.streak || 0);
    }
  } catch (_e: unknown) {
    // User state load failure is non-critical
  }
};

const dailyCheckIn = async () => {
  if (!address.value) {
    setErrorStatus(t("connectWallet"), "error");
    return;
  }
  if (!(await ensureContractAddress())) return;

  try {
    isCheckingIn.value = true;
    const { receiptId, invoke } = await processPayment("0.1", "checkin");
    const tx = (await invoke(
      "dailyCheckIn",
      [{ type: "Integer", value: String(receiptId) }],
      contractAddress.value as string
    )) as { txid: string };
    if (tx.txid) {
      await waitForEvent(tx.txid, "KarmaEarned");
      hasCheckedIn.value = true;
      checkInStreak.value += 1;
      await loadLeaderboard();
    }
  } catch (e: unknown) {
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  } finally {
    isCheckingIn.value = false;
  }
};

const handleGiveKarma = async (data: { address: string; amount: number; reason: string }) => {
  if (!address.value) return;
  if (!(await ensureContractAddress())) return;

  try {
    isGiving.value = true;
    const { receiptId, invoke } = await processPayment("0.1", `reward:${data.amount}`);
    const tx = (await invoke(
      "giveKarma",
      [
        { type: "Hash160", value: data.address },
        { type: "Integer", value: data.amount },
        { type: "String", value: data.reason },
        { type: "Integer", value: String(receiptId) },
      ],
      contractAddress.value as string
    )) as { txid: string };
    if (tx.txid) {
      await waitForEvent(tx.txid, "KarmaGiven");
      giveKarmaFormRef.value?.reset();
      await loadLeaderboard();
    }
  } catch (e: unknown) {
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  } finally {
    isGiving.value = false;
  }
};

onMounted(async () => {
  await ensureContractAddress();
  await loadLeaderboard();
  await loadUserState();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./social-karma-theme.scss";

:global(page) {
  background: var(--karma-bg);
}
</style>
