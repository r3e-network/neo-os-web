<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-heritage-trust" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

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

      <view v-if="status" class="mb-4">
        <NeoCard
          :variant="status.type === 'error' ? 'danger' : status.type === 'loading' ? 'warning' : 'success'"
          class="text-center"
        >
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>
      </view>

      <TrustCreate
        :is-loading="isLoading"
        :t="t"
        @create="handleCreate"
      />
    </view>

    <!-- Mine Tab -->
    <view v-if="activeTab === 'mine'" class="tab-content scrollable">
      <view class="mine-dashboard">
        <TrustList
          :trusts="myCreatedTrusts"
          :title="t('createdTrusts')"
          :empty-text="t('noTrusts')"
          empty-icon="📜"
          :t="t"
          @heartbeat="heartbeatTrust"
          @claimYield="claimYield"
          @execute="executeTrust"
          @claimReleased="claimReleased"
        />

        <BeneficiaryManager
          :beneficiary-trusts="myBeneficiaryTrusts"
          :t="t"
          @heartbeat="heartbeatTrust"
          @claimYield="claimYield"
          @execute="executeTrust"
          @claimReleased="claimReleased"
        />
      </view>
    </view>

    <!-- Stats Tab -->
    <view v-if="activeTab === 'stats'" class="tab-content scrollable">
      <StatsCard :stats="stats" :t="t" />
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
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, NeoCard, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseStackItem } from "@shared/utils/neo";

import { useHeritageTrusts } from "@/composables/useHeritageTrusts";
import { useHeritageBeneficiaries } from "@/composables/useHeritageBeneficiaries";
import TrustList from "./components/TrustList.vue";
import BeneficiaryManager from "./components/BeneficiaryManager.vue";
import TrustCreate from "./components/TrustCreate.vue";
import StatsCard from "./components/StatsCard.vue";

const { t } = useI18n();
const { address, connect, invokeContract, getBalance, chainType, getContractAddress } =
  useWallet() as WalletSDK;

const navTabs = computed<NavTab[]>(() => [
  { id: "main", icon: "plus-circle", label: t("createTrust") },
  { id: "mine", icon: "wallet", label: t("mine") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("main");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const {
  isLoading,
  isLoadingData,
  myCreatedTrusts,
  myBeneficiaryTrusts,
  stats,
  status,
  fetchData,
  heartbeatTrust,
  claimYield,
  claimReleased,
  executeTrust,
} = useHeritageTrusts();

const { saveTrustName } = useHeritageBeneficiaries();

const newTrust = ref({
  name: "",
  beneficiary: "",
  neoValue: "10",
  gasValue: "0",
  monthlyNeo: "1",
  monthlyGas: "0",
  releaseMode: "neoRewards",
  intervalDays: "30",
  notes: "",
});

const handleCreate = async () => {
  const neoAmount = Number(toFixedDecimals(newTrust.value.neoValue, 0));
  let gasAmountDisplay = Number.parseFloat(newTrust.value.gasValue);
  if (!Number.isFinite(gasAmountDisplay)) gasAmountDisplay = 0;

  let monthlyNeoAmount = Number(toFixedDecimals(newTrust.value.monthlyNeo, 0));
  let monthlyGasDisplay = Number.parseFloat(newTrust.value.monthlyGas);
  if (!Number.isFinite(monthlyGasDisplay)) monthlyGasDisplay = 0;
  const intervalDays = Number(toFixedDecimals(newTrust.value.intervalDays, 0));
  const releaseMode = newTrust.value.releaseMode;

  const onlyRewards = releaseMode === "rewardsOnly";
  if (releaseMode !== "fixed") {
    newTrust.value.gasValue = "0";
    newTrust.value.monthlyGas = "0";
  }
  if (releaseMode === "rewardsOnly") {
    monthlyNeoAmount = 0;
  }
  if (neoAmount <= 0) {
    monthlyNeoAmount = 0;
  }
  if (gasAmountDisplay <= 0) {
    monthlyGasDisplay = 0;
  }

  if (
    isLoading.value ||
    !newTrust.value.name.trim() ||
    !newTrust.value.beneficiary ||
    !(neoAmount > 0 || gasAmountDisplay > 0) ||
    !(intervalDays > 0)
  ) {
    return;
  }

  try {
    isLoading.value = true;
    status.value = { msg: t("creating"), type: "loading" };

    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("error"));
    }

    if (onlyRewards && neoAmount <= 0) {
      throw new Error(t("rewardsRequireNeo"));
    }
    if (!onlyRewards && neoAmount > 0 && monthlyNeoAmount <= 0) {
      throw new Error(t("invalidReleaseSchedule"));
    }
    if (releaseMode === "fixed" && gasAmountDisplay > 0 && monthlyGasDisplay <= 0) {
      throw new Error(t("invalidReleaseSchedule"));
    }

    const neo = await getBalance("NEO");
    const neoBalance = typeof neo === "string" ? parseFloat(neo) || 0 : typeof neo === "number" ? neo : 0;
    if (neoAmount > neoBalance) {
      throw new Error(t("insufficientNeo"));
    }
    if (gasAmountDisplay > 0) {
      const gas = await getBalance("GAS");
      const gasBalance = typeof gas === "string" ? parseFloat(gas) || 0 : typeof gas === "number" ? gas : 0;
      if (gasAmountDisplay > gasBalance) {
        throw new Error(t("insufficientGas"));
      }
    }

    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    const contract = await getContractAddress();
    if (!contract) {
      throw new Error(t("error"));
    }

    const tx = await invokeContract({
      scriptHash: contract,
      operation: "createTrust",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: newTrust.value.beneficiary },
        { type: "Integer", value: neoAmount },
        { type: "Integer", value: toFixed8(gasAmountDisplay) },
        { type: "Integer", value: intervalDays },
        { type: "Integer", value: monthlyNeoAmount },
        { type: "Integer", value: toFixed8(monthlyGasDisplay) },
        { type: "Boolean", value: onlyRewards },
        { type: "String", value: newTrust.value.name.trim().slice(0, 100) },
        { type: "String", value: newTrust.value.notes.trim().slice(0, 300) },
        { type: "Integer", value: "0" },
      ],
    });

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
    );
    if (txid) {
      // Wait for TrustCreated event
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { useEvents } = await import("@neo/uniapp-sdk");
        const { list } = useEvents();
        const res = await list({ app_id: "miniapp-heritage-trust", event_name: "TrustCreated", limit: 25 });
        const match = res.events.find((evt) => evt.tx_hash === txid);
        if (match) {
          const values = Array.isArray(match.state) ? match.state.map(parseStackItem) : [];
          const trustId = String(values[0] || "");
          if (trustId) {
            saveTrustName(trustId, newTrust.value.name);
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    status.value = { msg: t("trustCreated"), type: "success" };
    // Reset form
    newTrust.value = {
      name: "",
      beneficiary: "",
      neoValue: "10",
      gasValue: "0",
      monthlyNeo: "1",
      monthlyGas: "0",
      releaseMode: "neoRewards",
      intervalDays: "30",
      notes: "",
    };

    await fetchData();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./heritage-trust-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--heritage-bg-start) 0%, var(--heritage-bg-end) 100%);
  min-height: 100vh;
  color: var(--heritage-text);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  color: var(--heritage-text);
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mine-dashboard {
  display: flex;
  flex-direction: column;
}

.mb-4 {
  margin-bottom: 16px;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
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
