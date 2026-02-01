<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
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

      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="isCreating"
        :disabled="isCreating"
        @click="handleCreate"
      >
        {{ isCreating ? t("creating") : t("createEvent") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";

const props = defineProps<{
  t: (key: string) => string;
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

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
