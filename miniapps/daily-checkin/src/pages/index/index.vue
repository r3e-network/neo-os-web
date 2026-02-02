<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-daily-checkin" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <!-- Check-in Tab -->
    <view v-if="activeTab === 'checkin'" class="tab-content">
      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4">
        <text class="text-center font-bold status-msg">{{ status.msg }}</text>
      </NeoCard>

      <NeoButton
        variant="primary"
        size="lg"
        block
        :disabled="!canCheckIn || isLoading"
        :loading="isLoading"
        @click="doCheckIn"
        class="checkin-btn"
      >
        <view class="btn-content">
          <text class="btn-icon">{{ canCheckIn ? "✨" : "⏳" }}</text>
          <text>{{ canCheckIn ? t("checkInNow") : t("waitForNext") }}</text>
        </view>
      </NeoButton>

      <CountdownHero
        :countdown-progress="countdownProgress"
        :countdown-label="countdownLabel"
        :can-check-in="canCheckIn"
        :utc-time-display="utcTimeDisplay"
      />

      <StreakDisplay :current-streak="currentStreak" :highest-streak="highestStreak" />
    </view>

    <!-- Stats Tab -->
    <view v-if="activeTab === 'stats'" class="tab-content scrollable">
      <RewardProgress :milestones="milestones" :current-streak="currentStreak" />
      <UserRewards
        :unclaimed-rewards="unclaimedRewards"
        :total-claimed="totalClaimed"
        :is-claiming="isClaiming"
        @claim="claimRewards"
        class="mb-4"
      />
      <StatsTab :global-stats="globalStats" :user-stats="userStats" :checkin-history="checkinHistory" />
    </view>

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
    <Fireworks :active="status?.type === 'success'" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { formatGas } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoButton, NeoCard, NeoDoc, type StatItem, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import CountdownHero from "./components/CountdownHero.vue";
import StreakDisplay from "./components/StreakDisplay.vue";
import RewardProgress from "./components/RewardProgress.vue";
import UserRewards from "./components/UserRewards.vue";
import StatsTab from "./components/StatsTab.vue";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

const { t } = useI18n();

const APP_ID = "miniapp-dailycheckin";
const CHECK_IN_FEE = 0.001;
const MS_PER_DAY = 24 * 60 * 60 * 1000; // milliseconds per day

const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();

