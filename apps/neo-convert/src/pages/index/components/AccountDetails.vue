<template>
  <div class="account-details">
    <ScrollReveal animation="slide-left" :delay="100">
      <div class="field-group">
        <span class="label">{{ t("address") }}</span>
        <div class="value-row">
          <span class="value">{{ account.address }}</span>
          <button
            type="button"
            class="copy-btn"
            @click="$emit('copy', account.address)"
            :aria-label="t('copyAddress')"
          >
            <AppIcon name="copy" :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="200">
      <div class="field-group">
        <span class="label">{{ t("pubKey") }}</span>
        <div class="value-row">
          <span class="value truncate">{{ account.publicKey }}</span>
          <button
            type="button"
            class="copy-btn"
            @click="$emit('copy', account.publicKey)"
            :aria-label="t('copyPublicKey')"
          >
            <AppIcon name="copy" :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="300">
      <div class="field-group warning-group">
        <div class="label-row">
          <span class="label warning">{{ t("privKeyWarning") }}</span>
          <span class="badge-private">{{ t("privateBadge") }}</span>
        </div>
        <div class="value-row">
          <span class="value blur" :class="{ revealed: showSecrets }">{{ account.privateKey }}</span>
          <button
            type="button"
            class="action-btn"
            @click="$emit('toggle-secrets')"
            :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
          >
            <AppIcon :name="showSecrets ? 'eye_hidden' : 'eye_visible'" :size="14" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="copy-btn"
            @click="$emit('copy', account.privateKey)"
            :aria-label="t('copyPrivateKey')"
          >
            <AppIcon name="copy" :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
    </ScrollReveal>

    <ScrollReveal animation="slide-left" :delay="400">
      <div class="field-group warning-group">
        <div class="label-row">
          <span class="label warning">{{ t("wifWarning") }}</span>
          <span class="badge-private">{{ t("privateBadge") }}</span>
        </div>
        <div class="value-row">
          <span class="value blur" :class="{ revealed: showSecrets }">{{ account.wif }}</span>
          <button
            type="button"
            class="copy-btn"
            @click="$emit('copy', account.wif)"
            :aria-label="t('copyWif')"
          >
            <AppIcon name="copy" :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
    </ScrollReveal>

    <ScrollReveal animation="fade-up" :delay="500">
      <div class="qr-preview" v-if="addressQr">
        <div class="qr-card">
          <span class="qr-label">{{ t("address") }}</span>
          <div class="qr-bg">
            <img :src="addressQr" class="qr-img" :alt="t('addressQrCode')" />
          </div>
        </div>
        <div class="qr-card">
          <span class="qr-label">{{ t("wifLabel") }}</span>
          <div class="qr-bg">
            <img :src="wifQr" class="qr-img blur" :class="{ revealed: showSecrets }" :alt="t('wifQrCode')" />
          </div>
        </div>
      </div>
    </ScrollReveal>

    <ScrollReveal animation="fade-up" :delay="600">
      <div class="actions">
        <NeoButton variant="primary" type="button" @click="$emit('download-pdf')" class="download-btn">
          <AppIcon name="download" :size="14" /> {{ t("downloadPdf") }}
        </NeoButton>
      </div>
    </ScrollReveal>
  </div>
</template>

<script setup lang="ts">
import { NeoButton, AppIcon } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { NeoAccount } from "@/services/neo";

defineProps<{
  account: NeoAccount;
  showSecrets: boolean;
  addressQr: string;
  wifQr: string;
}>();

const { t } = createUseI18n(messages)();

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
  border: none;
  appearance: none;
  padding: 0;

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
