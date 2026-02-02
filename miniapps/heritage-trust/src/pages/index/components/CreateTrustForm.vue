<template>
  <NeoCard variant="erobo-neo">
    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">📋</text>
        <text class="label-text">{{ t("trustDetails") }}</text>
      </view>
      <NeoInput :modelValue="name" @update:modelValue="$emit('update:name', $event)" :placeholder="t('trustName')" />
    </view>

    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">👤</text>
        <text class="label-text">{{ t("beneficiaryInfo") }}</text>
      </view>
      <NeoInput
        :modelValue="beneficiary"
        @update:modelValue="$emit('update:beneficiary', $event)"
        :placeholder="t('beneficiaryAddress')"
      />
    </view>

    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">💰</text>
        <text class="label-text">{{ t("assetAmount") }}</text>
      </view>
      <view class="dual-inputs">
        <NeoInput
          :modelValue="neoValue"
          @update:modelValue="$emit('update:neoValue', $event)"
          type="number"
          placeholder="0"
          suffix="NEO"
        />
        <NeoInput
          :modelValue="gasValue"
          @update:modelValue="$emit('update:gasValue', $event)"
          type="number"
          placeholder="0"
          suffix="GAS"
          :disabled="releaseMode !== 'fixed'"
        />
      </view>
      <text class="asset-hint">{{ t("assetHint") }}</text>
    </view>

    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">📅</text>
        <text class="label-text">{{ t("releaseSchedule") }}</text>
      </view>
      <view class="mode-tabs">
        <view
          class="mode-card"
          :class="{ active: releaseMode === 'fixed' }"
          @click="$emit('update:releaseMode', 'fixed')"
        >
          <text class="mode-title">{{ t("releaseModeFixed") }}</text>
          <text class="mode-desc">{{ t("releaseModeFixedDesc") }}</text>
        </view>
        <view
          class="mode-card"
          :class="{ active: releaseMode === 'neoRewards' }"
          @click="$emit('update:releaseMode', 'neoRewards')"
        >
          <text class="mode-title">{{ t("releaseModeNeoRewards") }}</text>
          <text class="mode-desc">{{ t("releaseModeNeoRewardsDesc") }}</text>
        </view>
        <view
          class="mode-card"
          :class="{ active: releaseMode === 'rewardsOnly' }"
          @click="$emit('update:releaseMode', 'rewardsOnly')"
        >
          <text class="mode-title">{{ t("releaseModeRewardsOnly") }}</text>
          <text class="mode-desc">{{ t("releaseModeRewardsOnlyDesc") }}</text>
        </view>
      </view>
      <view class="dual-inputs">
        <NeoInput
          :modelValue="monthlyNeo"
          @update:modelValue="$emit('update:monthlyNeo', $event)"
          type="number"
          placeholder="0"
          suffix="/mo NEO"
          :disabled="releaseMode === 'rewardsOnly' || !hasNeo"
        />
        <NeoInput
          :modelValue="monthlyGas"
          @update:modelValue="$emit('update:monthlyGas', $event)"
          type="number"
          placeholder="0"
          suffix="/mo GAS"
          :disabled="releaseMode !== 'fixed' || !hasGas"
        />
      </view>
      <text class="asset-hint">{{ t("releaseScheduleHint") }}</text>
    </view>

    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">⏱️</text>
        <text class="label-text">{{ t("heartbeatInterval") }}</text>
      </view>
      <NeoInput
        :modelValue="intervalDays"
        @update:modelValue="$emit('update:intervalDays', $event)"
        type="number"
        placeholder="30"
        suffix="days"
      />
      <text class="asset-hint">{{ t("heartbeatHint") }}</text>
    </view>

    <view class="form-section">
      <view class="form-label">
        <text class="label-icon">📝</text>
        <text class="label-text">{{ t("notes") }}</text>
      </view>
      <NeoInput
        :modelValue="notes"
        @update:modelValue="$emit('update:notes', $event)"
        :placeholder="t('notesPlaceholder')"
        type="textarea"
      />
    </view>

    <view class="info-banner">
      <text class="info-icon">ℹ️</text>
      <view class="info-content">
        <text class="info-title">{{ t("importantNotice") }}</text>
        <text class="info-text">{{ t("infoText") }}</text>
      </view>
    </view>

    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('create')">
      {{ t("createTrust") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

const props = defineProps<{
  name: string;
  beneficiary: string;
  neoValue: string;
  gasValue: string;
  monthlyNeo: string;
  monthlyGas: string;
  releaseMode: "fixed" | "neoRewards" | "rewardsOnly";
  intervalDays: string;
  notes: string;
  isLoading: boolean;
  t: (key: string) => string;
}>();

const hasNeo = computed(() => {
  const value = Number.parseFloat(props.neoValue);
  return Number.isFinite(value) && value > 0;
});

const hasGas = computed(() => {
  const value = Number.parseFloat(props.gasValue);
  return Number.isFinite(value) && value > 0;
});

defineEmits([
  "update:name", 
  "update:beneficiary", 
  "update:neoValue", 
  "update:gasValue",
  "update:monthlyNeo",
  "update:monthlyGas",
  "update:releaseMode",
  "update:intervalDays", 
  "update:notes", 
  "create"
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.form-section {
  margin-bottom: 20px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-left: 4px;
}

.label-icon {
  font-size: 14px;
}

.label-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.info-banner {
  background: rgba(255, 222, 89, 0.05);
  border: 1px solid rgba(255, 222, 89, 0.2);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  backdrop-filter: blur(10px);
}

.info-icon {
  font-size: 16px;
}

.info-title {
  font-weight: 800;
  font-size: 10px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 4px;
  color: #ffde59;
  letter-spacing: 0.1em;
}

.info-text {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-primary);
  opacity: 0.8;
}

.dual-inputs {
  display: flex;
  gap: 12px;
  
  :deep(.neo-input) {
    flex: 1;
  }
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.mode-card {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s ease;
  cursor: pointer;

  &.active {
    border-color: rgba(0, 229, 153, 0.5);
    box-shadow: 0 0 0 1px rgba(0, 229, 153, 0.2);
  }
}

.mode-title {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.mode-desc {
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.toggle-status {
  width: 44px;
  height: 24px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.active {
    background: rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);

    .toggle-knob {
      left: 22px;
      background: #00e599;
      box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
    }
  }
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-info {
  flex: 1;
}

.toggle-label {
  font-size: 11px;
  font-weight: 800;
  display: block;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.toggle-desc {
  font-size: 9px;
  color: var(--text-secondary);
  opacity: 0.6;
}
</style>
