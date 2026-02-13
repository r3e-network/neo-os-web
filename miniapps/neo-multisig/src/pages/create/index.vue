<template>
  <view class="page-container">
    <view class="nav-header">
      <text class="back-btn" role="button" :aria-label="t('buttonBack') || 'Go back'" tabindex="0" @click="goBack" @keydown.enter="goBack">←</text>
      <view class="nav-text">
        <text class="title">{{ t("createTitle") }}</text>
        <text class="subtitle">{{ t("appSubtitle") }}</text>
      </view>
    </view>

    <view class="content">
      <CreationForm
        v-if="step === 1"
        :title="t('step1Title')"
        :description="t('step1Desc')"
        :signers="form.signers"
        :is-valid="isValidSigners"
        :next-label="t('buttonNext')"
        :t="t"
        @add-signer="addSigner"
        @remove-signer="removeSigner"
        @update-signer="updateSigner"
        @next="step = 2"
      />

      <ThresholdConfig
        v-if="step === 2"
        :title="t('step2Title')"
        :description="t('step2Desc')"
        v-model:threshold="form.threshold"
        :total-signers="form.signers.length"
        :back-label="t('buttonBack')"
        :next-label="t('buttonNext')"
        @back="step = 1"
        @next="finalizeConfig"
      />

      <NeoCard v-if="step === 3" class="step-card">
        <text class="step-title">{{ t("step3Title") }}</text>
        <text class="step-desc">{{ t("step3Desc") }}</text>

        <view class="summary-block">
          <view class="summary-row">
            <text class="label">{{ t("multisigAddressLabel") }}</text>
            <text class="value mono">{{ multisigAccount?.address || "--" }}</text>
          </view>
          <view class="summary-row">
            <text class="label">{{ t("multisigScriptHashLabel") }}</text>
            <text class="value mono">{{ multisigAccount?.scriptHash || "--" }}</text>
          </view>
        </view>

        <view class="form-group">
          <text class="label">{{ t("chainLabel") }}</text>
          <view class="pill-group" role="radiogroup" :aria-label="t('chainLabel')">
            <view
              class="pill"
              :class="{ active: form.selectedChain === 'neo-n3-mainnet' }"
              role="radio"
              :aria-checked="form.selectedChain === 'neo-n3-mainnet'"
              :aria-label="t('chainMainnet')"
              tabindex="0"
              @click="setChain('neo-n3-mainnet')"
              @keydown.enter="setChain('neo-n3-mainnet')"
            >
              <text>{{ t("chainMainnet") }}</text>
            </view>
            <view
              class="pill"
              :class="{ active: form.selectedChain === 'neo-n3-testnet' }"
              role="radio"
              :aria-checked="form.selectedChain === 'neo-n3-testnet'"
              :aria-label="t('chainTestnet')"
              tabindex="0"
              @click="setChain('neo-n3-testnet')"
              @keydown.enter="setChain('neo-n3-testnet')"
            >
              <text>{{ t("chainTestnet") }}</text>
            </view>
          </view>
        </view>

        <view class="form-group">
          <text class="label">{{ t("assetLabel") }}</text>
          <view class="asset-toggle" role="radiogroup" :aria-label="t('assetLabel')">
            <text :class="{ active: form.asset === 'GAS' }" role="radio" :aria-checked="form.asset === 'GAS'" :aria-label="t('assetGas')" tabindex="0" @click="form.asset = 'GAS'" @keydown.enter="form.asset = 'GAS'">{{ t("assetGas") }}</text>
            <text :class="{ active: form.asset === 'NEO' }" role="radio" :aria-checked="form.asset === 'NEO'" :aria-label="t('assetNeo')" tabindex="0" @click="form.asset = 'NEO'" @keydown.enter="form.asset = 'NEO'">{{ t("assetNeo") }}</text>
          </view>
        </view>

        <view class="form-group">
          <text class="label">{{ t("toAddressLabel") }}</text>
          <input class="input" v-model="form.toAddress" :placeholder="t('toAddressPlaceholder')" />
        </view>

        <view class="form-group">
          <text class="label">{{ t("amountLabel") }}</text>
          <input class="input" v-model="form.amount" type="digit" :placeholder="t('amountPlaceholder')" />
        </view>

        <view class="form-group">
          <text class="label">{{ t("memoLabel") }}</text>
          <input class="input" v-model="form.memo" :placeholder="t('memoPlaceholder')" />
        </view>

        <view class="actions row">
          <NeoButton variant="secondary" @click="step = 2">{{ t("buttonBack") }}</NeoButton>
          <NeoButton variant="primary" @click="prepareTransaction" :disabled="!isValidTx || isPreparing">
            {{ isPreparing ? t("loading") : t("buttonReview") }}
          </NeoButton>
        </view>
      </NeoCard>

      <NeoCard v-if="step === 4" class="step-card">
        <text class="step-title">{{ t("step4Title") }}</text>
        <text class="step-desc">{{ t("step4Desc") }}</text>

        <view class="review-item">
          <text class="label">{{ t("reviewFrom") }}</text>
          <text class="value mono">{{ multisigAccount?.address }}</text>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewTo") }}</text>
          <text class="value mono">{{ form.toAddress }}</text>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewAmount") }}</text>
          <text class="value highlight">{{ form.amount }} {{ form.asset }}</text>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewSigners") }}</text>
          <text class="value">{{ form.threshold }} / {{ form.signers.length }}</text>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewChain") }}</text>
          <text class="value">{{ chainLabel }}</text>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewFees") }}</text>
          <view class="fee-grid">
            <view class="fee-row">
              <text class="fee-label">{{ t("reviewNetworkFee") }}</text>
              <text class="fee-value">{{ formatFixed8(feeSummary.networkFee) }} GAS</text>
            </view>
            <view class="fee-row">
              <text class="fee-label">{{ t("reviewSystemFee") }}</text>
              <text class="fee-value">{{ formatFixed8(feeSummary.systemFee) }} GAS</text>
            </view>
          </view>
        </view>
        <view class="review-item">
          <text class="label">{{ t("reviewValidUntil") }}</text>
          <text class="value">{{ feeSummary.validUntilBlock }}</text>
        </view>
        <view v-if="form.memo" class="review-item">
          <text class="label">{{ t("detailMemo") }}</text>
          <text class="value">{{ form.memo }}</text>
        </view>

        <view class="actions row">
          <NeoButton variant="secondary" @click="step = 3">{{ t("buttonBack") }}</NeoButton>
          <NeoButton variant="primary" @click="handleSubmit" :disabled="isSubmitting">
            {{ isSubmitting ? t("buttonCreating") : t("buttonCreate") }}
          </NeoButton>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useMultisigCreation } from "@/composables/useMultisigCreation";
