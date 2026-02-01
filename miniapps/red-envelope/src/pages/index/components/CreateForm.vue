<template>
  <view class="create-form">
    <CreateEnvelopeForm
      v-model:name="name"
      v-model:description="description"
      v-model:amount="amount"
      v-model:count="count"
      v-model:expiryHours="expiryHours"
      :is-loading="isLoading"
      :t="t"
      @create="$emit('create')"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import CreateEnvelopeForm from "./CreateEnvelopeForm.vue";

const props = defineProps<{
  isLoading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  create: [];
  'update:name': [value: string];
  'update:description': [value: string];
  'update:amount': [value: string];
  'update:count': [value: string];
  'update:expiryHours': [value: string];
}>();

const name = ref("");
const description = ref("");
const amount = ref("");
const count = ref("");
const expiryHours = ref("24");

watch(name, (val) => emit('update:name', val));
watch(description, (val) => emit('update:description', val));
watch(amount, (val) => emit('update:amount', val));
watch(count, (val) => emit('update:count', val));
watch(expiryHours, (val) => emit('update:expiryHours', val));
</script>
