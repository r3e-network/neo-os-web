<template>
  <view class="envelope-list">
    <EnvelopeList
      :envelopes="envelopes"
      :loading-envelopes="loadingEnvelopes"
      :opening-id="openingId"
      :t="t"
      @claim="$emit('claim', $event)"
      @share="$emit('share', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import EnvelopeList from "./EnvelopeList.vue";

type EnvelopeItem = {
  id: string;
  creator: string;
  from: string;
  name?: string;
  description?: string;
  total: number;
  remaining: number;
  totalAmount: number;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
  ready: boolean;
  expired: boolean;
  canClaim: boolean;
};

defineProps<{
  envelopes: EnvelopeItem[];
  loadingEnvelopes: boolean;
  openingId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  claim: [env: EnvelopeItem];
  share: [env: EnvelopeItem];
}>();
</script>
