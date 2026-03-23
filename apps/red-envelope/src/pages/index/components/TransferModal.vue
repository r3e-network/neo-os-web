<template>
  <ActionModal :visible="visible" :title="t('transferEnvelope')" :closeable="true" @close="$emit('close')">
    <div class="envelope-info">
      <span class="info-label"><AppIcon name="envelope_red" :size="20" aria-hidden="true" /> #{{ envelope?.id }}</span>
      <span class="info-amount">{{ envelope?.totalAmount }} {{ t("tokenGas") }}</span>
    </div>

    <div class="input-section">
      <NeoInput :modelValue="recipient" @update:modelValue="recipient = $event" :placeholder="t('recipientAddress')" :aria-label="t('recipientAddress')" :error="errorMsg" />
    </div>

    <div v-if="errorMsg" class="error-msg" role="alert">
      <span>{{ errorMsg }}</span>
    </div>

    <template #actions>
      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
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
import { ActionModal, AppIcon, NeoButton, NeoInput } from "@shared/components";
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
