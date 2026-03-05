<template>
  <ActionModal
    :visible="visible"
    :title="t('issueTitle')"
    :closeable="true"
    :confirm-label="loading ? t('issuing') : t('issue')"
    :cancel-label="t('cancel')"
    :confirm-loading="loading"
    @close="$emit('close')"
    @cancel="$emit('close')"
    @confirm="handleIssue"
  >
    <view class="form-group">
      <NeoInput
        :model-value="localForm.recipient"
        @update:model-value="localForm.recipient = $event"
        :label="t('issueRecipient')"
        :placeholder="t('issueRecipientPlaceholder')"
      />
      <NeoInput
        :model-value="localForm.recipientName"
        @update:model-value="localForm.recipientName = $event"
        :label="t('recipientName')"
        :placeholder="t('recipientNamePlaceholder')"
      />
      <NeoInput
        :model-value="localForm.achievement"
        @update:model-value="localForm.achievement = $event"
        :label="t('achievement')"
        :placeholder="t('achievementPlaceholder')"
      />
      <NeoInput
        :model-value="localForm.memo"
        @update:model-value="localForm.memo = $event"
        :label="t('memo')"
        :placeholder="t('memoPlaceholder')"
      />
    </view>
  </ActionModal>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { ActionModal, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const emit = defineEmits<{
  close: [];
  issue: [data: { templateId: string; recipient: string; recipientName: string; achievement: string; memo: string }];
}>();

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  templateId: string;
}>();

const { t } = createUseI18n(messages)();

const localForm = reactive({
  recipient: "",
  recipientName: "",
  achievement: "",
  memo: "",
});

const handleIssue = () => {
  emit("issue", {
    templateId: props.templateId,
    ...localForm,
  });
};
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
