<template>
  <view class="theme-neo-sign-anything">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="onTabChange"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <view class="header">
            <text class="title">{{ t("signTitle") }}</text>
            <text class="subtitle">{{ t("signDesc") }}</text>
          </view>

          <view v-if="signature" class="result-card">
            <NeoCard variant="erobo-neo">
              <view class="result-header">
                <text class="result-title">{{ t("signatureResult") }}</text>
                <view class="copy-btn" @click="copyToClipboard(signature)">
                  <text class="copy-text">{{ t("copy") }}</text>
                </view>
              </view>
              <text class="result-text">{{ signature }}</text>
            </NeoCard>
          </view>

          <view v-if="txHash" class="result-card">
            <NeoCard variant="erobo-purple">
              <view class="result-header">
                <text class="result-title">{{ t("broadcastResult") }}</text>
                <view class="copy-btn" @click="copyToClipboard(txHash)">
                  <text class="copy-text">{{ t("copy") }}</text>
                </view>
              </view>
              <text class="result-text">{{ txHash }}</text>
              <text class="success-msg">{{ t("broadcastSuccess") }}</text>
            </NeoCard>
          </view>

          <view v-if="!address" class="connect-prompt">
            <text class="connect-text">{{ t("connectWallet") }}</text>
          </view>
        </ErrorBoundary>
      </template>

      <template #operation>
        <NeoCard variant="erobo">
          <view class="input-group">
            <NeoInput
              type="textarea"
              v-model="message"
              :label="t('messageLabel')"
              :placeholder="t('messagePlaceholder')"
            />
            <view class="char-count">{{ message.length }}/1000</view>
          </view>

          <view class="actions">
            <NeoButton
              variant="primary"
              block
              :loading="isSigning"
              @click="signMessage"
              :disabled="!message || !address"
            >
              {{ t("signBtn") }}
            </NeoButton>

            <NeoButton
              variant="ghost"
              block
              :loading="isBroadcasting"
              @click="broadcastMessage"
              :disabled="!message || !address"
              class="broadcast-btn"
            >
              {{ t("broadcastBtn") }}
            </NeoButton>
          </view>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { MiniAppTemplate, NeoCard, NeoButton, NeoInput, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import messages from "@/locale/messages";
import { useSignAnything } from "./composables/useSignAnything";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "home", labelKey: "home", icon: "🏠", default: true },
  ],
});

const {
  address,
  message,
  signature,
  txHash,
  isSigning,
  isBroadcasting,
  status,
  appState,
  sidebarItems,
  onTabChange,
  signMessage,
  broadcastMessage,
  copyToClipboard,
} = useSignAnything(t);

const { handleBoundaryError, resetAndReload } = useHandleBoundaryError("neo-sign-anything");
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./neo-sign-anything-theme.scss";
@import "./sign-anything-components";

@include page-background(var(--bg-primary));

.header {
  margin-bottom: 8px;
}

.title {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.broadcast-btn {
  margin-top: 12px;
}

@media (max-width: 767px) {
  .title {
    font-size: 22px;
  }
  .subtitle {
    font-size: 13px;
  }
  .textarea {
    height: 100px;
  }
}
</style>
