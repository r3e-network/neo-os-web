<template>
  <view class="generator-container">
    <NeoCard>
      <view class="header">
        <view class="brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4H28V28H4V4Z" fill="#00E599"/>
            <path d="M22.5 10L16.5 10L16.5 13.5L13.5 13.5L13.5 10L9.5 10L9.5 22L13.5 22L13.5 18.5L16.5 18.5L16.5 22L22.5 22L22.5 10Z" fill="white"/>
            <path d="M13.5 13.5L16.5 13.5L16.5 18.5L13.5 18.5L13.5 13.5Z" fill="#00E599"/>
          </svg>
          <text class="title">{{ t('genTitle') }}</text>
        </view>
        <NeoButton size="sm" @click="generateNew" :disabled="isGenerating">
          <text v-if="!isGenerating">{{ t('btnGenerate') }}</text>
          <text v-else>{{ t('loading') }}</text>
        </NeoButton>
      </view>

      <view v-if="account" class="account-details">
        <ScrollReveal animation="slide-left" :delay="100">
          <view class="field-group">
            <text class="label">{{ t('address') }}</text>
            <view class="value-row">
              <text class="value">{{ account.address }}</text>
              <view class="copy-btn" @click="copy(account.address)" role="button" :aria-label="t('copyAddress')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="200">
          <view class="field-group">
            <text class="label">{{ t('pubKey') }}</text>
            <view class="value-row">
              <text class="value truncate">{{ account.publicKey }}</text>
              <view class="copy-btn" @click="copy(account.publicKey)" role="button" :aria-label="t('copyPublicKey')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="300">
          <view class="field-group warning-group">
            <view class="label-row">
               <text class="label warning">{{ t('privKeyWarning') }}</text>
               <text class="badge-private">{{ t('privateBadge') }}</text>
            </view>
            <view class="value-row">
              <text class="value blur" :class="{ revealed: showSecrets }">{{ account.privateKey }}</text>
              <view class="action-btn" @click="showSecrets = !showSecrets" role="button" :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')">
                <text class="icon" aria-hidden="true">{{ showSecrets ? '🙈' : '👁️' }}</text>
              </view>
              <view class="copy-btn" @click="copy(account.privateKey)" role="button" :aria-label="t('copyPrivateKey')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="400">
          <view class="field-group warning-group">
            <view class="label-row">
               <text class="label warning">{{ t('wifWarning') }}</text>
               <text class="badge-private">{{ t('privateBadge') }}</text>
            </view>
            <view class="value-row">
              <text class="value blur" :class="{ revealed: showSecrets }">{{ account.wif }}</text>
              <view class="copy-btn" @click="copy(account.wif)" role="button" :aria-label="t('copyWif')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="fade-up" :delay="500">
          <view class="qr-preview" v-if="addressQr">
             <view class="qr-card">
               <text class="qr-label">{{ t('address') }}</text>
               <view class="qr-bg">
                 <image :src="addressQr" class="qr-img" :alt="t('addressQrCode')" />
               </view>
             </view>
             <view class="qr-card">
               <text class="qr-label">{{ t('wifLabel') }}</text>
               <view class="qr-bg">
                 <image :src="wifQr" class="qr-img blur" :class="{ revealed: showSecrets }" :alt="t('wifQrCode')" />
               </view>
             </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="fade-up" :delay="600">
          <view class="actions">
            <NeoButton variant="primary" @click="downloadPdf" class="download-btn">
              <text class="btn-icon">📥</text> {{ t('downloadPdf') }}
            </NeoButton>
          </view>
        </ScrollReveal>
      </view>
      
      <ScrollReveal animation="fade-up" v-else>
        <view class="empty-state">
           <svg class="empty-logo" width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#00E599" fill-opacity="0.1"/>
              <path d="M9 9H23V23H9V9Z" fill="#00E599"/>
              <path d="M19.5 13L15.5 13L15.5 15.3333L13.5 15.3333L13.5 13L10.8333 13L10.8333 21L13.5 21L13.5 18.6667L15.5 18.6667L15.5 21L19.5 21L19.5 13Z" fill="white"/>
              <path d="M13.5 15.3333L15.5 15.3333L15.5 18.6667L13.5 18.6667L13.5 15.3333Z" fill="#00E599"/>
           </svg>
           <text class="empty-text">{{ t('genEmptyState') }}</text>
           <text class="empty-sub">{{ t('genEmptySub') }}</text>
        </view>
      </ScrollReveal>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue";
