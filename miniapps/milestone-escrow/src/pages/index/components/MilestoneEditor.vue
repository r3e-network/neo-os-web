<template>
  <view class="milestone-section">
    <view class="milestone-header">
      <text class="section-title">{{ t("milestones") }}</text>
      <NeoButton size="sm" variant="secondary" :disabled="milestones.length >= 12" @click="emitAdd">
        {{ t("addMilestone") }}
      </NeoButton>
    </view>

    <view v-for="(milestone, index) in milestones" :key="`milestone-${index}`" class="milestone-row">
      <NeoInput
        v-model="milestone.amount"
        type="number"
        :label="`${t('milestoneAmount')} #${index + 1}`"
        :suffix="asset"
        placeholder="1.5"
      />
      <NeoButton
        size="sm"
        variant="secondary"
        class="milestone-remove"
        :disabled="milestones.length <= 1"
        @click="emitRemove(index)"
      >
        {{ t("remove") }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

interface Milestone {
  amount: string;
}

const props = defineProps<{
  milestones: Milestone[];
  asset: string;
}>();

const emit = defineEmits<{
  (e: "add"): void;
  (e: "remove", index: number): void;
}>();

const { t } = useI18n();

const emitAdd = () => emit("add");
const emitRemove = (index: number) => emit("remove", index);
</script>

<style lang="scss" scoped>
.milestone-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.milestone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.milestone-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.milestone-remove {
  align-self: flex-end;
}
</style>
