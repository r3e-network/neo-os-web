<template>
  <NeoCard variant="erobo-neo">
    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">📋</span>
        <span class="label-text">{{ t("trustDetails") }}</span>
      </div>
      <NeoInput :modelValue="name" @update:modelValue="$emit('update:name', $event)" :placeholder="t('trustName')" />
    </div>

    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">👤</span>
        <span class="label-text">{{ t("beneficiaryInfo") }}</span>
      </div>
      <NeoInput
        :modelValue="beneficiary"
        @update:modelValue="$emit('update:beneficiary', $event)"
        :placeholder="t('beneficiaryAddress')"
      />
    </div>

    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">💰</span>
        <span class="label-text">{{ t("assetAmount") }}</span>
      </div>
      <div class="dual-inputs">
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
      </div>
      <span class="asset-hint">{{ t("assetHint") }}</span>
    </div>

    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">📅</span>
        <span class="label-text">{{ t("releaseSchedule") }}</span>
      </div>
      <div class="mode-tabs">
        <div
          class="mode-card"
          :class="{ active: releaseMode === 'fixed' }"
          @click="$emit('update:releaseMode', 'fixed')"
        >
          <span class="mode-title">{{ t("releaseModeFixed") }}</span>
          <span class="mode-desc">{{ t("releaseModeFixedDesc") }}</span>
        </div>
        <div
          class="mode-card"
          :class="{ active: releaseMode === 'neoRewards' }"
          @click="$emit('update:releaseMode', 'neoRewards')"
        >
          <span class="mode-title">{{ t("releaseModeNeoRewards") }}</span>
          <span class="mode-desc">{{ t("releaseModeNeoRewardsDesc") }}</span>
        </div>
        <div
          class="mode-card"
          :class="{ active: releaseMode === 'rewardsOnly' }"
          @click="$emit('update:releaseMode', 'rewardsOnly')"
        >
          <span class="mode-title">{{ t("releaseModeRewardsOnly") }}</span>
          <span class="mode-desc">{{ t("releaseModeRewardsOnlyDesc") }}</span>
        </div>
      </div>
      <div class="dual-inputs">
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
      </div>
      <span class="asset-hint">{{ t("releaseScheduleHint") }}</span>
    </div>

    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">⏱️</span>
        <span class="label-text">{{ t("heartbeatInterval") }}</span>
      </div>
      <NeoInput
        :modelValue="intervalDays"
        @update:modelValue="$emit('update:intervalDays', $event)"
        type="number"
        placeholder="30"
        suffix="days"
      />
      <span class="asset-hint">{{ t("heartbeatHint") }}</span>
    </div>

    <div class="form-section">
      <div class="form-label">
        <span class="label-icon">📝</span>
        <span class="label-text">{{ t("notes") }}</span>
      </div>
      <NeoInput
        :modelValue="notes"
        @update:modelValue="$emit('update:notes', $event)"
        :placeholder="t('notesPlaceholder')"
        type="textarea"
      />
    </div>

    <div class="info-banner">
      <span class="info-icon">ℹ️</span>
      <div class="info-content">
        <span class="info-title">{{ t("importantNotice") }}</span>
        <span class="info-text">{{ t("infoText") }}</span>
      </div>
    </div>

    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('create')">
      {{ t("createTrust") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

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
}>();

const { t } = createUseI18n(messages)();

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
  "create",
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

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
  @include stat-label;
  letter-spacing: 0.12em;
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
  color: var(--heritage-gold);
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
      background: var(--heritage-success);
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
