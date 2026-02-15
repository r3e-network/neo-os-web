<template>
  <MiniAppPage
    name="social-karma"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="errorStatus"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <!-- Leaderboard Tab (default) — LEFT panel -->
    <template #content>
      <MobileKarmaSummary v-if="!isDesktop" :karma="userKarma" :rank="userRank" />
      <LeaderboardSection :leaderboard="leaderboard" :user-address="address" @refresh="loadLeaderboard" />
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
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { useSocialKarma } from "@/composables/useSocialKarma";
import LeaderboardSection, { type LeaderboardEntry } from "./components/LeaderboardSection.vue";
import GiveKarmaForm from "./components/GiveKarmaForm.vue";
import BadgesGrid, { type Badge } from "./components/BadgesGrid.vue";
import AchievementsList, { type Achievement } from "./components/AchievementsList.vue";
import MobileKarmaSummary from "./components/MobileKarmaSummary.vue";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status: errorStatus,
  setStatus: setErrorStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "social-karma",
  messages,
  template: {
    tabs: [
      { key: "leaderboard", labelKey: "leaderboard", icon: "🏆", default: true },
      { key: "profile", labelKey: "profile", icon: "👤" },
    ],
    docFeatureCount: 4,
  },
  sidebarItems: [
    { labelKey: "leaderboard", value: () => `#${karma.userRank.value || "-"}` },
    { labelKey: "sidebarKarma", value: () => karma.userKarma.value },
    { labelKey: "sidebarStreak", value: () => karma.checkInStreak.value },
    { labelKey: "profile", value: () => userBadges.value.filter((b) => b.unlocked).length },
  ],
  statusTimeoutMs: 5000,
});

const karma = useSocialKarma(t);
const {
  address,
  leaderboard,
  userKarma,
  userRank,
  checkInStreak,
  hasCheckedIn,
  nextCheckInTime,
  isCheckingIn,
  isGiving,
  loadLeaderboard,
  loadUserState,
} = karma;

const appState = computed(() => ({
  karma: userKarma.value,
  rank: userRank.value,
}));

const giveKarmaFormRef = ref<InstanceType<typeof GiveKarmaForm> | null>(null);

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

const resetAndReload = async () => {
  await loadLeaderboard(setErrorStatus);
  await loadUserState();
};

const dailyCheckIn = async () => {
  await karma.dailyCheckIn(setErrorStatus);
};

const handleGiveKarma = async (data: { address: string; amount: number; reason: string }) => {
  await karma.giveKarma(data, setErrorStatus, () => {
    giveKarmaFormRef.value?.reset();
  });
};

onMounted(async () => {
  await loadLeaderboard(setErrorStatus);
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
