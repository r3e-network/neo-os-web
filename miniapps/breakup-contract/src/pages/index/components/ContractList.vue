<template>
  <view class="contracts-list">
    <ItemList :items="contracts" item-key="id">
      <template #item="{ item: contract }">
        <ContractCard
          :contract="contract"
          :address="address"
          @sign="$emit('sign', $event)"
          @break="$emit('break', $event)"
        />
      </template>
    </ItemList>
  </view>
</template>

<script setup lang="ts">
import { ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import ContractCard from "./ContractCard.vue";
import type { RelationshipContractView } from "@/types";

defineProps<{
  contracts: RelationshipContractView[];
  address: string | null;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["sign", "break"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.contracts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  @include section-title;
  color: var(--text-primary);
  padding-bottom: 4px;
  letter-spacing: 0.1em;
  margin-left: 4px;
}
</style>
