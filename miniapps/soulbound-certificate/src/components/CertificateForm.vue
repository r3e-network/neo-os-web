<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
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
        :loading="loading"
        :disabled="loading"
        @click="handleCreate"
      >
        {{ loading ? t("creating") : t("createTemplate") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const emit = defineEmits<{
  create: [data: { name: string; issuerName: string; category: string; maxSupply: string; description: string }];
}>();

const props = defineProps<{
  loading: boolean;
}>();

const { t } = useI18n();

const localForm = reactive({
  name: "",
  issuerName: "",
  category: "",
  maxSupply: "100",
  description: "",
});

const handleCreate = () => {
  emit("create", { ...localForm });
};
</script>
