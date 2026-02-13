<template>
  <view class="theme-heritage-trust">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Main Tab — LEFT panel: trust dashboard -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <!-- Main Tab — RIGHT panel: create form -->
      <template #operation>
        <TrustCreate :is-loading="isLoading" :t="t" @create="handleCreate" />
      </template>

      <template #tab-stats>
        <StatsCard :stats="stats" :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseStackItem } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";

import { useHeritageTrusts } from "@/composables/useHeritageTrusts";
import { useHeritageBeneficiaries } from "@/composables/useHeritageBeneficiaries";
import TrustList from "./components/TrustList.vue";
import BeneficiaryManager from "./components/BeneficiaryManager.vue";
import TrustCreate from "./components/TrustCreate.vue";
import StatsCard from "./components/StatsCard.vue";

const { t } = createUseI18n(messages)();
const { address, connect, invokeContract, getBalance, chainType, getContractAddress } = useWallet() as WalletSDK;

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "main", labelKey: "createTrust", icon: "➕", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
  ],
  docFeatureCount: 3,
});

const activeTab = ref("main");

const appState = computed(() => ({
  totalTrusts: myCreatedTrusts.value.length,
  beneficiaryTrusts: myBeneficiaryTrusts.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("createdTrusts"), value: myCreatedTrusts.value.length },
  { label: t("sidebarBeneficiary"), value: myBeneficiaryTrusts.value.length },
  { label: t("sidebarActive"), value: myCreatedTrusts.value.filter((tr) => tr.active !== false).length },
]);

const {
  isLoading,
  isLoadingData,
  myCreatedTrusts,
  myBeneficiaryTrusts,
  stats,
  status,
  setStatus,
  clearStatus,
  fetchData,
  heartbeatTrust,
  claimYield,
  claimReleased,
  executeTrust,
} = useHeritageTrusts();

const { saveTrustName } = useHeritageBeneficiaries();

const { handleBoundaryError } = useHandleBoundaryError("heritage-trust");
const resetAndReload = async () => {
  await fetchData();
};

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
    setStatus(t("creating"), "loading");

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
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
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

    setStatus(t("trustCreated"), "success");
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
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("error")), "error");
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

.mine-dashboard {
  display: flex;
  flex-direction: column;
}
</style>
