<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-compound-capsule" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Main Tab -->
    <view v-if="activeTab === 'main'" class="tab-content">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold status-msg">{{ status.msg }}</text>
      </NeoCard>

      <CapsuleCreate
        v-model="selectedPeriod"
        :is-loading="isLoading"
        :min-lock-days="MIN_LOCK_DAYS"
        @create="createCapsule"
      />

      <RewardClaim :position="position" />
    </view>

    <!-- Stats Tab -->
    <view v-if="activeTab === 'stats'" class="tab-content scrollable">
      <CapsuleDetails :vault="vault" />

      <CapsuleList
        :capsules="activeCapsules"
        :is-loading="isLoading"
        @unlock="unlockCapsule"
      />

      <!-- Statistics -->
      <NeoCard variant="erobo-neo">
        <view class="stats-grid-glass">
          <view class="stat-box-glass">
            <text class="stat-label">{{ t("totalCapsules") }}</text>
            <text class="stat-value">{{ stats.totalCapsules }}</text>
          </view>
          <view class="stat-box-glass">
            <text class="stat-label">{{ t("totalLocked") }}</text>
            <text class="stat-value">{{ fmt(stats.totalLocked, 0) }} NEO</text>
          </view>
          <view class="stat-box-glass">
            <text class="stat-label">{{ t("totalAccrued") }}</text>
            <text class="stat-value">{{ fmt(stats.totalAccrued, 4) }} GAS</text>
          </view>
        </view>
      </NeoCard>
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
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, NeoCard, Fireworks, ChainWarning } from "@shared/components";
import CapsuleCreate from "./components/CapsuleCreate.vue";
import RewardClaim from "./components/RewardClaim.vue";
import CapsuleDetails from "./components/CapsuleDetails.vue";
import CapsuleList from "./components/CapsuleList.vue";

const isLoading = ref(false);

const { t, locale } = useI18n();

const navTabs = computed(() => [
  { id: "main", icon: "wallet", label: t("main") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("main");

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
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

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);
const { address, connect, chainType, getContractAddress, invokeContract, invokeRead } = useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);

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

const MIN_LOCK_DAYS = 7;

const vault = ref<Vault>({ totalLocked: 0, totalCapsules: 0 });
const position = ref<Position>({ deposited: 0, earned: 0, capsules: 0 });
const stats = ref({ totalCapsules: 0, totalLocked: 0, totalAccrued: 0 });
const activeCapsules = ref<Capsule[]>([]);
const status = ref<Status | null>(null);
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
      contractAddress: contract,
      operation: "TotalCapsules",
      args: [],
    });
    const totalCapsules = Number(parseInvokeResult(totalResult) || 0);
    const lockedResult = await invokeRead({ contractAddress: contract,       operation: "TotalLocked", args: [] });
    const platformLocked = Number(parseInvokeResult(lockedResult) || 0);
    const userCapsules: Capsule[] = [];
    let userLocked = 0;
    let userAccrued = 0;
    const now = Date.now();
    const userScriptHash = address.value ? addressToScriptHash(address.value) : "";

    for (let i = 1; i <= totalCapsules; i++) {
      const capsuleResult = await invokeRead({
        contractAddress: contract,
        operation: "GetCapsuleDetails",
        args: [{ type: "Integer", value: i.toString() }],
      });
      const parsed = parseInvokeResult(capsuleResult);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const data = parsed as Record<string, any>;
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
  } catch (e: any) {
    status.value = { msg: e?.message || t("loadFailed"), type: "error" };
  }
};

onMounted(() => {
  fetchData();
});
watch(address, () => {
  fetchData();
});

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

    status.value = { msg: t("capsuleCreated"), type: "success" };
    await fetchData();
  } catch (e: any) {
    status.value = { msg: e.message || t("contractUnavailable"), type: "error" };
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

    status.value = { msg: t("capsuleUnlocked"), type: "success" };
    await fetchData();
  } catch (e: any) {
    status.value = { msg: e.message || t("unlockFailed"), type: "error" };
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

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--capsule-bg);
  background-image:
    radial-gradient(circle at 10% 20%, var(--capsule-accent-purple) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, var(--capsule-accent-gold) 0%, transparent 20%);
  min-height: 100vh;
}

/* Alchemy Component Overrides */
:deep(.neo-card) {
  background: var(--capsule-card-bg) !important;
  border: 1px solid var(--capsule-card-border) !important;
  border-radius: 16px !important;
  box-shadow: var(--capsule-card-shadow) !important;
  color: var(--capsule-text) !important;
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: "";
    position: absolute;
    width: 40px;
    height: 40px;
    border: 1px solid var(--capsule-gold);
    opacity: 0.3;
    pointer-events: none;
  }
  &::before {
    top: -20px;
    left: -20px;
    border-radius: 50%;
  }
  &::after {
    bottom: -20px;
    right: -20px;
    border-radius: 50%;
  }
}

:deep(.neo-button) {
  border-radius: 8px !important;
  font-family: "Cinzel", serif !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700 !important;

  &.variant-primary {
    background: var(--capsule-button-gradient) !important;
    color: var(--capsule-button-text) !important;
    border: 1px solid var(--capsule-button-border) !important;
    box-shadow: var(--capsule-button-shadow) !important;

    &:active {
      transform: translateY(1px);
      box-shadow: var(--capsule-button-shadow-press) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--capsule-text) !important;
    color: var(--capsule-text) !important;
    opacity: 0.8;
  }
}

:deep(input),
:deep(.neo-input input) {
  font-family: "Cinzel", serif !important;
}

.status-msg {
  font-size: 14px;
  color: var(--capsule-text);
  letter-spacing: 0.05em;
  font-family: "Cinzel", serif;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