import CreationForm from "./components/CreationForm.vue";
import ThresholdConfig from "./components/ThresholdConfig.vue";

const { t } = createUseI18n(messages)();

const {
  step,
  form,
  isPreparing,
  isSubmitting,
  multisigAccount,
  feeSummary,
  isValidSigners,
  isValidTx,
  chainLabel,
  addSigner,
  removeSigner,
  setChain,
  finalizeConfig,
  prepareTransaction,
  submit,
  formatFixed8,
} = useMultisigCreation();

const updateSigner = ({ index, value }: { index: number; value: string }) => {
  form.value.signers[index] = value;
};

const goBack = () => uni.navigateBack();

const handleSubmit = async () => {
  await submit((id) => {
    uni.redirectTo({ url: `/pages/sign/index?id=${id}` });
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.page-container {
  --multisig-accent: var(--status-success);
  --multisig-accent-soft: rgba(0, 229, 153, 0.12);
  --multisig-accent-strong: rgba(0, 229, 153, 0.2);
  --multisig-accent-text: #0b0c16;
  --multisig-surface: rgba(255, 255, 255, 0.04);
  --multisig-surface-strong: rgba(255, 255, 255, 0.08);
  --multisig-border: rgba(255, 255, 255, 0.1);
  --multisig-border-subtle: rgba(255, 255, 255, 0.05);
  --multisig-divider: rgba(255, 255, 255, 0.05);
  --multisig-pill-bg: rgba(255, 255, 255, 0.05);
  --multisig-pill-active-bg: rgba(0, 229, 153, 0.12);
  --multisig-pill-active-text: var(--text-primary);
  --multisig-remove: var(--status-error);
  --multisig-highlight: var(--status-success);
  --multisig-input-bg: rgba(255, 255, 255, 0.05);
  --multisig-input-text: var(--text-primary);

  padding: 24px;
  background: var(--bg-body);
  min-height: 100vh;
  color: var(--text-primary);
}

:global(.theme-light) .page-container,
:global([data-theme="light"]) .page-container {
  --multisig-accent-soft: rgba(0, 229, 153, 0.18);
  --multisig-accent-strong: rgba(0, 229, 153, 0.22);
  --multisig-accent-text: #0b0c16;
  --multisig-surface: rgba(15, 23, 42, 0.04);
  --multisig-surface-strong: rgba(15, 23, 42, 0.08);
  --multisig-border: rgba(15, 23, 42, 0.12);
  --multisig-border-subtle: rgba(15, 23, 42, 0.08);
  --multisig-divider: rgba(15, 23, 42, 0.1);
  --multisig-pill-bg: rgba(15, 23, 42, 0.04);
  --multisig-pill-active-bg: rgba(0, 229, 153, 0.18);
  --multisig-pill-active-text: var(--text-primary);
  --multisig-remove: var(--status-error);
  --multisig-highlight: var(--status-success);
  --multisig-input-bg: rgba(15, 23, 42, 0.04);
  --multisig-input-text: var(--text-primary);
}

.nav-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  gap: 12px;
}

.nav-text {
  display: flex;
  flex-direction: column;
}

.back-btn {
  font-size: 24px;
  cursor: pointer;
}

.title {
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.step-card {
  padding: 24px;
  margin-bottom: 24px;
}

.step-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  display: block;
  color: var(--multisig-accent);
}

.step-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  display: block;
}

.summary-block {
  background: var(--multisig-surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.value {
  font-size: 12px;
  text-align: right;
}

.mono {
  font-family: $font-mono;
}

.form-group {
  margin-bottom: 16px;
}

.pill-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pill {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--multisig-border);
  color: var(--text-secondary);
  font-size: 12px;
  transition: all 0.2s ease;

  &.active {
    border-color: var(--multisig-accent);
    color: var(--multisig-pill-active-text);
    background: var(--multisig-pill-active-bg);
  }
}

.asset-toggle {
  display: flex;
  background: var(--multisig-pill-bg);
  border-radius: 8px;
  padding: 4px;

  text {
    flex: 1;
    text-align: center;
    padding: 8px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;

    &.active {
      background: var(--multisig-accent);
      color: var(--multisig-accent-text);
    }
  }
}

.input {
  flex: 1;
  background: var(--multisig-input-bg);
  border: 1px solid var(--multisig-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--multisig-input-text);
  font-size: 12px;
  font-family: $font-mono;
  width: 100%;
}

.actions {
  margin-top: 24px;

  &.row {
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }
}

.review-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--multisig-divider);
}

.highlight {
  color: var(--multisig-highlight);
  font-weight: 700;
  font-size: 16px;
}

.fee-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.fee-label {
  color: var(--text-secondary);
}
</style>