const activeTab = ref("checkin");
const navTabs = computed(() => [
  { id: "checkin", icon: "check", label: t("checkin") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

// User state
const currentStreak = ref(0);
const highestStreak = ref(0);
const lastCheckInDay = ref(0); // UTC day number (not timestamp)
const unclaimedRewards = ref(0);
const totalClaimed = ref(0);
const totalUserCheckins = ref(0);
const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
const isClaiming = ref(false);
const contractAddress = ref<string | null>(null);

// Global stats
const globalStats = ref({
  totalUsers: 0,
  totalCheckins: 0,
  totalRewarded: 0,
});

// History
const checkinHistory = ref<{ streak: number; time: string; reward: number }[]>([]);

// Countdown
const now = ref(Date.now());
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Reward structure: Day 7 = 1 GAS, Day 14+ = +1.5 GAS every 7 days (cumulative)
const milestones = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 1.5, cumulative: 2.5 },
  { day: 21, reward: 1.5, cumulative: 4 },
  { day: 28, reward: 1.5, cumulative: 5.5 },
];

// Global UTC countdown (same for all users)
const currentUtcDay = computed(() => Math.floor(now.value / MS_PER_DAY));

const nextUtcMidnight = computed(() => (currentUtcDay.value + 1) * MS_PER_DAY);

const canCheckIn = computed(() => {
  if (lastCheckInDay.value === 0) return true;
  return currentUtcDay.value > lastCheckInDay.value;
});

const remainingMs = computed(() => {
  return Math.max(0, nextUtcMidnight.value - now.value);
});

// Always calculate countdown progress (circle fills as time passes toward next UTC midnight)
const countdownProgress = computed(() => {
  const circumference = 2 * Math.PI * 99; // 622
  // Calculate how much of the day has passed (0 = start of day, 1 = end of day)
  const elapsed = MS_PER_DAY - remainingMs.value;
  const elapsedRatio = elapsed / MS_PER_DAY;
  // Stroke offset: 0 = full circle visible, circumference = circle hidden
  // We want circle to fill up as time passes, so offset decreases as time passes
  return circumference * (1 - elapsedRatio);
});

// Always calculate countdown time to next UTC midnight
const countdownLabel = computed(() => {
  const totalSeconds = Math.floor(remainingMs.value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

const utcTimeDisplay = computed(() => {
  const utcDate = new Date(now.value);
  const h = String(utcDate.getUTCHours()).padStart(2, "0");
  const m = String(utcDate.getUTCMinutes()).padStart(2, "0");
  const s = String(utcDate.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
});

const userStats = computed<StatItem[]>(() => [
  { label: t("currentStreak"), value: `${currentStreak.value} ${t("days")}`, variant: "accent" },
  { label: t("highestStreak"), value: `${highestStreak.value} ${t("days")}`, variant: "success" },
  { label: t("totalUserCheckins"), value: totalUserCheckins.value },
  { label: t("totalClaimed"), value: `${formatGas(totalClaimed.value)} GAS` },
  { label: t("unclaimed"), value: `${formatGas(unclaimedRewards.value)} GAS` },
]);

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) throw new Error(t("contractUnavailable"));
  return contractAddress.value;
};

const waitForEvent = async (txid: string, eventName: string): Promise<{ event: any; pending: boolean }> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
    const match = res.events.find((evt) => evt.tx_hash === txid);
    if (match) return { event: match, pending: false };
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  // Return pending status instead of null - transaction may still succeed
  return { event: null, pending: true };
};

const loadUserStats = async () => {
  if (!address.value) return;
  try {
    const contract = await ensureContractAddress();
    const res = await invokeRead({
      contractHash: contract,
      operation: "GetUserStats",
      args: [{ type: "Hash160", value: address.value }],
    });
    const data = parseInvokeResult(res);
    if (Array.isArray(data)) {
      currentStreak.value = Number(data[0] ?? 0);
      highestStreak.value = Number(data[1] ?? 0);
      lastCheckInDay.value = Number(data[2] ?? 0);
      unclaimedRewards.value = Number(data[3] ?? 0);
      totalClaimed.value = Number(data[4] ?? 0);
      totalUserCheckins.value = Number(data[5] ?? 0);
    }
  } catch {}
};

const loadGlobalStats = async () => {
  try {
    const contract = await ensureContractAddress();
    const res = await invokeRead({
      contractHash: contract,
      operation: "GetPlatformStats",
      args: [],
    });
    const data = parseInvokeResult(res);
    if (Array.isArray(data)) {
      globalStats.value = {
        totalUsers: Number(data[0] ?? 0),
        totalCheckins: Number(data[1] ?? 0),
        totalRewarded: Number(data[2] ?? 0),
      };
    }
  } catch {}
};

const loadHistory = async () => {
  if (!address.value) return; // Guard against null address
  try {
    const res = await listEvents({ app_id: APP_ID, event_name: "CheckedIn", limit: 10 });
    const currentAddress = address.value; // Capture current address for comparison
    checkinHistory.value = res.events
      .filter((evt) => {
        const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
        return String(values[0] ?? "") === currentAddress;
      })
      .map((evt) => {
        const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
        return {
          streak: Number(values[1] ?? 0),
          time: new Date(evt.created_at || Date.now()).toLocaleString(),
          reward: Number(values[2] ?? 0),
        };
      });
  } catch {}
};

const doCheckIn = async () => {
  if (!canCheckIn.value || isLoading.value) return;
  status.value = null;

  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) throw new Error(t("connectWallet"));

    const contract = await ensureContractAddress();
    const { receiptId, invoke } = await processPayment(String(CHECK_IN_FEE), "checkin");
    if (!receiptId) throw new Error(t("receiptMissing"));

    const tx = await invoke(
      "checkIn",
      [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: String(receiptId) },
      ],
      contract,
    );

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
    );
    const result = txid ? await waitForEvent(txid, "CheckedIn") : { event: null, pending: true };

    if (result.pending) {
      // Transaction submitted but event not yet indexed - show pending status
      status.value = { msg: t("pendingConfirmation", { action: t("checkinSuccess") }), type: "success" };
    } else {
      status.value = { msg: t("checkinSuccess"), type: "success" };
    }

    await loadUserStats();
    await loadGlobalStats();
    await loadHistory();
  } catch (e: any) {
    status.value = { msg: e?.message || t("error"), type: "error" };
  }
};

