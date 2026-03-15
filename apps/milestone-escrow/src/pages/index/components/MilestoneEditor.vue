<template>
  <div class="milestone-section">
    <div class="milestone-header">
      <span class="section-title">{{ t("milestones") }}</span>
      <NeoButton size="sm" variant="secondary" :disabled="milestones.length >= 12" @click="emitAdd">
        {{ t("addMilestone") }}
      </NeoButton>
    </div>

    <div v-for="(milestone, index) in milestones" :key="`milestone-${index}`" class="milestone-row">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

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

const { t } = createUseI18n(messages)();

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
