<template>
  <view class="contracts-list">
    <ContractCard
      v-for="contract in contracts"
      :key="contract.id"
      :contract="contract"
      :address="address"
      :t="t"
      @sign="$emit('sign', $event)"
      @break="$emit('break', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import ContractCard from "./ContractCard.vue";
import type { RelationshipContractView } from "@/types";

defineProps<{
  contracts: RelationshipContractView[];
  address: string | null;
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits(["sign", "break"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.contracts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-primary);
  padding-bottom: 4px;
  letter-spacing: 0.1em;
  margin-left: 4px;
}
</style>
