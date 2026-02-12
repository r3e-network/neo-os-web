<template>
  <view class="tab-content scrollable">
    <NeoCard v-if="!address" variant="erobo" class="section-card">
      <text class="status-text">{{ t("connectWallet") }}</text>
      <NeoButton size="sm" variant="secondary" @click="$emit('connect-wallet')">
        {{ t("wpConnect") }}
      </NeoButton>
    </NeoCard>
    <view v-else-if="ownedMachines.length === 0" class="empty-state">
      {{ t("noOwnedMachines") }}
    </view>
    <view v-else class="manage-list">
      <NeoCard v-for="machine in ownedMachines" :key="machine.id" variant="erobo" class="section-card">
        <view class="manage-header">
          <view>
            <text class="manage-title">{{ machine.name }}</text>
            <text class="manage-sub">{{ machine.category || t("general") }}</text>
          </view>
          <view class="badge-row">
            <text class="badge" :class="{ active: machine.active }">
              {{ machine.active ? t("statusActive") : t("statusInactive") }}
            </text>
            <text class="badge" :class="{ active: machine.listed }">
              {{ machine.listed ? t("statusListed") : t("statusHidden") }}
            </text>
            <text v-if="machine.forSale" class="badge sale">{{ t("forSale") }}</text>
          </view>
        </view>

        <view v-if="machine.revenueRaw > 0" class="manage-actions manage-actions--revenue">
          <text class="revenue-label"> {{ t("revenueLabel") }}: {{ formatGas(machine.revenueRaw) }} GAS </text>
          <NeoButton
            size="sm"
            variant="primary"
            :loading="actionLoading[`withdrawRevenue:${machine.id}`]"
            @click="$emit('withdraw-revenue', machine)"
          >
            {{ t("withdrawRevenue") }}
          </NeoButton>
        </view>

        <view class="manage-actions">
          <NeoInput v-model="getMachineInput(machine).price" :label="t('priceGas')" type="number" />
          <NeoButton
            size="sm"
            variant="primary"
            :loading="actionLoading[`price:${machine.id}`]"
            @click="$emit('update-price', machine)"
          >
            {{ t("updatePrice") }}
          </NeoButton>
          <NeoButton
            size="sm"
            variant="secondary"
            :loading="actionLoading[`active:${machine.id}`]"
            @click="$emit('toggle-active', machine)"
          >
            {{ t("toggleActive") }}
          </NeoButton>
          <NeoButton
            size="sm"
            variant="secondary"
            :loading="actionLoading[`listed:${machine.id}`]"
            @click="$emit('toggle-listed', machine)"
          >
            {{ t("toggleListed") }}
          </NeoButton>
        </view>

        <view class="manage-actions">
          <NeoInput v-model="getMachineInput(machine).salePrice" :label="t('salePriceGas')" type="number" />
          <NeoButton
            size="sm"
            variant="primary"
            :loading="actionLoading[`sale:${machine.id}`]"
            @click="$emit('list-for-sale', machine)"
          >
            {{ t("listForSale") }}
          </NeoButton>
          <NeoButton
            v-if="machine.forSale"
            size="sm"
            variant="secondary"
            :loading="actionLoading[`cancelSale:${machine.id}`]"
            @click="$emit('cancel-sale', machine)"
          >
            {{ t("cancelSale") }}
          </NeoButton>
        </view>

        <view class="inventory-grid">
          <view v-for="(item, idx) in machine.items" :key="idx" class="inventory-item">
            <view class="inventory-header">
              <text class="inventory-name">{{ item.name }}</text>
              <text class="inventory-stock" v-if="item.assetType === 1">
                {{ t("stockLabel") }}: {{ item.stockDisplay }}
              </text>
              <text class="inventory-stock" v-else> {{ t("tokenCountLabel") }}: {{ item.tokenCount }} </text>
            </view>
            <text class="inventory-meta" v-if="item.assetType === 1">
              {{ t("prizePerWinLabel") }}: {{ item.amountDisplay }}
            </text>
            <text class="inventory-meta" v-else>
              {{ t("prizeNftLabel", { tokenId: item.tokenId || t("anyToken") }) }}
            </text>
            <view class="inventory-actions">
              <NeoInput
                v-if="item.assetType === 1"
                v-model="getInventoryInput(machine.id, idx + 1).deposit"
                :placeholder="t('depositAmountPlaceholder')"
                type="number"
              />
              <NeoInput
                v-if="item.assetType === 2"
                v-model="getInventoryInput(machine.id, idx + 1).tokenId"
                :placeholder="t('tokenIdShortPlaceholder')"
              />
          <NeoButton
            size="sm"
            variant="primary"
            :loading="actionLoading[`deposit:${machine.id}:${idx + 1}`]"
            @click="$emit('deposit-item', { machine, item, index: idx + 1, amount: getInventoryInput(machine.id, idx + 1).deposit, tokenId: getInventoryInput(machine.id, idx + 1).tokenId })"
          >
            {{ t("deposit") }}
          </NeoButton>
            </view>
            <view class="inventory-actions">
              <NeoInput
                v-if="item.assetType === 1"
                v-model="getInventoryInput(machine.id, idx + 1).withdraw"
                :placeholder="t('withdrawAmountPlaceholder')"
                type="number"
              />
              <NeoInput
                v-if="item.assetType === 2"
                v-model="getInventoryInput(machine.id, idx + 1).tokenId"
                :placeholder="t('tokenIdShortPlaceholder')"
              />
          <NeoButton
            size="sm"
            variant="secondary"
            :loading="actionLoading[`withdraw:${machine.id}:${idx + 1}`]"
            @click="$emit('withdraw-item', { machine, item, index: idx + 1, amount: getInventoryInput(machine.id, idx + 1).withdraw, tokenId: getInventoryInput(machine.id, idx + 1).tokenId })"
          >
            {{ t("withdraw") }}
          </NeoButton>
            </view>
          </view>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { formatGas } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import type { Machine, MachineItem } from "@/types";

