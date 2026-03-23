<template>
  <NeoCard class="generator-card" :title="t('genTitle')">
    <div class="toolbar">
      <NeoButton type="button" variant="primary" @click="handleGenerate">
        {{ t("btnGenerate") }}
      </NeoButton>
      <NeoButton
        v-if="account"
        type="button"
        variant="secondary"
        @click="showSecrets = !showSecrets"
      >
        {{ showSecrets ? t("hideSecrets") : t("showSecrets") }}
      </NeoButton>
      <NeoButton
        v-if="account"
        type="button"
        variant="secondary"
        @click="downloadPdf"
      >
        {{ t("downloadPdf") }}
      </NeoButton>
    </div>

    <div v-if="!account" class="empty-state">
      <span class="empty-title">{{ t("genEmptyState") }}</span>
      <span class="empty-sub">{{ t("genEmptySub") }}</span>
    </div>

    <div v-else class="account-grid">
      <div class="field-card">
        <span class="field-label">{{ t("address") }}</span>
        <code class="field-value">{{ account.address }}</code>
        <div class="field-actions">
          <NeoButton size="sm" variant="secondary" type="button" @click="copyValue(account.address)">
            {{ t("copyAddress") }}
          </NeoButton>
        </div>
        <img v-if="addressQr" :src="addressQr" class="qr-image" :alt="t('addressQrCode')" />
      </div>

      <div class="field-card">
        <span class="field-label">{{ t("pubKey") }}</span>
        <code class="field-value">{{ account.publicKey }}</code>
        <div class="field-actions">
          <NeoButton size="sm" variant="secondary" type="button" @click="copyValue(account.publicKey)">
            {{ t("copyPublicKey") }}
          </NeoButton>
        </div>
      </div>

      <div class="field-card secret-card" :data-hidden="!showSecrets">
        <span class="field-label">{{ t("privKeyWarning") }}</span>
        <code class="field-value">{{ showSecrets ? account.privateKey : mask(account.privateKey) }}</code>
        <div class="field-actions">
          <NeoButton
            size="sm"
            variant="secondary"
            type="button"
            :disabled="!showSecrets"
            @click="copyValue(account.privateKey)"
          >
            {{ t("copyPrivateKey") }}
          </NeoButton>
        </div>
      </div>

      <div class="field-card secret-card" :data-hidden="!showSecrets">
        <span class="field-label">{{ t("wifWarning") }}</span>
        <code class="field-value">{{ showSecrets ? account.wif : mask(account.wif) }}</code>
        <div class="field-actions">
          <NeoButton
            size="sm"
            variant="secondary"
            type="button"
            :disabled="!showSecrets"
            @click="copyValue(account.wif)"
          >
            {{ t("copyWif") }}
          </NeoButton>
        </div>
        <img v-if="showSecrets && wifQr" :src="wifQr" class="qr-image" :alt="t('wifQrCode')" />
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { NeoButton, NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { messages } from "@/locale/messages";
import { type NeoAccount, generateAccount } from "@/services/neo";

const { t } = createUseI18n(messages)();
const { setStatus } = useStatusMessage(3000);

const account = ref<NeoAccount | null>(null);
const showSecrets = ref(false);
const addressQr = ref("");
const wifQr = ref("");

const mask = (value: string): string => (value ? `${value.slice(0, 6)}••••••${value.slice(-4)}` : "");

const copyValue = (value: string) => {
  uni.setClipboardData({
    data: value,
    success: () => setStatus(t("copied"), "success"),
  });
};

const refreshQrCodes = async (nextAccount: NeoAccount) => {
  addressQr.value = await QRCode.toDataURL(nextAccount.address, {
    margin: 1,
    width: 192,
  });
  wifQr.value = await QRCode.toDataURL(nextAccount.wif, {
    margin: 1,
    width: 192,
  });
};

const handleGenerate = async () => {
  const nextAccount = generateAccount();
  account.value = nextAccount;
  showSecrets.value = false;
  await refreshQrCodes(nextAccount);
};

const downloadPdf = async () => {
  if (!account.value) return;
  if (!addressQr.value || !wifQr.value) {
    await refreshQrCodes(account.value);
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  pdf.setFillColor(12, 17, 31);
  pdf.rect(0, 0, 595, 842, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(t("paperWalletTitle"), 40, 52);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(148, 163, 184);
  pdf.text(t("paperWalletTagline"), 40, 72);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text(t("paperWalletPublicTitle"), 40, 116);
  pdf.addImage(addressQr.value, "PNG", 40, 132, 156, 156);
  pdf.setFontSize(9);
  pdf.text(account.value.address, 40, 310, { maxWidth: 220 });
  pdf.setTextColor(148, 163, 184);
  pdf.text(t("paperWalletPublicNote"), 40, 328);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text(t("paperWalletPrivateTitle"), 320, 116);
  pdf.addImage(wifQr.value, "PNG", 320, 132, 156, 156);
  pdf.setFontSize(9);
  pdf.text(account.value.wif, 320, 310, { maxWidth: 220 });
  pdf.setTextColor(248, 113, 113);
  pdf.text(t("paperWalletPrivateNote"), 320, 328);

  pdf.setTextColor(226, 232, 240);
  pdf.setFontSize(10);
  pdf.text(`${t("pubKey")}:`, 40, 388);
  pdf.text(account.value.publicKey, 40, 404, { maxWidth: 500 });
  pdf.text(`${t("privKeyLabel")}:`, 40, 448);
  pdf.text(account.value.privateKey, 40, 464, { maxWidth: 500 });

  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(9);
  pdf.text(t("paperWalletFooter"), 40, 804, { maxWidth: 520 });
  pdf.save(`neo-n3-paper-wallet-${account.value.address}.pdf`);
};
</script>

<style scoped lang="scss">
.generator-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border: 1px dashed var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
}

.empty-sub {
  color: var(--text-secondary);
  font-size: 13px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.04);
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.field-value {
  font-size: 12px;
  line-height: 1.6;
  white-space: break-spaces;
  word-break: break-all;
}

.field-actions {
  display: flex;
  gap: 8px;
}

.secret-card[data-hidden="true"] {
  filter: saturate(0.7);
}

.qr-image {
  width: 148px;
  height: 148px;
  object-fit: contain;
  border-radius: 12px;
  background: white;
  padding: 8px;
}

@media (max-width: 767px) {
  .account-grid {
    grid-template-columns: 1fr;
  }

  .qr-image {
    width: 128px;
    height: 128px;
  }
}
</style>
