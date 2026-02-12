<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :title="t('docsTab')" :show-top-nav="true" show-back @back="goBack">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
      <text>{{ status.msg }}</text>
    </NeoCard>
    <NeoDoc
      :title="t('docTitle')"
      :subtitle="t('docSubtitle')"
      :description="t('docDescription')"
      :steps="docSteps"
      :features="docFeatures"
    />
    <NeoCard :title="t('contractFeatureName')" variant="erobo" class="contract-card">
      <view class="contract-row">
        <view class="contract-head">
          <text class="contract-label">{{ t("contractAddressLabel") }}</text>
          <view class="contract-badge">
            <text class="contract-badge__text">{{ networkLabel }}</text>
          </view>
        </view>
        <view class="contract-value-row">
          <text class="contract-value">{{ contractAddress || t("contractUnavailable") }}</text>
          <NeoButton size="sm" variant="secondary" :disabled="!contractAddress" class="copy-btn" @click="copyContract">
            {{ t("copy") }}
          </NeoButton>
        </view>
      </view>
    </NeoCard>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { WalletSDK } from "@neo/types";
import { useWallet } from "@neo/uniapp-sdk";
import { ResponsiveLayout, NeoButton, NeoCard, NeoDoc } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";

const { t } = useI18n();
const { status, setStatus } = useStatusMessage(5000);
const { chainId, appChainId, getContractAddress } = useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);

const networkLabel = computed(() => {
  const id = String(appChainId?.value || chainId?.value || "");
  if (id.includes("mainnet")) return t("networkMainnet");
  if (id.includes("testnet")) return t("networkTestnet");
  return t("networkUnknown");
});

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const loadContractAddress = async () => {
  try {
    contractAddress.value = await getContractAddress();
  } catch {
    contractAddress.value = null;
  }
};

const copyContract = () => {
  if (!contractAddress.value) return;
  uni.setClipboardData({
    data: contractAddress.value,
    success: () => {
      setStatus(t("copied"), "success");
    },
    fail: () => {
      setStatus(t("copyFailed"), "error");
    },
  });
};

onMounted(() => {
  void loadContractAddress();
});

const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;

.contract-card {
  margin: 0 20px 24px;
}

.contract-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.contract-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.contract-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.contract-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 229, 153, 0.15);
  border: 1px solid rgba(0, 229, 153, 0.35);
}

.contract-badge__text {
  font-size: 10px;
  font-weight: 700;
  color: var(--album-accent, #00e599);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.contract-value-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contract-value {
  font-family: $font-mono;
  font-size: 12px;
  color: var(--text-primary, rgba(255, 255, 255, 0.9));
  word-break: break-all;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.2));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.copy-btn {
  align-self: flex-start;
}
</style>
