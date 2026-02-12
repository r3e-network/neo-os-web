<template>
  <view class="account-details">
    <ScrollReveal animation="slide-left" :delay="100">
      <view class="field-group">
        <text class="label">{{ t("address") }}</text>
        <view class="value-row">
          <text class="value">{{ account.address }}</text>
          <view class="copy-btn" @click="$emit('copy', account.address)" role="button" tabindex="0" :aria-label="t('copyAddress')" @keydown.enter="$emit('copy', account.address)">
            <text class="icon" aria-hidden="true">📋</text>
          </view>
        </view>
      </view>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="200">
      <view class="field-group">
        <text class="label">{{ t("pubKey") }}</text>
        <view class="value-row">
          <text class="value truncate">{{ account.publicKey }}</text>
          <view class="copy-btn" @click="$emit('copy', account.publicKey)" role="button" tabindex="0" :aria-label="t('copyPublicKey')" @keydown.enter="$emit('copy', account.publicKey)">
            <text class="icon" aria-hidden="true">📋</text>
          </view>
        </view>
      </view>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="300">
      <view class="field-group warning-group">
        <view class="label-row">
          <text class="label warning">{{ t("privKeyWarning") }}</text>
          <text class="badge-private">{{ t("privateBadge") }}</text>
        </view>
        <view class="value-row">
          <text class="value blur" :class="{ revealed: showSecrets }">{{ account.privateKey }}</text>
          <view
            class="action-btn"
            @click="$emit('toggle-secrets')"
            role="button"
            tabindex="0"
            :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
            @keydown.enter="$emit('toggle-secrets')"
          >
            <text class="icon" aria-hidden="true">{{ showSecrets ? "🙈" : "👁️" }}</text>
          </view>
          <view class="copy-btn" @click="$emit('copy', account.privateKey)" role="button" tabindex="0" :aria-label="t('copyPrivateKey')" @keydown.enter="$emit('copy', account.privateKey)">
            <text class="icon" aria-hidden="true">📋</text>
          </view>
        </view>
      </view>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="400">
      <view class="field-group warning-group">
        <view class="label-row">
          <text class="label warning">{{ t("wifWarning") }}</text>
          <text class="badge-private">{{ t("privateBadge") }}</text>
        </view>
        <view class="value-row">
          <text class="value blur" :class="{ revealed: showSecrets }">{{ account.wif }}</text>
          <view class="copy-btn" @click="$emit('copy', account.wif)" role="button" tabindex="0" :aria-label="t('copyWif')" @keydown.enter="$emit('copy', account.wif)">
            <text class="icon" aria-hidden="true">📋</text>
          </view>
        </view>
      </view>
    </ScrollReveal>

    <ScrollReveal animation="fade-up" :delay="500">
      <view class="qr-preview" v-if="addressQr">
        <view class="qr-card">
          <text class="qr-label">{{ t("address") }}</text>
          <view class="qr-bg">
            <image :src="addressQr" class="qr-img" :alt="t('addressQrCode')" />
          </view>
        </view>
        <view class="qr-card">
          <text class="qr-label">{{ t("wifLabel") }}</text>
          <view class="qr-bg">
            <image :src="wifQr" class="qr-img blur" :class="{ revealed: showSecrets }" :alt="t('wifQrCode')" />
          </view>
        </view>
      </view>
    </ScrollReveal>

    <ScrollReveal animation="fade-up" :delay="600">
      <view class="actions">
        <NeoButton variant="primary" @click="$emit('download-pdf')" class="download-btn">
          <text class="btn-icon">📥</text> {{ t("downloadPdf") }}
        </NeoButton>
      </view>
    </ScrollReveal>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue";
import type { NeoAccount } from "@/services/neo";

defineProps<{
  account: NeoAccount;
  showSecrets: boolean;
  addressQr: string;
  wifQr: string;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "copy", text: string): void;
  (e: "toggle-secrets"): void;
  (e: "download-pdf"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.field-group {
  margin-bottom: 20px;

  &.warning-group {
    background: var(--convert-danger-bg);
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed var(--convert-danger-border);

    .value-row {
      background: var(--convert-danger-surface);
      border: 1px solid var(--convert-danger-border);
    }
  }
}

.label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--convert-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;

  &.warning {
    color: var(--convert-danger-text);
  }
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge-private {
  font-size: 9px;
  background: var(--convert-danger-chip-bg);
  color: var(--convert-danger-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--convert-panel-bg);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--convert-panel-border);
  transition: all 0.2s;

  &:hover {
    background: var(--convert-panel-hover);
    border-color: var(--convert-panel-hover-border);
  }
}

.value {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
  color: var(--text-primary, #fff);
  line-height: 1.4;

  &.truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.blur {
    filter: blur(5px);
    transition: filter 0.3s;
    user-select: none;
    &.revealed {
      filter: none;
      user-select: text;
    }
  }
}

.copy-btn,
.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  background: var(--convert-copy-bg);
  transition: all 0.2s;

  &:active {
    transform: scale(0.95);
    background: var(--convert-copy-bg-active);
  }

  .icon {
    font-size: 14px;
    line-height: 1;
  }
}

.qr-preview {
  display: flex;
  gap: 20px;
  margin: 30px 0;
  justify-content: center;
  flex-wrap: wrap;
}

.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-bg {
  background: var(--convert-qr-bg);
  padding: 10px;
  border-radius: 12px;
  box-shadow: var(--convert-qr-shadow);
}

.qr-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.qr-img {
  width: 120px;
  height: 120px;
  display: block;

  &.blur {
    filter: blur(8px);
    transition: filter 0.3s;
    &.revealed {
      filter: none;
    }
  }
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 10px;

  .btn-icon {
    margin-right: 8px;
  }
}
</style>
