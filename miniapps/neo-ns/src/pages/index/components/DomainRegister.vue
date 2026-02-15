<template>
  <view class="tab-content">
    <DomainSearch
      v-model:search-query="searchQuery"
      :search-result="searchResult"
      :loading="loading"
      @search="onCheckAvailability"
      @register="onRegister"
    />
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useDomainRegister } from "@/composables/useDomainRegister";
import DomainSearch from "./DomainSearch.vue";

const props = defineProps<{
  nnsContract: string;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "status", msg: string, type: "success" | "error"): void;
  (e: "refresh"): void;
}>();

const notifyStatus = (message: string, type?: "success" | "error") => emit("status", message, type ?? "error");

const { searchQuery, searchResult, loading, checkAvailability, handleRegister } = useDomainRegister(
  props.nnsContract,
  t
);

function onCheckAvailability() {
  checkAvailability(notifyStatus);
}

async function onRegister() {
  await handleRegister(notifyStatus, () => emit("refresh"));
}
</script>

<style lang="scss" scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}
</style>
