<template>
  <view class="theme-neo-sign-anything">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="onTabChange">
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="container">
          <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
            <text>{{ status.msg }}</text>
          </NeoCard>

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
        </view>
      </template>

      <template #operation>
        <view class="container">
          <NeoCard variant="erobo">
            <view class="input-group">
              <text class="label">{{ t("messageLabel") }}</text>
              <textarea v-model="message" class="textarea" :placeholder="t('messagePlaceholder')" maxlength="1000" />
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
                style="margin-top: 12px"
              >
                {{ t("broadcastBtn") }}
              </NeoButton>
            </view>
          </NeoCard>
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { MiniAppTemplate, NeoCard, NeoButton, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useSignAnything } from "./composables/useSignAnything";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "home", labelKey: "home", icon: "🏠", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
  },
};

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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-sign-anything-theme.scss";
@import "./sign-anything-components";

:global(page) {
  background: var(--bg-primary);
}

.container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chain-warning {
  margin-bottom: 8px;
}

.chain-warning__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chain-warning__title {
  font-size: 13px;
  font-weight: 700;
}

.chain-warning__desc {
  font-size: 12px;
  color: var(--text-secondary);
}

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

/* Mobile-specific styles */
@media (max-width: 767px) {
  .container {
    padding: 16px;
    gap: 16px;
  }
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

/* Desktop styles */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
    max-width: 700px;
    margin: 0 auto;
  }
  .title {
    font-size: 32px;
  }
}

// Desktop sidebar
</style>
