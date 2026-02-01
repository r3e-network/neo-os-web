<template>
  <NeoModal :visible="visible" :title="t('issueTitle')" :closeable="true" @close="$emit('close')">
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

    <template #footer>
      <NeoButton size="sm" variant="secondary" @click="$emit('close')">
        {{ t("cancel") }}
      </NeoButton>
      <NeoButton size="sm" variant="primary" :loading="loading" @click="handleIssue">
        {{ loading ? t("issuing") : t("issue") }}
      </NeoButton>
    </template>
  </NeoModal>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { NeoModal, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const emit = defineEmits<{
  close: [];
  issue: [data: { templateId: string; recipient: string; recipientName: string; achievement: string; memo: string }];
}>();

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  templateId: string;
}>();

const { t } = useI18n();

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
