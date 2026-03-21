<template>
  <NeoCard class="threshold-config">
    <span class="form-section-title">{{ title }}</span>
    <span class="form-section-desc">{{ description }}</span>

    <div class="threshold-control">
      <span class="threshold-val">{{ threshold }}</span>
      <span class="threshold-total">/ {{ totalSigners }}</span>
    </div>

    <slider :value="threshold" :min="1" :max="totalSigners" activeColor="var(--multisig-accent)" :aria-label="title" aria-valuemin="1" :aria-valuemax="totalSigners" :aria-valuenow="threshold" @change="onChange" />

    <div class="actions row">
      <NeoButton variant="secondary" type="button" @click="$emit('back')" :aria-label="backLabel">{{ backLabel }}</NeoButton>
      <NeoButton variant="primary" type="button" @click="$emit('next')" :aria-label="nextLabel">{{ nextLabel }}</NeoButton>
    </div>
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

const emit = defineEmits<{
  (e: "back"): void;
  (e: "next"): void;
  (e: "update:threshold", value: number): void;
}>();

const onChange = (e: { detail: { value: number } }) => {
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
