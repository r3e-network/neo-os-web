<template>
  <view class="beneficiary-manager">
    <TrustList
      :trusts="beneficiaryTrusts"
      :title="t('beneficiaryTrusts')"
      :empty-text="t('noTrusts')"
      empty-icon="🎁"
      @heartbeat="$emit('heartbeat', $event)"
      @claimYield="$emit('claimYield', $event)"
      @execute="$emit('execute', $event)"
      @claimReleased="$emit('claimReleased', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import TrustList from "./TrustList.vue";
import type { Trust } from "./TrustCard.vue";

defineProps<{
  beneficiaryTrusts: Trust[];
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  heartbeat: [trust: Trust];
  claimYield: [trust: Trust];
  execute: [trust: Trust];
  claimReleased: [trust: Trust];
}>();
</script>
