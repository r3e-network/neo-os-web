<template>
  <view class="signer-list">
    <ItemList :items="signerItems" item-key="_index">
      <template #item="{ item, index }">
        <view class="signer-row">
          <text class="index">{{ index + 1 }}</text>
          <input
            class="input"
            :value="item.value"
            @input="$emit('update', { index, value: $event.target.value })"
            :placeholder="t('signerPlaceholder')"
          />
          <text
            v-if="signers.length > 1"
            class="remove-btn"
            role="button"
            :aria-label="t('removeSigner') || 'Remove signer'"
            tabindex="0"
            @click="$emit('remove', index)"
            @keydown.enter="$emit('remove', index)"
            >×</text
          >
        </view>
      </template>
    </ItemList>

    <NeoButton variant="secondary" size="sm" @click="$emit('add')" class="add-btn">
      {{ t("addSigner") }}
    </NeoButton>
  </view>
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

defineEmits(["add", "remove", "update"]);
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
}

.add-btn {
  margin-top: 12px;
}
</style>
