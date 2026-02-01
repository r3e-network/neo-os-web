<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <NeoInput v-model="localForm.name" :label="t('escrowName')" :placeholder="t('escrowNamePlaceholder')" />
      <NeoInput v-model="localForm.beneficiary" :label="t('beneficiary')" :placeholder="t('beneficiaryPlaceholder')" />

      <view class="input-group">
        <text class="input-label">{{ t("assetType") }}</text>
        <view class="asset-toggle">
          <NeoButton size="sm" variant="primary" disabled>
            {{ t("assetGas") }}
          </NeoButton>
        </view>
      </view>

      <MilestoneEditor :milestones="localMilestones" :asset="localForm.asset" @add="addMilestone" @remove="removeMilestone" />

      <TotalDisplay :total="totalDisplay" :asset="localForm.asset" />

      <NeoInput v-model="localForm.notes" type="textarea" :label="t('notes')" :placeholder="t('notesPlaceholder')" />

      <NeoButton variant="primary" size="lg" block :loading="isLoading" :disabled="isLoading" @click="createEscrow">
        {{ isLoading ? t("creating") : t("createEscrow") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import MilestoneEditor from "./MilestoneEditor.vue";
import TotalDisplay from "./TotalDisplay.vue";

const emit = defineEmits<{
  (e: "create", data: { name: string; beneficiary: string; asset: string; notes: string; milestones: Array<{ amount: string }> }): void;
}>();

const { t } = useI18n();
const isLoading = ref(false);

const localForm = reactive({
  name: "",
  beneficiary: "",
  asset: "GAS",
  notes: "",
});

const localMilestones = ref<Array<{ amount: string }>>([{ amount: "1" }, { amount: "1" }, { amount: "1" }]);

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
  localMilestones.value.push({ amount: localForm.asset === "NEO" ? "1" : "1" });
};

const removeMilestone = (index: number) => {
  if (localMilestones.value.length <= 1) return;
  localMilestones.value.splice(index, 1);
};

const createEscrow = () => {
  emit("create", {
    name: localForm.name,
    beneficiary: localForm.beneficiary,
    asset: localForm.asset,
    notes: localForm.notes,
    milestones: localMilestones.value,
  });
};

defineExpose({
  setLoading: (loading: boolean) => { isLoading.value = loading; },
  reset: () => {
    localForm.name = "";
    localForm.beneficiary = "";
    localForm.notes = "";
    localMilestones.value = [{ amount: "1" }, { amount: "1" }, { amount: "1" }];
  },
});
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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
