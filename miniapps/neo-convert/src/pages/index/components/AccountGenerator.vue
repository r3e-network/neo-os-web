<template>
  <view class="generator-container">
    <NeoCard>
      <view class="header">
        <view class="brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 4H28V28H4V4Z" fill="#00E599" />
            <path
              d="M22.5 10L16.5 10L16.5 13.5L13.5 13.5L13.5 10L9.5 10L9.5 22L13.5 22L13.5 18.5L16.5 18.5L16.5 22L22.5 22L22.5 10Z"
              fill="white"
            />
            <path d="M13.5 13.5L16.5 13.5L16.5 18.5L13.5 18.5L13.5 13.5Z" fill="#00E599" />
          </svg>
          <text class="title">{{ t("genTitle") }}</text>
        </view>
        <NeoButton size="sm" @click="generateNew" :disabled="isGenerating">
          <text v-if="!isGenerating">{{ t("btnGenerate") }}</text>
          <text v-else>{{ t("loading") }}</text>
        </NeoButton>
      </view>

      <view v-if="status" class="status-bar" :class="status.type">
        <text class="status-text">{{ status.msg }}</text>
      </view>

      <AccountDetails
        v-if="account"
        :account="account"
        :show-secrets="showSecrets"
        :address-qr="addressQr"
        :wif-qr="wifQr"
        :t="t"
        @copy="copy"
        @toggle-secrets="showSecrets = !showSecrets"
        @download-pdf="downloadPdf"
      />

      <ScrollReveal animation="fade-up" v-else>
        <view class="empty-state">
          <svg
            class="empty-logo"
            width="64"
            height="64"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z"
              fill="#00E599"
              fill-opacity="0.1"
            />
            <path d="M9 9H23V23H9V9Z" fill="#00E599" />
            <path
              d="M19.5 13L15.5 13L15.5 15.3333L13.5 15.3333L13.5 13L10.8333 13L10.8333 21L13.5 21L13.5 18.6667L15.5 18.6667L15.5 21L19.5 21L19.5 13Z"
              fill="white"
            />
            <path d="M13.5 15.3333L15.5 15.3333L15.5 18.6667L13.5 18.6667L13.5 15.3333Z" fill="#00E599" />
          </svg>
          <text class="empty-text">{{ t("genEmptyState") }}</text>
          <text class="empty-sub">{{ t("genEmptySub") }}</text>
        </view>
      </ScrollReveal>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue";
import AccountDetails from "./AccountDetails.vue";
import { generateAccount, type NeoAccount } from "@/services/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useWalletPdf } from "../composables/useWalletPdf";
import QRCode from "qrcode";

const { t } = createUseI18n(messages)();
const { status, setStatus } = useStatusMessage(3000);
const { generate: generatePdf } = useWalletPdf(t);
const account = ref<NeoAccount | null>(null);
const showSecrets = ref(false);
const addressQr = ref("");
const wifQr = ref("");
const isGenerating = ref(false);
let generateTimer: ReturnType<typeof setTimeout> | null = null;

const generateNew = async () => {
  isGenerating.value = true;
  if (generateTimer) clearTimeout(generateTimer);
  generateTimer = setTimeout(async () => {
    account.value = generateAccount();
    showSecrets.value = false;
    if (account.value) {
      try {
        addressQr.value = await QRCode.toDataURL(account.value.address, { margin: 1 });
        wifQr.value = await QRCode.toDataURL(account.value.wif, { margin: 1 });
      } catch (_e: unknown) {
        // QR generation error - silent fail
      }
    }
    isGenerating.value = false;
    generateTimer = null;
  }, 50);
};

onUnmounted(() => {
  if (generateTimer) clearTimeout(generateTimer);
});

const copy = (text: string) => {
  uni.setClipboardData({
    data: text,
    success: () => setStatus(t("copied"), "success"),
  });
};

const downloadPdf = () => {
  if (!account.value || !addressQr.value || !wifQr.value) return;
  generatePdf(account.value, addressQr.value, wifQr.value);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.generator-container {
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;

  .empty-logo {
    margin-bottom: 20px;
    opacity: 0.9;
  }

  .empty-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .empty-sub {
    font-size: 14px;
    color: var(--text-secondary);
    max-width: 250px;
    line-height: 1.5;
  }
}

.status-bar {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  text-align: center;

  &.success {
    background: rgba(0, 229, 153, 0.12);
    border: 1px solid rgba(0, 229, 153, 0.3);
  }
  &.error {
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.3);
  }

  .status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
}
</style>
