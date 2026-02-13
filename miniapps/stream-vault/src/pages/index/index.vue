<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    class="theme-stream-vault"
    @tab-change="activeTab = $event"
  >
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <template #content>
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
        <view class="vaults-header">
          <text class="section-title">{{ t("vaultsTab") }}</text>
          <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="refreshStreams">
            {{ t("refresh") }}
          </NeoButton>
        </view>

        <view v-if="!address" class="empty-state">
          <NeoCard variant="erobo" class="p-6 text-center">
            <text class="mb-3 block text-sm">{{ t("walletNotConnected") }}</text>
            <NeoButton size="sm" variant="primary" @click="connectWallet">
              {{ t("connectWallet") }}
            </NeoButton>
          </NeoCard>
        </view>

        <view v-else class="streams-container">
          <StreamList :streams="createdStreams" :label="t('myCreated')" :empty-text="t('emptyVaults')" type="created">
            <template #actions="{ stream: s }">
              <NeoButton
                size="sm"
                variant="secondary"
                :loading="cancellingId === s.id"
                :disabled="s.status !== 'active'"
                @click="cancelStream(s)"
              >
                {{ cancellingId === s.id ? t("cancelling") : t("cancel") }}
              </NeoButton>
            </template>
          </StreamList>

          <StreamList
            :streams="beneficiaryStreams"
            :label="t('beneficiaryVaults')"
            :empty-text="t('emptyVaults')"
            type="beneficiary"
          >
            <template #actions="{ stream: s }">
              <NeoButton
                size="sm"
                variant="primary"
                :loading="claimingId === s.id"
                :disabled="s.status !== 'active' || s.claimable === 0n"
                @click="claimStream(s)"
              >
                {{ claimingId === s.id ? t("claiming") : t("claim") }}
              </NeoButton>
            </template>
          </StreamList>
        </view>
      </ErrorBoundary>
    </template>

    <template #operation>
      <StreamCreateForm :loading="isLoading" @create="handleCreateVault" />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, NeoButton, ErrorBoundary, SidebarPanel } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import StreamCreateForm from "@/components/StreamCreateForm.vue";
import StreamList from "@/components/StreamList.vue";
import { useStreamVault } from "./composables/useStreamVault";

const { t } = createUseI18n(messages)();

const activeTab = ref("create");

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "create", labelKey: "createTab", icon: "➕", default: true },
  ],
  docFeatureCount: 3,
});

const {
  address,
  createdStreams,
  beneficiaryStreams,
  isLoading,
  isRefreshing,
  claimingId,
  cancellingId,
  status,
  appState,
  sidebarItems,
  refreshStreams,
  connectWallet,
  handleCreateVault,
  claimStream,
  cancelStream,
} = useStreamVault(t);

const { handleBoundaryError } = useHandleBoundaryError("stream-vault");
const resetAndReload = async () => {
  if (address.value) refreshStreams();
};

onMounted(() => {
  if (address.value) {
    refreshStreams();
  }
});

watch(activeTab, (next) => {
  if (next === "vaults" && address.value) {
    refreshStreams();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./stream-vault-theme.scss";

@include page-background(
  linear-gradient(135deg, var(--stream-bg-start) 0%, var(--stream-bg-end) 100%),
  (
    color: var(--stream-text),
  )
);

.vaults-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.streams-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  margin-top: 10px;
}
</style>
