<template>
  <view class="beneficiary-manager">
    <TrustList
      :trusts="beneficiaryTrusts"
      :title="t('beneficiaryTrusts')"
      :empty-text="t('noTrusts')"
      empty-icon="🎁"
      :t="t"
      @heartbeat="$emit('heartbeat', $event)"
      @claimYield="$emit('claimYield', $event)"
      @execute="$emit('execute', $event)"
      @claimReleased="$emit('claimReleased', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import TrustList from "./TrustList.vue";
import type { Trust } from "./TrustCard.vue";

defineProps<{
  beneficiaryTrusts: Trust[];
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  heartbeat: [trust: Trust];
  claimYield: [trust: Trust];
  execute: [trust: Trust];
  claimReleased: [trust: Trust];
}>();
</script>
