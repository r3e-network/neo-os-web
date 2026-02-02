<template>
  <NeoCard variant="erobo-neo" class="contract-card">
    <view class="document-body">
      <view class="clause-box-glass">
        <view class="clause-deco top-left"></view>
        <view class="clause-deco bottom-right"></view>
        <text class="document-clause">{{ t("clause1") }}</text>
      </view>

      <view class="form-grid">
        <view class="form-group full-width">
          <text class="form-label">{{ t("partnerLabel") }}</text>
          <NeoInput
            :modelValue="partnerAddress"
            @update:modelValue="$emit('update:partnerAddress', $event)"
            :placeholder="t('partnerPlaceholder')"
            class="partner-input"
          />
        </view>

        <view class="form-group full-width">
          <text class="form-label">{{ t("titleLabel") }}</text>
          <NeoInput
            :modelValue="title"
            @update:modelValue="$emit('update:title', $event)"
            :placeholder="t('titlePlaceholder')"
          />
        </view>

        <view class="form-group">
          <text class="form-label">{{ t("stakeLabel") }}</text>
          <NeoInput
            :modelValue="stakeAmount"
            @update:modelValue="$emit('update:stakeAmount', $event)"
            type="number"
            :placeholder="t('stakePlaceholder')"
            suffix="GAS"
          />
        </view>

        <view class="form-group">
          <text class="form-label">{{ t("durationLabel") }}</text>
          <NeoInput
            :modelValue="duration"
            @update:modelValue="$emit('update:duration', $event)"
            type="number"
            :placeholder="t('durationPlaceholder')"
            :suffix="t('daysSuffix')"
          />
        </view>

        <view class="form-group full-width">
          <text class="form-label">{{ t("termsLabel") }}</text>
          <NeoInput
            :modelValue="terms"
            @update:modelValue="$emit('update:terms', $event)"
            type="textarea"
            :placeholder="t('termsPlaceholder')"
          />
        </view>
      </view>

      <view class="signature-section">
        <text class="signature-label">{{ t("signatureLabel") }}</text>
        <view class="signature-pad-glass">
          <view class="sign-line"></view>
          <text class="signature-text mono" :class="{ 'signed': !!address }">
            {{ address ? `✍️ ${address}` : t("connectWallet") }}
          </text>
          <view class="biometric-scan" v-if="address"></view>
        </view>
      </view>

      <NeoButton 
        variant="primary" 
        size="lg" 
        block 
        :loading="isLoading" 
        @click="$emit('create')"
        class="create-btn"
      >
        <text class="btn-text">{{ isLoading ? t("creating") : t("createBtn") }}</text>
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoInput, NeoButton, NeoCard } from "@shared/components";

defineProps<{
  partnerAddress: string;
  stakeAmount: string;
  duration: string;
  title: string;
  terms: string;
  address: string | null;
  isLoading: boolean;
  t: (key: string) => string;
}>();

defineEmits(["update:partnerAddress", "update:stakeAmount", "update:duration", "update:title", "update:terms", "create"]);

</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.contract-card {
  position: relative;
  overflow: hidden;
}

.hologram-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 105, 180, 0.3);
  margin-bottom: 24px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 40%;
    height: 1px;
    background: #ff6b6b;
    box-shadow: 0 0 10px #ff6b6b;
  }
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.document-title {
  font-weight: 800;
  font-size: 16px;
  text-transform: uppercase;
  color: #ff6b6b;
  letter-spacing: 0.1em;
  text-shadow: 0 0 10px rgba(255, 107, 107, 0.4);
}

.id-badge {
  font-size: 9px;
  font-family: $font-mono;
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.glowing-seal {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seal-icon {
  font-size: 20px;
  z-index: 2;
  filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.6));
}

.seal-ring {
  position: absolute;
  inset: 0;
  border: 2px dashed rgba(255, 105, 180, 0.4);
  border-radius: 50%;
  animation: spin-slow 10s linear infinite;
}

.clause-box-glass {
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 24px;
  position: relative;
}

.clause-deco {
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: var(--text-muted);
  border-style: solid;
  
  &.top-left {
    top: -1px; left: -1px;
    border-width: 1px 0 0 1px;
  }
  &.bottom-right {
    bottom: -1px; right: -1px;
    border-width: 0 1px 1px 0;
  }
}

.document-clause {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--text-primary);
  font-family: serif; /* Elegant contract font */
  font-style: italic;
  text-align: center;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.full-width { grid-column: span 2; }

.form-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  display: block;
}

.signature-section {
  margin-bottom: 24px;
}

.signature-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  display: block;
}

.signature-pad-glass {
  background: rgba(0, 0, 0, 0.3);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sign-line {
  position: absolute;
  bottom: 12px;
  left: 20px;
  right: 20px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.signature-text {
  font-family: 'Dancing Script', cursive, serif; /* Fallback to serif/cursive */
  font-size: 16px;
  color: var(--text-muted);
  z-index: 2;
  transition: all 0.3s;
  
  &.signed {
    color: #ff6b6b;
    font-size: 14px;
    font-family: $font-mono;
    text-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
    letter-spacing: -0.5px;
  }
}

.biometric-scan {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 107, 107, 0.1), transparent);
  transform: translateX(-100%);
  animation: scan 2s infinite linear;
}

.create-btn {
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.2);
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes scan {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
</style>
