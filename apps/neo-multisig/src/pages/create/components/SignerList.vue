<template>
  <div class="signer-list">
    <ItemList :items="signerItems" item-key="_index">
      <template #item="{ item, index }">
        <div class="signer-row">
          <span class="index">{{ index + 1 }}</span>
          <input
            class="input"
            :value="item.value"
            @input="$emit('update', { index, value: $event.target.value })"
            :placeholder="t('signerPlaceholder')"
            :aria-label="t('signerLabel')"
            required
          />
          <button
            v-if="signers.length > 1"
            type="button"
            class="remove-btn"
            :aria-label="t('removeSigner')"
            @click="$emit('remove', index)"
          >×</button>
        </div>
      </template>
    </ItemList>

    <NeoButton variant="secondary" size="sm" type="button" @click="$emit('add')" class="add-btn" :aria-label="t('addSigner')">
      {{ t("addSigner") }}
    </NeoButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const props = defineProps<{
  signers: string[];
}>();

const { t } = createUseI18n(messages)();

const signerItems = computed(() => props.signers.map((value, i) => ({ _index: String(i), value })));

defineEmits<{
  (e: "add"): void;
  (e: "remove", index: number): void;
  (e: "update", data: { index: number; value: string }): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.signer-list {
  display: flex;
  flex-direction: column;
}

.signer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.index {
  font-size: 12px;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
}

.input {
  flex: 1;
  background: var(--multisig-input-bg);
  border: 1px solid var(--multisig-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--multisig-input-text);
  font-size: 12px;
  font-family: $font-mono;
}

.remove-btn {
  font-size: 20px;
  color: var(--multisig-remove);
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.add-btn {
  margin-top: 12px;
}
</style>
