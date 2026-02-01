<template>
  <view class="main-card">
    <CreateCard :title="createTitle" :description="createDesc" @create="$emit('create')" />

    <view class="divider">
      <view class="divider-line"></view>
      <text class="divider-text">{{ dividerText }}</text>
      <view class="divider-line"></view>
    </view>

    <LoadSection
      v-model="inputValue"
      :label="loadLabel"
      :placeholder="loadPlaceholder"
      :button-text="loadButtonText"
      @load="$emit('load')"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CreateCard from "./CreateCard.vue";
import LoadSection from "./LoadSection.vue";

const props = defineProps<{
  modelValue: string;
  createTitle: string;
  createDesc: string;
  dividerText: string;
  loadLabel: string;
  loadPlaceholder: string;
  loadButtonText: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  create: [];
  load: [];
}>();

const inputValue = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
</script>

<style lang="scss" scoped>
.main-card {
  position: relative;
  z-index: 10;
  background: var(--multi-card-bg);
  border: 1px solid var(--multi-card-border);
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 24px;
  backdrop-filter: blur(20px);
}

.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--multi-divider);
}

.divider-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--multi-text-soft);
  letter-spacing: 0.1em;
}

@media (max-width: 767px) {
  .main-card {
    padding: 16px;
    border-radius: 16px;
  }
}

@media (min-width: 1024px) {
  .main-card {
    padding: 32px;
  }
}
</style>
