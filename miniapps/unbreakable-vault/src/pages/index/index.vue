<template>
  <MiniAppPage
    name="unbreakable-vault"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="breaker.status.value"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <VaultList
        :title="t('myVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="creator.myVaults.value"
        @select="breaker.selectVault"
      />

      <NeoCard v-if="creator.createdVaultId.value" variant="erobo" class="vault-created">
        <text class="vault-created-label">{{ t("vaultCreated") }}</text>
        <text class="vault-created-id">#{{ creator.createdVaultId.value }}</text>
      </NeoCard>
    </template>

    <template #operation>
      <VaultCreate
        v-model:bounty="bounty"
        v-model:title="vaultTitle"
        v-model:description="vaultDescription"
        v-model:difficulty="vaultDifficulty"
        v-model:secret="secret"
        v-model:secretConfirm="secretConfirm"
        :secret-hash="secretHash"
        :loading="creator.isCreating.value"
        :min-bounty="MIN_BOUNTY"
        @create="createVault"
      />
    </template>

    <template #tab-break>
      <NeoCard variant="erobo-neo">
        <view class="form-group">
          <view class="input-group">
            <text class="input-label">{{ t("vaultIdLabel") }}</text>
            <NeoInput v-model="breaker.vaultIdInput.value" type="number" :placeholder="t('vaultIdPlaceholder')" />
          </view>

          <NeoButton variant="secondary" block :loading="breaker.isLoading.value" @click="breaker.loadVault">
            {{ t("loadVault") }}
          </NeoButton>

          <view class="input-group">
            <text class="input-label">{{ t("secretAttemptLabel") }}</text>
            <NeoInput v-model="breaker.attemptSecret.value" :placeholder="t('secretAttemptPlaceholder')" />
          </view>

          <text class="helper-text">{{ t("attemptFeeNote").replace("{fee}", breaker.attemptFeeDisplay.value) }}</text>

          <NeoButton
            variant="primary"
            size="lg"
            block
            :loading="breaker.isLoading.value"
            :disabled="!breaker.canAttempt.value || breaker.isLoading.value"
            @click="breaker.attemptBreak"
          >
            {{ breaker.isLoading.value ? t("attempting") : t("attemptBreak") }}
          </NeoButton>
        </view>
      </NeoCard>

      <VaultDetails v-if="breaker.vaultDetails.value" :details="breaker.vaultDetails.value" />

      <VaultList
        :title="t('recentVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="breaker.recentVaults.value"
        @select="breaker.selectVault"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { sha256Hex } from "@shared/utils/hash";
import { MiniAppPage, NeoCard } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useVaultBreaker } from "@/composables/useVaultBreaker";
import { useVaultCreator } from "@/composables/useVaultCreator";
import VaultList from "./components/VaultList.vue";

const APP_ID = "miniapp-unbreakablevault";
const MIN_BOUNTY = 1;

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "unbreakable-vault",
  messages,
  template: {
    tabs: [
      { key: "create", labelKey: "create", icon: "🔒", default: true },
      { key: "break", labelKey: "break", icon: "🔑" },
    ],
  },
  sidebarItems: [
    { labelKey: "create", value: () => creator.myVaults.value.length },
    { labelKey: "break", value: () => breaker.recentVaults.value.length },
    { labelKey: "sidebarDifficulty", value: () => vaultDifficulty.value },
    { labelKey: "sidebarAttemptFee", value: () => `${breaker.attemptFeeDisplay.value} GAS` },
  ],
});

const breaker = useVaultBreaker(APP_ID, t);
const creator = useVaultCreator(APP_ID, t, breaker.setStatus);

const appState = computed(() => ({}));

const bounty = ref("");
const vaultTitle = ref("");
const vaultDescription = ref("");
const vaultDifficulty = ref(1);
const secret = ref("");
const secretConfirm = ref("");
const secretHash = ref("");

const createVault = async () => {
  await creator.createVault(
    {
      bounty: bounty.value,
      title: vaultTitle.value,
      description: vaultDescription.value,
      difficulty: vaultDifficulty.value,
      secret: secret.value,
      secretHash: secretHash.value,
    },
    () => {
      bounty.value = "";
      vaultTitle.value = "";
      vaultDescription.value = "";
      vaultDifficulty.value = 1;
      secret.value = "";
      secretConfirm.value = "";
    },
    breaker.loadRecentVaults
  );
};

watch(secret, async (value) => {
  secretHash.value = value ? await sha256Hex(value) : "";
});

onMounted(() => {
  breaker.loadRecentVaults();
  creator.loadMyVaults();
});

const resetAndReload = async () => {
  breaker.loadRecentVaults();
  creator.loadMyVaults();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./unbreakable-vault-theme.scss";

:global(page) {
  background: var(--bg-primary);
  font-family: var(--vault-font);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--vault-text-muted);
  margin-left: 4px;
  letter-spacing: 0.05em;
}

.helper-text {
  font-size: 12px;
  color: var(--vault-text-subtle);
  margin-left: 8px;
  margin-top: 4px;
}

.vault-created {
  text-align: center;
}

.vault-created-label {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--vault-text-muted);
}

.vault-created-id {
  font-size: 32px;
  font-weight: 800;
  color: var(--vault-text-strong);
  margin-top: 8px;
}
</style>
