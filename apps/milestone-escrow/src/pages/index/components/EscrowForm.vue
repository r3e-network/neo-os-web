<template>
  <FormCard
    :submit-label="isLoading ? t('creating') : t('createEscrow')"
    :submit-loading="isLoading"
    :submit-disabled="isLoading"
    @submit="createEscrow"
  >
    <NeoInput v-model="localForm.name" :label="t('escrowName')" :placeholder="t('escrowNamePlaceholder')" />
    <NeoInput v-model="localForm.beneficiary" :label="t('beneficiary')" :placeholder="t('beneficiaryPlaceholder')" />

    <div class="input-group">
      <span class="input-label">{{ t("assetType") }}</span>
      <div class="asset-toggle">
        <NeoButton size="sm" variant="primary" type="button" disabled :aria-label="t('assetGas')">
          {{ t("assetGas") }}
        </NeoButton>
      </div>
    </div>

    <MilestoneEditor
      :milestones="localMilestones"
      :asset="localForm.asset"
      @add="addMilestone"
      @remove="removeMilestone"
    />

    <TotalDisplay :total="totalDisplay" />

    <NeoInput v-model="localForm.notes" type="textarea" :label="t('notes')" :placeholder="t('notesPlaceholder')" />
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import { NeoButton, NeoInput, FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import MilestoneEditor from "./MilestoneEditor.vue";
import TotalDisplay from "./TotalDisplay.vue";

const emit = defineEmits<{
  (
    e: "create",
    data: { name: string; beneficiary: string; asset: string; notes: string; milestones: Array<{ amount: string }> }
  ): void;
}>();

const { t } = createUseI18n(messages)();
const isLoading = ref(false);

const localForm = reactive({
  name: "",
  beneficiary: "",
  asset: "GAS",
  notes: "",
});

const localMilestones = ref<Array<{ id: string; amount: string }>>([
  { id: "1", amount: "1" },
  { id: "2", amount: "1" },
  { id: "3", amount: "1" },
]);

const totalDisplay = computed(() => {
  let total = 0;
  for (const milestone of localMilestones.value) {
    const raw = String(milestone.amount || "").trim();
    if (!raw) continue;
    total += Number.parseFloat(raw) || 0;
  }
  return total.toFixed(4);
});

const addMilestone = () => {
  if (localMilestones.value.length >= 12) return;
  const newId = String(Date.now());
  localMilestones.value.push({ id: newId, amount: localForm.asset === "NEO" ? "1" : "1" });
};

const removeMilestone = (id: string) => {
  if (localMilestones.value.length <= 1) return;
  const idx = localMilestones.value.findIndex((m) => m.id === id);
  if (idx !== -1) localMilestones.value.splice(idx, 1);
};

const createEscrow = () => {
  emit("create", {
    name: localForm.name,
    beneficiary: localForm.beneficiary,
    asset: localForm.asset,
    notes: localForm.notes,
    milestones: localMilestones.value.map(({ amount }) => ({ amount })),
  });
};

defineExpose({
  setLoading: (loading: boolean) => {
    isLoading.value = loading;
  },
  reset: () => {
    localForm.name = "";
    localForm.beneficiary = "";
    localForm.notes = "";
    localMilestones.value = [
      { id: "1", amount: "1" },
      { id: "2", amount: "1" },
      { id: "3", amount: "1" },
    ];
  },
});
</script>

<style lang="scss" scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--escrow-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.asset-toggle {
  display: flex;
  gap: 10px;
}
</style>
