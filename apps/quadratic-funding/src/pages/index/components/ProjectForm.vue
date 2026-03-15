<template>
  <FormCard
    :submit-label="isLoading ? t('registeringProject') : t('registerProject')"
    :submit-loading="isLoading"
    :submit-disabled="isLoading"
    @submit="emitRegister"
  >
    <NeoInput v-model="localForm.name" :label="t('projectName')" :placeholder="t('projectNamePlaceholder')" />
    <NeoInput
      v-model="localForm.description"
      type="textarea"
      :label="t('projectDescription')"
      :placeholder="t('projectDescriptionPlaceholder')"
    />
    <NeoInput v-model="localForm.link" :label="t('projectLink')" :placeholder="t('projectLinkPlaceholder')" />
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { NeoInput, FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const emit = defineEmits<{
  (e: "register", data: { name: string; description: string; link: string }): void;
}>();

const { t } = createUseI18n(messages)();
const isLoading = ref(false);

const localForm = reactive({
  name: "",
  description: "",
  link: "",
});

const emitRegister = () => {
  emit("register", { ...localForm });
};

defineExpose({
  setLoading: (loading: boolean) => {
    isLoading.value = loading;
  },
  reset: () => {
    localForm.name = "";
    localForm.description = "";
    localForm.link = "";
  },
});
</script>

<style lang="scss" scoped></style>
