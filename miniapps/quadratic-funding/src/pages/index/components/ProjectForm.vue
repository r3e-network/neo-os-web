<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <NeoInput v-model="localForm.name" :label="t('projectName')" :placeholder="t('projectNamePlaceholder')" />
      <NeoInput
        v-model="localForm.description"
        type="textarea"
        :label="t('projectDescription')"
        :placeholder="t('projectDescriptionPlaceholder')"
      />
      <NeoInput v-model="localForm.link" :label="t('projectLink')" :placeholder="t('projectLinkPlaceholder')" />

      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="isLoading"
        :disabled="isLoading"
        @click="emitRegister"
      >
        {{ isLoading ? t("registeringProject") : t("registerProject") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const emit = defineEmits<{
  (e: "register", data: { name: string; description: string; link: string }): void;
}>();

const { t } = useI18n();
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
  setLoading: (loading: boolean) => { isLoading.value = loading; },
  reset: () => {
    localForm.name = "";
    localForm.description = "";
    localForm.link = "";
  },
});
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
