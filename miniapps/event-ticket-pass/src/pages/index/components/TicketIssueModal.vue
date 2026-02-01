<template>
  <NeoModal :visible="visible" :title="t('issueTicketTitle')" :closeable="true" @close="$emit('close')">
    <view class="form-group">
      <NeoInput
        v-model="localRecipient"
        :label="t('issueRecipient')"
        :placeholder="t('issueRecipientPlaceholder')"
      />
      <NeoInput v-model="localSeat" :label="t('issueSeat')" :placeholder="t('issueSeatPlaceholder')" />
      <NeoInput v-model="localMemo" :label="t('issueMemo')" :placeholder="t('issueMemoPlaceholder')" />
    </view>

    <template #footer>
      <NeoButton size="sm" variant="secondary" @click="$emit('close')">
        {{ t("cancel") }}
      </NeoButton>
      <NeoButton size="sm" variant="primary" :loading="isIssuing" @click="$emit('issue')">
        {{ isIssuing ? t("issuing") : t("issue") }}
      </NeoButton>
    </template>
  </NeoModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoModal, NeoButton, NeoInput } from "@shared/components";

const props = defineProps<{
  t: (key: string) => string;
  visible: boolean;
  recipient: string;
  seat: string;
  memo: string;
  isIssuing: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "issue"): void;
  (e: "update:recipient", value: string): void;
  (e: "update:seat", value: string): void;
  (e: "update:memo", value: string): void;
}>();

const localRecipient = ref(props.recipient);
const localSeat = ref(props.seat);
const localMemo = ref(props.memo);

watch(() => props.recipient, (newVal) => { localRecipient.value = newVal; });
watch(() => props.seat, (newVal) => { localSeat.value = newVal; });
watch(() => props.memo, (newVal) => { localMemo.value = newVal; });

watch(localRecipient, (newVal) => emit("update:recipient", newVal));
watch(localSeat, (newVal) => emit("update:seat", newVal));
watch(localMemo, (newVal) => emit("update:memo", newVal));
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
