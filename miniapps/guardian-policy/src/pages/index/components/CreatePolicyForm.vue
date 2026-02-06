<template>
  <NeoCard class="create-card" variant="erobo-neo">
    <NeoInput
      :modelValue="assetType"
      @update:modelValue="$emit('update:assetType', $event)"
      :placeholder="t('assetType')"
      class="input"
    />
    <view class="policy-row">
      <text class="policy-label">{{ t("policyTypeLabel") }}</text>
      <view class="policy-actions">
        <NeoButton size="sm" :variant="policyType === 1 ? 'primary' : 'secondary'" @click="$emit('update:policyType', 1)">
          {{ t("policyTypeBasic") }}
        </NeoButton>
        <NeoButton size="sm" :variant="policyType === 2 ? 'primary' : 'secondary'" @click="$emit('update:policyType', 2)">
          {{ t("policyTypeBalanced") }}
        </NeoButton>
        <NeoButton size="sm" :variant="policyType === 3 ? 'primary' : 'secondary'" @click="$emit('update:policyType', 3)">
          {{ t("policyTypeGuardian") }}
        </NeoButton>
      </view>
    </view>
    <NeoInput
      :modelValue="coverage"
      @update:modelValue="$emit('update:coverage', $event)"
      :placeholder="t('coverageAmount')"
      type="number"
      suffix="GAS"
      class="input"
    />
    <NeoInput
      :modelValue="threshold"
      @update:modelValue="$emit('update:threshold', $event)"
      :placeholder="t('thresholdPercent')"
      type="number"
      suffix="%"
      class="input"
    />

    <view class="price-row">
      <NeoInput
        :modelValue="startPrice"
        @update:modelValue="$emit('update:startPrice', $event)"
        :placeholder="t('startPrice')"
        type="number"
        suffix="USD"
        class="input"
      />
      <NeoButton size="sm" variant="secondary" class="price-btn" :loading="isFetchingPrice" @click="$emit('fetchPrice')">
        {{ t("fetchPrice") }}
      </NeoButton>
    </view>

    <text class="premium-note">{{ t("premiumNote").replace("{premium}", premium || "0") }}</text>

    <NeoButton variant="primary" size="lg" block @click="$emit('create')">
      {{ t("createPolicy") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  assetType: string;
  policyType: number;
  coverage: string;
  threshold: string;
  startPrice: string;
  premium: string;
  isFetchingPrice: boolean;
  t: (key: string) => string;
}>();

defineEmits([
  "update:assetType",
  "update:policyType",
  "update:coverage",
  "update:threshold",
  "update:startPrice",
  "fetchPrice",
  "create",
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.create-card { margin-top: $spacing-6; }
.policy-row {
  margin-bottom: $spacing-4;
}
.policy-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: $spacing-2;
}
.policy-actions {
  display: flex;
  gap: $spacing-2;
  flex-wrap: wrap;
}
.price-row {
  display: flex;
  align-items: flex-end;
  gap: $spacing-3;
  margin-bottom: $spacing-3;
}

.price-btn {
  height: 36px;
}

.premium-note {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: $spacing-4;
  display: block;
}
</style>
