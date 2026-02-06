<template>
  <NeoCard variant="erobo" class="creator-studio">
    <view class="studio-header">
      <text class="title">{{ t("studioTitle") }}</text>
      <text class="subtitle">{{ t("studioSubtitle") }}</text>
    </view>
    
    <view class="form-step">
      <text class="label">{{ t("machineNameLabel") }}</text>
      <NeoInput v-model="form.name" :placeholder="t('machineNamePlaceholder')" />
    </view>

    <view class="form-step">
      <text class="label">{{ t("descriptionLabel") }}</text>
      <NeoInput v-model="form.description" type="textarea" :placeholder="t('descriptionPlaceholder')" />
    </view>

    <view class="form-step">
      <text class="label">{{ t("categoryLabel") }}</text>
      <NeoInput v-model="form.category" :placeholder="t('categoryPlaceholder')" />
    </view>

    <view class="form-step">
      <text class="label">{{ t("tagsLabel") }}</text>
      <NeoInput v-model="form.tags" :placeholder="t('tagsPlaceholder')" />
    </view>

    <view class="form-step">
      <text class="label">{{ t("pricePerPlayLabel") }}</text>
      <NeoInput v-model="form.price" type="number" placeholder="1.0" />
    </view>

    <view class="form-step">
      <view class="label-row">
        <text class="label">{{ t("inventoryAndOdds") }}</text>
        <NeoButton size="sm" variant="secondary" @click="addItem">+ {{ t("addItem") }}</NeoButton>
      </view>
      
      <view class="inventory-list">
        <view v-if="form.items.length === 0" class="empty-inventory">
          {{ t("emptyInventory", { action: t("addItem") }) }}
        </view>
        
        <view v-for="(item, idx) in form.items" :key="idx" class="inventory-item">
          <view class="item-header">
            <text class="item-idx">#{{ idx + 1 }}</text>
            <text class="remove-btn" @click="removeItem(idx)">✕</text>
          </view>
          
          <view class="item-inputs">
            <NeoInput v-model="item.name" :placeholder="t('itemNamePlaceholder')" class="mb-2" />
            <view class="probability-row">
              <NeoInput v-model="item.probability" type="number" suffix="%" :placeholder="t('probPlaceholder')" />
              <view class="rarity-badge">{{ getRarity(item.probability) }}</view>
            </view>

            <view class="asset-row">
              <text class="asset-label">{{ t("assetTypeLabel") }}</text>
              <view class="asset-buttons">
                <NeoButton
                  size="sm"
                  :variant="item.assetType === 'nep17' ? 'primary' : 'secondary'"
                  @click="item.assetType = 'nep17'"
                >
                  NEP-17
                </NeoButton>
                <NeoButton
                  size="sm"
                  :variant="item.assetType === 'nep11' ? 'primary' : 'secondary'"
                  @click="item.assetType = 'nep11'"
                >
                  NEP-11
                </NeoButton>
              </view>
            </view>

            <view class="asset-inputs">
              <NeoInput v-model="item.assetHash" :placeholder="t('tokenContractPlaceholder')" class="mb-2" />
              <NeoInput
                v-if="item.assetType === 'nep17'"
                v-model="item.amount"
                type="number"
                :placeholder="t('tokenAmountPlaceholder')"
              />
              <NeoInput
                v-else
                v-model="item.tokenId"
                :placeholder="t('tokenIdPlaceholder')"
              />
            </view>
          </view>
        </view>
      </view>
      
      <view class="total-odds" :class="{ 'valid': totalProbability === 100 }">
        {{ t("totalProbabilityLabel") }}: {{ totalProbability }}%
      </view>
      <text class="inventory-note">
        {{ t("inventoryNote") }}
      </text>
    </view>

    <NeoButton 
      variant="primary" 
      block 
      size="lg" 
      :disabled="!isValid || props.publishing" 
      :loading="props.publishing"
      @click="publish"
    >
      {{ t("createMachineAction") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  publishing?: boolean;
}>();

const emit = defineEmits(['publish']);

const { t } = useI18n();

const form = ref({
  name: '',
  description: '',
  category: '',
  tags: '',
  price: '',
  items: [] as any[]
});

const toNumber = (value: string | number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};
const isWholeNumber = (value: string | number) => Number.isInteger(toNumber(value));

const isNonEmpty = (value: string) => value.trim().length > 0;
const normalizeAssetHash = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed)) {
    return normalizeScriptHash(trimmed);
  }
  return addressToScriptHash(trimmed);
};
const isValidAssetHash = (value: string) => Boolean(normalizeAssetHash(value));

