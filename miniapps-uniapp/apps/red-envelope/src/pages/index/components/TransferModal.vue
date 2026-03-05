<template>
  <ActionModal :visible="visible" :title="t('transferEnvelope')" :closeable="true" @close="$emit('close')">
    <view class="envelope-info">
      <text class="info-label">🧧 #{{ envelope?.id }}</text>
      <text class="info-amount">{{ envelope?.totalAmount }} GAS</text>
    </view>

    <view class="input-section">
      <NeoInput :modelValue="recipient" @update:modelValue="recipient = $event" :placeholder="t('recipientAddress')" />
    </view>

    <view v-if="errorMsg" class="error-msg">
      <text>{{ errorMsg }}</text>
    </view>

    <template #actions>
      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="transferring"
        :disabled="!recipient.trim()"
        @click="handleTransfer"
      >
        {{ t("transferEnvelope") }}
      </NeoButton>
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ActionModal, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  visible: boolean;
  envelope: { id: string; totalAmount: number } | null;
}>();

const emit = defineEmits<{
  close: [];
  transfer: [recipient: string];
}>();

const recipient = ref("");
const transferring = ref(false);
const errorMsg = ref("");

const handleTransfer = () => {
  if (!recipient.value.trim()) return;
  errorMsg.value = "";
  emit("transfer", recipient.value.trim());
};
</script>
