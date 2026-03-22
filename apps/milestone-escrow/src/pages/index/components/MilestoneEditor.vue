<template>
  <div class="milestone-section">
    <div class="milestone-header">
      <span class="section-title">{{ t("milestones") }}</span>
      <NeoButton size="sm" variant="secondary" type="button" :disabled="milestones.length >= 12" :aria-label="t('addMilestone')" @click="emitAdd">
        {{ t("addMilestone") }}
      </NeoButton>
    </div>

    <div v-for="milestone in milestones" :key="milestone.id" class="milestone-row">
      <NeoInput
        v-model="milestone.amount"
        type="number"
        :label="`${t('milestoneAmount')} ${t('idPrefix')}${milestone.id}`"
        :suffix="asset"
        :placeholder="t('milestoneAmountPlaceholder')"
      />
      <NeoButton
        size="sm"
        variant="secondary"
        type="button"
        class="milestone-remove"
        :disabled="milestones.length <= 1"
        :aria-label="t('remove')"
        @click="emitRemove(milestone.id)"
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
  id: string;
  amount: string;
}

const props = defineProps<{
  milestones: Milestone[];
  asset: string;
}>();

const emit = defineEmits<{
  (e: "add"): void;
  (e: "remove", id: string): void;
}>();

const { t } = createUseI18n(messages)();

const emitAdd = () => emit("add");
const emitRemove = (id: string) => emit("remove", id);
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
