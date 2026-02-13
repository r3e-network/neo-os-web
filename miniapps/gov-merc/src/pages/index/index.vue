<template>
  <view class="theme-gov-merc">
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

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <NeoCard class="mb-6" variant="erobo">
            <view class="form-group-neo">
              <NeoInput
                v-model="depositAmount"
                type="number"
                placeholder="0"
                suffix="NEO"
                :label="t('depositAmount')"
              />
              <NeoButton variant="primary" size="lg" block :loading="isBusy" @click="depositNeo">
                {{ t("depositNeo") }}
              </NeoButton>
            </view>
          </NeoCard>

          <NeoCard class="mb-6" variant="erobo">
            <view class="form-group-neo">
              <NeoInput
                v-model="withdrawAmount"
                type="number"
                placeholder="0"
                suffix="NEO"
                :label="t('withdrawAmount')"
              />
              <NeoButton variant="secondary" size="lg" block :loading="isBusy" @click="withdrawNeo">
                {{ t("withdrawNeo") }}
              </NeoButton>
            </view>
          </NeoCard>
        </ErrorBoundary>
      </template>

      <template #operation>
        <NeoCard variant="erobo" class="mb-6">
          <view class="form-group-neo">
            <NeoInput v-model="bidAmount" type="number" placeholder="0" suffix="GAS" :label="t('bidAmount')" />
            <NeoButton variant="primary" size="lg" block :loading="isBusy" @click="placeBid">
              {{ t("placeBid") }}
            </NeoButton>
          </view>
        </NeoCard>

        <NeoCard variant="erobo">
          <view v-if="bids.length === 0" class="empty-neo p-8 text-center font-bold uppercase opacity-60">
            {{ t("noBids") }}
          </view>
          <view v-for="bid in bids" :key="bid.address" class="bid-row">
            <view class="bid-address">{{ bid.address }}</view>
            <view class="bid-amount">{{ formatNum(bid.amount, 2) }} GAS</view>
          </view>
        </NeoCard>
      </template>

      <template #tab-stats>
        <NeoCard variant="erobo-neo">
          <NeoStats :stats="poolStats" />
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";
import {
  MiniAppTemplate,
  NeoButton,
  NeoInput,
  NeoCard,
  NeoStats,
  SidebarPanel,
  ErrorBoundary,
} from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useGovMercPool } from "@/composables/useGovMercPool";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "rent", labelKey: "rent", icon: "💰", default: true },
    { key: "stats", labelKey: "tabStats", icon: "📊" },
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
      ],
    },
  },
};

const activeTab = ref("rent");

const {
  address,
  depositAmount,
  withdrawAmount,
  bidAmount,
  totalPool,
  currentEpoch,
  userDeposits,
  bids,
  status,
  dataLoading,
  isBusy,
  poolStats,
  formatNum,
  depositNeo,
  withdrawNeo,
  placeBid,
} = useGovMercPool(t);

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  totalPool: totalPool.value,
  currentEpoch: currentEpoch.value,
  isLoading: dataLoading.value,
}));

const handleBoundaryError = (error: Error) => {
  console.error("[gov-merc] boundary error:", error);
};

const resetAndReload = async () => {
  // Data is loaded via useGovMercPool composable
};

const sidebarItems = computed(() => [
  { label: t("totalPool"), value: `${formatNum(totalPool.value, 0)} NEO` },
  { label: t("currentEpoch"), value: currentEpoch.value },
  { label: t("yourDeposits"), value: `${formatNum(userDeposits.value, 0)} NEO` },
  { label: t("activeBids"), value: bids.value.length },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./gov-merc-theme.scss";

:global(page) {
  background: var(--merc-bg);
}

.form-group-neo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-neo {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--merc-empty-text);
  text-align: center;
  text-shadow: var(--merc-empty-shadow);
  padding: 32px;
}

.bid-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dotted var(--merc-bid-divider);
}
.bid-address {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 10px;
  color: var(--merc-bid-address);
}
.bid-amount {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-weight: 700;
  color: var(--merc-bid-amount);
  text-shadow: var(--merc-bid-amount-shadow);
}

.status-text {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--merc-status-text);
}
</style>