interface InventoryOperation {
  machine: Machine;
  item: MachineItem;
  index: number;
  amount: string;
  tokenId: string;
}

const props = defineProps<{
  machines: Machine[];
  address: string | null;
  isLoading: boolean;
  actionLoading: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: "connect-wallet"): void;
  (e: "update-price", machine: Machine): void;
  (e: "toggle-active", machine: Machine): void;
  (e: "toggle-listed", machine: Machine): void;
  (e: "list-for-sale", machine: Machine): void;
  (e: "cancel-sale", machine: Machine): void;
  (e: "withdraw-revenue", machine: Machine): void;
  (e: "deposit-item", operation: InventoryOperation): void;
  (e: "withdraw-item", operation: InventoryOperation): void;
}>();

const { t } = useI18n();

const machineInputs = ref<Record<string, { price: string; salePrice: string }>>({});
const inventoryInputs = ref<Record<string, { deposit: string; withdraw: string; tokenId: string }>>({});

const walletHash = computed(() => {
  if (!props.address) return "";
  const scriptHash = addressToScriptHash(props.address);
  return normalizeScriptHash(scriptHash);
});

const ownedMachines = computed(() =>
  props.machines.filter((machine) => machine.ownerHash && machine.ownerHash === walletHash.value),
);

const gasInputFromRaw = (raw: number) => {
  if (!Number.isFinite(raw) || raw <= 0) return "0";
  const value = (raw / 1e8).toFixed(8);
  return value.replace(/\.?0+$/, "");
};

const getMachineInput = (machine: Machine) => {
  if (!machineInputs.value[machine.id]) {
    machineInputs.value[machine.id] = {
      price: gasInputFromRaw(machine.priceRaw),
      salePrice: machine.salePriceRaw > 0 ? gasInputFromRaw(machine.salePriceRaw) : "",
    };
  }
  return machineInputs.value[machine.id];
};

const getInventoryInput = (machineId: string, itemIndex: number) => {
  const key = `${machineId}:${itemIndex}`;
  if (!inventoryInputs.value[key]) {
    inventoryInputs.value[key] = { deposit: "", withdraw: "", tokenId: "" };
  }
  return inventoryInputs.value[key];
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-text {
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
}

.manage-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.manage-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.manage-title {
  font-weight: 800;
  font-size: 18px;
  color: var(--text-primary);
}

.manage-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.badge-row {
  display: flex;
  gap: 4px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--gacha-badge-bg);
  color: var(--gacha-badge-text);
  text-transform: uppercase;

  &.active {
    background: var(--gacha-badge-active-bg);
    color: var(--gacha-badge-active-text);
  }
  &.sale {
    background: var(--gacha-badge-sale-bg);
    color: var(--gacha-badge-sale-text);
  }
}

.manage-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  background: var(--gacha-manage-bg);
  padding: 12px;
  border-radius: 12px;
}

.manage-actions--revenue {
  background: var(--gacha-revenue-bg);
  border: 1px dashed var(--gacha-revenue-border);
}

.revenue-label {
  flex: 1;
  font-weight: 700;
  color: var(--gacha-revenue-text);
}

.inventory-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.inventory-item {
  background: var(--gacha-surface-alt);
  border: 1px solid var(--gacha-panel-border);
  padding: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.inventory-meta {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.inventory-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