const addItem = () => {
  form.value.items.push({
    name: '',
    probability: '10', // Default 10%
    icon: '📦',
    assetType: 'nep17',
    assetHash: '',
    amount: '',
    tokenId: ''
  });
};

const removeItem = (idx: number) => {
  form.value.items.splice(idx, 1);
};

const totalProbability = computed(() => {
  return form.value.items.reduce((sum, item) => sum + toNumber(item.probability || 0), 0);
});

const isValid = computed(() => {
  const priceValue = toNumber(form.value.price);
  const itemsValid = form.value.items.length > 0 && form.value.items.every((item) => {
    const probabilityValue = toNumber(item.probability);
    if (!isNonEmpty(String(item.name || "")) || !isWholeNumber(probabilityValue) || probabilityValue <= 0) {
      return false;
    }
    if (!isValidAssetHash(String(item.assetHash || ""))) {
      return false;
    }
    if (item.assetType === 'nep17') {
      return toNumber(item.amount) > 0;
    }
    if (item.assetType === 'nep11') return true;
    return false;
  });
  const totalIsValid = totalProbability.value === 100;
  return (
    isNonEmpty(form.value.name) &&
    isNonEmpty(form.value.description) &&
    priceValue > 0 &&
    itemsValid &&
    totalIsValid
  );
});

const getRarity = (prob: string | number) => {
  const p = toNumber(prob);
  if (p <= 1) return 'LEGENDARY';
  if (p <= 5) return 'EPIC';
  if (p <= 20) return 'RARE';
  return 'COMMON';
};

const publish = () => {
  if (!isValid.value) return;
  const normalizedItems = form.value.items.map((item) => ({
    name: String(item.name || "").trim(),
    probability: Math.trunc(toNumber(item.probability)),
    icon: item.icon || '📦',
    rarity: getRarity(item.probability),
    assetType: item.assetType,
    assetHash: String(item.assetHash || "").trim(),
    amount: String(item.amount || "").trim(),
    tokenId: String(item.tokenId || "").trim()
  }));
  const priceValue = toNumber(form.value.price);
  emit('publish', {
    id: Date.now().toString(),
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    category: form.value.category.trim(),
    tags: form.value.tags.trim(),
    price: priceValue.toString(),
    items: normalizedItems
  });
  // Reset
  form.value = { name: '', description: '', category: '', tags: '', price: '', items: [] };
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.studio-header {
  margin-bottom: $spacing-4;
  border-bottom: 1px solid var(--gacha-divider);
  padding-bottom: $spacing-3;
}

.title {
  font-size: 18px;
  font-weight: 800;
  display: block;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.form-step {
  margin-bottom: $spacing-4;
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 700;
  margin-bottom: 6px;
  display: block;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-inventory {
  padding: 20px;
  text-align: center;
  border: 1px dashed var(--gacha-panel-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.inventory-item {
  background: var(--gacha-surface-strong);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--gacha-panel-border);
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-idx {
  font-size: 10px;
  color: var(--text-secondary);
}

.remove-btn {
  color: var(--gacha-danger-text);
  font-weight: bold;
}

.probability-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.asset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.asset-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 700;
}

.asset-buttons {
  display: flex;
  gap: 6px;
}

.asset-inputs {
  margin-top: 8px;
}

.rarity-badge {
  font-size: 9px;
  padding: 4px 8px;
  background: var(--gacha-badge-bg);
  border-radius: 4px;
  font-weight: 700;
  min-width: 60px;
  text-align: center;
}

.total-odds {
  margin-top: 10px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: var(--gacha-danger-text);
  
  &.valid {
    color: var(--gacha-accent-green);
  }
}

.inventory-note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  display: block;
}
</style>
