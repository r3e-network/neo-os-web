<template>
  <NeoCard variant="erobo-neo">
    <div class="form-group">
      <NeoInput v-model="localForm.name" :label="t('templateName')" :placeholder="t('templateNamePlaceholder')" />
      <NeoInput v-model="localForm.issuerName" :label="t('issuerName')" :placeholder="t('issuerNamePlaceholder')" />
      <NeoInput v-model="localForm.category" :label="t('category')" :placeholder="t('categoryPlaceholder')" />
      <NeoInput
        v-model="localForm.maxSupply"
        type="number"
        :label="t('maxSupply')"
        :placeholder="t('maxSupplyPlaceholder')"
      />
      <NeoInput
        v-model="localForm.description"
        type="textarea"
        :label="t('description')"
        :placeholder="t('descriptionPlaceholder')"
      />

      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
        :loading="loading"
        :disabled="loading"
        :aria-label="t('createTemplate')"
        @click="handleCreate"
      >
        {{ loading ? t("creating") : t("createTemplate") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const emit = defineEmits<{
  create: [data: { name: string; issuerName: string; category: string; maxSupply: string; description: string }];
}>();

const props = defineProps<{
  loading: boolean;
  prefill?: {
    name?: string;
    issuerName?: string;
    category?: string;
    maxSupply?: string;
    description?: string;
  } | null;
  prefillKey?: string | number;
}>();

const { t } = createUseI18n(messages)();

const localForm = reactive({
  name: "",
  issuerName: "",
  category: "",
  maxSupply: "100",
  description: "",
});

watch(
  () => [props.prefillKey, props.prefill],
  () => {
    if (!props.prefill) return;
    localForm.name = String(props.prefill.name || "");
    localForm.issuerName = String(props.prefill.issuerName || "");
    localForm.category = String(props.prefill.category || "");
    localForm.maxSupply = String(props.prefill.maxSupply || "100");
    localForm.description = String(props.prefill.description || "");
  },
  { immediate: true },
);

const handleCreate = () => {
  emit("create", { ...localForm });
};
</script>
