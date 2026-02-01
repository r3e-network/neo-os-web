<template>
  <view class="contracts-list">

    <ContractCard
      v-for="contract in contracts"
      :key="contract.id"
      :contract="contract"
      :address="address"
      :t="t as any"
      @sign="$emit('sign', $event)"
      @break="$emit('break', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import ContractCard from "./ContractCard.vue";

interface RelationshipContractView {
  id: number;
  party1: string;
  party2: string;
  partner: string;
  title: string;
  terms: string;
  stake: number;
  stakeRaw: string;
  progress: number;
  daysLeft: number;
  status: "pending" | "active" | "broken" | "ended";
}

defineProps<{
  contracts: RelationshipContractView[];
  address: string | null;
  t: (key: string) => string;
}>();

defineEmits(["sign", "break"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.contracts-list { display: flex; flex-direction: column; gap: $space-4; }
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-primary);
  padding-bottom: $space-1;
  letter-spacing: 0.1em;
  margin-left: 4px;
}
</style>