const claimRewards = async () => {
  if (unclaimedRewards.value <= 0 || isClaiming.value) return;
  isClaiming.value = true;
  status.value = null;

  try {
    if (!address.value) throw new Error(t("connectWallet"));

    const contract = await ensureContractAddress();
    const { invoke } = await processPayment("0", "claim");
    const tx = await invoke("claimRewards", [{ type: "Hash160", value: address.value }], contract);

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
    );
    const result = txid ? await waitForEvent(txid, "RewardsClaimed") : { event: null, pending: true };

    if (result.pending) {
      status.value = { msg: t("pendingConfirmation", { action: t("claimSuccess") }), type: "success" };
    } else {
      status.value = { msg: t("claimSuccess"), type: "success" };
    }

    await loadUserStats();
    await loadGlobalStats();
  } catch (e: any) {
    status.value = { msg: e?.message || t("error"), type: "error" };
  } finally {
    isClaiming.value = false;
  }
};

onMounted(async () => {
  countdownInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  await loadUserStats();
  await loadGlobalStats();
  await loadHistory();
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./daily-checkin-theme.scss";
@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&family=Quicksand:wght@300;400;500;600;700&display=swap");

:global(page) {
  background: var(--sunrise-bg);
  font-family: var(--sunrise-font);
}

.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: linear-gradient(180deg, var(--sunrise-gradient-start) 0%, var(--sunrise-gradient-end) 100%);
  min-height: 100vh;
  position: relative;
  font-family: var(--sunrise-font);

  /* Sun Ray Pattern */
  &::before {
    content: "";
    position: absolute;
    top: -20%;
    left: 50%;
    width: 200%;
    height: 100%;
    transform: translateX(-50%);
    background: repeating-conic-gradient(from 0deg, var(--sunrise-ray) 0deg 20deg, transparent 20deg 40deg);
    pointer-events: none;
    z-index: 0;
  }
}

/* Gamified/Sunrise Card Overrides */
:deep(.neo-card) {
  background: var(--sunrise-card-bg) !important;
  border: 2px solid var(--sunrise-card-border) !important; /* Orange-200 */
  border-bottom: 6px solid var(--sunrise-card-border-strong) !important; /* Orange-300 */
  border-radius: 24px !important;
  box-shadow: var(--sunrise-card-shadow) !important;
  color: var(--sunrise-text) !important;
  position: relative;
  z-index: 1;

  &.variant-erobo-neo {
    background: var(--sunrise-card-neo-bg) !important;
    border-color: var(--sunrise-card-neo-border) !important; /* Yellow-200 */
    border-bottom-color: var(--sunrise-card-neo-border-strong) !important; /* Yellow-300 */
  }

  &.variant-danger {
    background: var(--sunrise-danger-bg) !important;
    border-color: var(--sunrise-danger-border) !important;
    border-bottom-color: var(--sunrise-danger-border-strong) !important;
    color: var(--sunrise-danger-text) !important;
  }
}

.status-msg {
  color: var(--sunrise-text);
  font-weight: 800;
  font-size: 16px;
}

:deep(.neo-button) {
  border-radius: 20px !important;
  box-shadow: var(--sunrise-button-shadow) !important;
  font-weight: 800 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-family: var(--sunrise-font) !important;

  &:active {
    transform: translateY(4px);
    box-shadow: none !important;
    border-bottom-width: 0 !important;
  }

  &.variant-primary {
    background: var(--sunrise-button-gradient) !important;
    border: none !important;
    border-bottom: 4px solid var(--sunrise-button-border-strong) !important; /* Darker orange */
    color: var(--sunrise-button-text) !important;
    text-shadow: var(--sunrise-button-text-shadow);
  }

  &.variant-secondary {
    background: var(--sunrise-button-secondary-bg) !important;
    border: 2px solid var(--sunrise-blue) !important;
    border-bottom: 4px solid var(--sunrise-button-secondary-border) !important;
    color: var(--sunrise-blue) !important;
  }
}

.checkin-btn {
  margin-top: 16px;
  transform: scale(1.02);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 18px;
}

.btn-icon {
  font-size: 24px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}


// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
