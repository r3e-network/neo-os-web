<script setup lang="ts">
import { ref, computed } from "vue";
import { useRedEnvelope, type EnvelopeItem } from "@/composables/useRedEnvelope";
import { useI18n } from "@/composables/useI18n";
import { extractError } from "@/utils/format";

const props = defineProps<{ envelope: EnvelopeItem }>();
const emit = defineEmits<{
  close: [];
  transferred: [];
}>();

const { t } = useI18n();
const { transferEnvelope } = useRedEnvelope();

const recipient = ref("");
const sending = ref(false);
const error = ref("");
const success = ref(false);

const isValidAddress = (addr: string) => /^N[A-Za-z0-9]{33}$/.test(addr);
const addressValid = computed(() => !recipient.value || isValidAddress(recipient.value));
const canSubmit = computed(() => recipient.value.length === 34 && addressValid.value && !sending.value);

const handleTransfer = async () => {
  if (!isValidAddress(recipient.value)) {
    error.value = t("invalidAddress");
    return;
  }
  sending.value = true;
  error.value = "";
  try {
    await transferEnvelope(props.envelope.id, recipient.value);
    success.value = true;
    emit("transferred");
  } catch (e: unknown) {
    error.value = extractError(e);
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal transfer-modal">
      <div class="modal-header">
        <h3>{{ t("transferEnvelope") }} #{{ envelope.id }}</h3>
        <button class="btn-close" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div v-if="success" class="status success">
          {{ t("transferSuccess") }}
        </div>

        <template v-else>
          <div class="form-group">
            <label class="form-label">{{ t("labelRecipient") }}</label>
            <input
              v-model="recipient"
              type="text"
              :placeholder="t('recipientAddress')"
              :class="['input', { 'input-error': !addressValid }]"
              maxlength="34"
            />
            <div v-if="!addressValid" class="field-hint text-fail">{{ t("invalidAddress") }}</div>
          </div>

          <div v-if="error" class="status error">{{ error }}</div>

          <div class="modal-actions">
            <button class="btn" @click="emit('close')">
              {{ t("cancel") }}
            </button>
            <button class="btn btn-primary" :disabled="!canSubmit" @click="handleTransfer">
              {{ sending ? t("transferring") : t("confirm") }}
            </button>
          </div>
        </template>

        <button v-if="success" class="btn btn-primary" @click="emit('close')">
          {{ t("close") }}
        </button>
      </div>
    </div>
  </div>
</template>