import { generateAccount, type NeoAccount } from "@/services/neo";
import { useI18n } from "@/composables/useI18n";
import QRCode from "qrcode";
import jsPDF from "jspdf";

const { t } = useI18n();
const account = ref<NeoAccount | null>(null);
const showSecrets = ref(false);
const addressQr = ref("");
const wifQr = ref("");
const isGenerating = ref(false);

const generateNew = async () => {
  isGenerating.value = true;
  setTimeout(async () => {
    account.value = generateAccount();
    showSecrets.value = false;
    if (account.value) {
      try {
        addressQr.value = await QRCode.toDataURL(account.value.address, { margin: 1 });
        wifQr.value = await QRCode.toDataURL(account.value.wif, { margin: 1 });
      } catch(e) {
        // QR generation error - silent fail
      }
    }
    isGenerating.value = false;
  }, 50);
};

const copy = (text: string) => {
  // @ts-ignore
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: t("copied"), icon: "none" })
  });
};

const downloadPdf = () => {
  if (!account.value || !addressQr.value || !wifQr.value) return;

  // Enhance PDF Quality
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Brand Colors
  const neoGreen = "#00E599";
  const neoDark = "#121212";
  const neoGrey = "#1F2937";

  // --- Background & Layout (Foldable Design) ---
  
  // Background Fill
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, width, height, 'F');
  
  // Top Banner (Header)
  doc.setFillColor(neoDark);
  doc.rect(0, 0, width, 40, 'F');
  
  // Center Fold Line (Dashed)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([5, 5], 0);
  doc.line(centerX, 40, centerX, height - 20);
  doc.setLineDashPattern([], 0);

  // --- Header Content ---
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(t("paperWalletTitle"), centerX, 25, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(neoGreen);
  doc.text(t("paperWalletTagline"), centerX, 32, { align: "center" });

  // --- LEFT SIDE: PUBLIC (Green Theme) ---
  const leftX = centerX / 2;
  const contentStart = 60;
  
  // Public Badge
  doc.setFillColor(235, 255, 245);
  doc.setDrawColor(neoGreen);
  doc.roundedRect(20, contentStart, centerX - 40, height - 100, 5, 5, 'FD');

  doc.setTextColor(0, 150, 80);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(t("paperWalletPublicTitle"), leftX, contentStart + 15, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(t("paperWalletPublicNote"), leftX, contentStart + 22, { align: "center" });
  
  // Public QR
  doc.addImage(addressQr.value, "PNG", leftX - 35, contentStart + 30, 70, 70);
  
  // Address Text
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("courier", "bold");
  doc.text(account.value.address, leftX, contentStart + 115, { align: "center" });

  // --- RIGHT SIDE: PRIVATE (Dark/Red Theme) ---
  const rightX = centerX + (centerX / 2);
  
  // Private Badge
  doc.setFillColor(255, 240, 240);
  doc.setDrawColor(200, 50, 50);
  doc.roundedRect(centerX + 20, contentStart, centerX - 40, height - 100, 5, 5, 'FD');

  doc.setTextColor(200, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(t("paperWalletPrivateTitle"), rightX, contentStart + 15, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(t("paperWalletPrivateNote"), rightX, contentStart + 22, { align: "center" });
  
  // WIF QR
  doc.addImage(wifQr.value, "PNG", rightX - 35, contentStart + 30, 70, 70);
  
  // WIF Text
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  const wifSplit = doc.splitTextToSize(account.value.wif, 80);
  doc.text(wifSplit, rightX, contentStart + 115, { align: "center" });

  // --- Footer ---
  doc.setFillColor(neoGrey);
  doc.rect(0, height - 20, width, 20, 'F');
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(t("paperWalletFooter"), centerX, height - 8, { align: "center" });

  doc.save(`neo-wallet-${account.value.address.slice(0, 8)}.pdf`);
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
    &.revealed { filter: none; user-select: text; }
  }
}

.copy-btn, .action-btn {
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
    &.revealed { filter: none; }
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
</style>
