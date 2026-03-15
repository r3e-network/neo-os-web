<template>
  <div class="proposal-create">
    <NeoCard variant="erobo" class="create-card">
      <span class="create-title">{{ t('createProposal') }}</span>
      <div class="form-group">
        <span class="form-label">{{ t('proposalTitle') }}</span>
        <input type="text" v-model="form.title" class="form-input" :placeholder="t('enterTitle')" />
      </div>
      <div class="form-group">
        <span class="form-label">{{ t('proposalDescription') }}</span>
        <textarea v-model="form.description" class="form-textarea" :placeholder="t('enterDescription')" />
      </div>
      <div class="form-group">
        <span class="form-label">{{ t('requestedAmount') }}</span>
        <input type="number" v-model="form.amount" class="form-input" :placeholder="t('enterAmount')" />
      </div>
      <NeoButton variant="primary" :disabled="!isValid" @click="$emit('submit', form)">
        {{ t('submitProposal') }}
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { NeoCard, NeoButton } from "@shared/components";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  submit: [form: { title: string; description: string; amount: string }];
}>();

const form = reactive({
  title: "",
  description: "",
  amount: "",
});

const isValid = computed(() => {
  return form.title.trim().length > 0 && 
         form.description.trim().length > 0 && 
         Number(form.amount) > 0;
});
</script>

<style lang="scss" scoped>
.proposal-create {
  margin-bottom: 16px;
}

.create-card {
  padding: 20px;
}

.create-title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--eco-text);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--eco-text-muted);
  margin-bottom: 4px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--eco-card-border);
  border-radius: 8px;
  background: var(--eco-bg);
  color: var(--eco-text);
  font-size: 14px;
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}
</style>
