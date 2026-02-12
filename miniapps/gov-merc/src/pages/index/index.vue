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
        <view class="tab-content">
          <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
            <text class="status-text font-bold tracking-wider uppercase">{{ status.msg }}</text>
          </NeoCard>

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
                {{ isBusy ? t("depositNeo") : t("depositNeo") }}
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
                {{ isBusy ? t("withdrawNeo") : t("withdrawNeo") }}
              </NeoButton>
            </view>
          </NeoCard>
        </view>
      </template>

      <template #tab-market>
        <view class="tab-content">
          <NeoCard variant="erobo" class="mb-6">
            <view class="form-group-neo">
              <NeoInput v-model="bidAmount" type="number" placeholder="0" suffix="GAS" :label="t('bidAmount')" />
              <NeoButton variant="primary" size="lg" block :loading="isBusy" @click="placeBid">
                {{ isBusy ? t("placeBid") : t("placeBid") }}
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
        </view>
      </template>

      <template #tab-stats>
        <view class="tab-content">
          <NeoCard variant="erobo-neo">
            <NeoStats :stats="poolStats" />
          </NeoCard>
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoButton, NeoInput, NeoCard, NeoStats, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useGovMercPool } from "@/composables/useGovMercPool";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "market-list",
  tabs: [
    { key: "rent", labelKey: "rent", icon: "💰", default: true },
    { key: "market", labelKey: "market", icon: "🛒" },
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

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--merc-bg);
  /* Cyberpunk Grid Floor + Fog */
  background-image:
    linear-gradient(to bottom, transparent 80%, var(--merc-grid-strong) 100%),
    linear-gradient(var(--merc-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--merc-grid) 1px, transparent 1px);
  background-size:
    100% 100%,
    40px 40px,
    40px 40px;
  min-height: 100vh;
}

/* Merc Component Overrides */
:deep(.neo-card) {
  background: var(--merc-card-bg);
  border: 1px solid var(--merc-card-border);
  border-left: 4px solid var(--merc-card-border-accent);
  border-radius: 4px;
  box-shadow: var(--merc-card-shadow);
  color: var(--merc-text);
  transform: skewX(-2deg);

  &.variant-danger {
    border-color: var(--merc-card-danger-border);
    background: var(--merc-card-danger-bg);
    color: var(--merc-card-danger-text);
  }
}

:deep(.neo-button) {
  transform: skewX(-10deg);
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.15em;
  font-style: italic;

  &.variant-primary {
    background: var(--merc-button-primary-bg);
    color: var(--merc-button-primary-text);
    border: none;
    box-shadow: var(--merc-button-primary-shadow);

    &:active {
      transform: skewX(-10deg) translate(2px, 2px);
      box-shadow: var(--merc-button-primary-shadow-pressed);
    }
  }

  &.variant-secondary {
    background: transparent;
    border: 2px solid var(--merc-button-secondary-border);
    color: var(--merc-button-secondary-text);
    box-shadow: var(--merc-button-secondary-shadow);
  }

  /* Un-skew text */
  & > view,
  & > text {
    transform: skewX(10deg);
    display: inline-block;
  }
}

:deep(.neo-input) {
  background: var(--merc-input-bg);
  border: 1px solid var(--merc-input-border);
  border-radius: 0;
  font-family: "Courier New", monospace;
  color: var(--merc-input-text);
}

.form-group-neo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-neo {
  font-family: "Courier New", monospace;
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
  font-family: "Courier New", monospace;
  font-size: 10px;
  color: var(--merc-bid-address);
}
.bid-amount {
  font-family: "Courier New", monospace;
  font-weight: 700;
  color: var(--merc-bid-amount);
  text-shadow: var(--merc-bid-amount-shadow);
}

.status-text {
  font-family: "Courier New", monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--merc-status-text);
}

.status-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--merc-status-title);
  letter-spacing: 0.08em;
}

.status-detail {
  font-size: 12px;
  text-align: center;
  color: var(--merc-status-detail);
  opacity: 0.85;
}
</style>
