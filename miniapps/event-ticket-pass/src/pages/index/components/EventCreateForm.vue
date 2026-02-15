<template>
  <FormCard
    :submit-label="isCreating ? t('creating') : t('createEvent')"
    :submit-loading="isCreating"
    :submit-disabled="isCreating"
    @submit="handleCreate"
  >
    <NeoInput v-model="localForm.name" :label="t('eventName')" :placeholder="t('eventNamePlaceholder')" />
    <NeoInput v-model="localForm.venue" :label="t('eventVenue')" :placeholder="t('eventVenuePlaceholder')" />
    <NeoInput v-model="localForm.start" :label="t('eventStart')" :placeholder="t('eventStartPlaceholder')" />
    <NeoInput v-model="localForm.end" :label="t('eventEnd')" :placeholder="t('eventEndPlaceholder')" />
    <NeoInput
      v-model="localForm.maxSupply"
      type="number"
      :label="t('maxSupply')"
      :placeholder="t('maxSupplyPlaceholder')"
    />
    <NeoInput v-model="localForm.notes" type="textarea" :label="t('notes')" :placeholder="t('notesPlaceholder')" />
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { NeoInput, FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  isCreating: boolean;
  form: {
    name: string;
    venue: string;
    start: string;
    end: string;
    maxSupply: string;
    notes: string;
  };
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "update:form", form: typeof props.form): void;
  (e: "create"): void;
}>();

const localForm = reactive({ ...props.form });

watch(
  () => props.form,
  (newForm) => {
    Object.assign(localForm, newForm);
  },
  { deep: true }
);

watch(
  localForm,
  (newForm) => {
    emit("update:form", { ...newForm });
  },
  { deep: true }
);

const handleCreate = () => {
  emit("create");
};
</script>

<style lang="scss" scoped></style>
