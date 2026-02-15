<template>
  <ActionModal
    :visible="visible"
    :title="t('issueTicketTitle')"
    :closeable="true"
    :confirm-label="isIssuing ? t('issuing') : t('issue')"
    :cancel-label="t('cancel')"
    :confirm-loading="isIssuing"
    @close="$emit('close')"
    @cancel="$emit('close')"
    @confirm="$emit('issue')"
  >
    <view class="form-group">
      <NeoInput v-model="localRecipient" :label="t('issueRecipient')" :placeholder="t('issueRecipientPlaceholder')" />
      <NeoInput v-model="localSeat" :label="t('issueSeat')" :placeholder="t('issueSeatPlaceholder')" />
      <NeoInput v-model="localMemo" :label="t('issueMemo')" :placeholder="t('issueMemoPlaceholder')" />
    </view>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ActionModal, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  visible: boolean;
  recipient: string;
  seat: string;
  memo: string;
  isIssuing: boolean;
}>();

const { t } = createUseI18n(messages)();

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

watch(
  () => props.recipient,
  (newVal) => {
    localRecipient.value = newVal;
  }
);
watch(
  () => props.seat,
  (newVal) => {
    localSeat.value = newVal;
  }
);
watch(
  () => props.memo,
  (newVal) => {
    localMemo.value = newVal;
  }
);

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
