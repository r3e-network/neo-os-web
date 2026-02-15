<template>
  <view class="create-form">
    <CreateEnvelopeForm
      v-model:envelopeType="envelopeType"
      v-model:name="name"
      v-model:description="description"
      v-model:amount="amount"
      v-model:count="count"
      v-model:expiryHours="expiryHours"
      v-model:minNeoRequired="minNeoRequired"
      v-model:minHoldDays="minHoldDays"
      :is-loading="isLoading"
      @create="$emit('create')"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import CreateEnvelopeForm from "./CreateEnvelopeForm.vue";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  isLoading: boolean;
}>();

const emit = defineEmits<{
  create: [];
  "update:envelopeType": [value: EnvelopeType];
  "update:name": [value: string];
  "update:description": [value: string];
  "update:amount": [value: string];
  "update:count": [value: string];
  "update:expiryHours": [value: string];
  "update:minNeoRequired": [value: string];
  "update:minHoldDays": [value: string];
}>();

const envelopeType = ref<EnvelopeType>("spreading");
const name = ref("");
const description = ref("");
const amount = ref("");
const count = ref("");
const expiryHours = ref("24");
const minNeoRequired = ref("100");
const minHoldDays = ref("2");

watch(envelopeType, (val) => emit("update:envelopeType", val));
watch(name, (val) => emit("update:name", val));
watch(description, (val) => emit("update:description", val));
watch(amount, (val) => emit("update:amount", val));
watch(count, (val) => emit("update:count", val));
watch(expiryHours, (val) => emit("update:expiryHours", val));
watch(minNeoRequired, (val) => emit("update:minNeoRequired", val));
watch(minHoldDays, (val) => emit("update:minHoldDays", val));
</script>
