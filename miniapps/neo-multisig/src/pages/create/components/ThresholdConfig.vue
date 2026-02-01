<template>
  <NeoCard class="threshold-config">
    <text class="form-section-title">{{ title }}</text>
    <text class="form-section-desc">{{ description }}</text>

    <view class="threshold-control">
      <text class="threshold-val">{{ threshold }}</text>
      <text class="threshold-total">/ {{ totalSigners }}</text>
    </view>

    <slider :value="threshold" :min="1" :max="totalSigners" activeColor="var(--multisig-accent)" @change="onChange" />

    <view class="actions row">
      <NeoButton variant="secondary" @click="$emit('back')">{{ backLabel }}</NeoButton>
      <NeoButton variant="primary" @click="$emit('next')">{{ nextLabel }}</NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";

const props = defineProps<{
  title: string;
  description: string;
  threshold: number;
  totalSigners: number;
  backLabel: string;
  nextLabel: string;
}>();

const emit = defineEmits(["back", "next", "update:threshold"]);

const onChange = (e: any) => {
  emit("update:threshold", e.detail.value);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.threshold-config {
  padding: 24px;
  margin-bottom: 24px;
}

.form-section-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  display: block;
  color: var(--multisig-accent);
}

.form-section-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  display: block;
}

.threshold-control {
  text-align: center;
  margin-bottom: 24px;
}

.threshold-val {
  font-size: 48px;
  font-weight: 800;
  color: var(--multisig-accent);
}

.threshold-total {
  color: var(--text-secondary);
}

.actions {
  margin-top: 24px;

  &.row {
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }
}
</style>
