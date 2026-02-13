<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="breaker.status.value"
    class="theme-unbreakable-vault"
    @tab-change="activeTab = $event"
  >
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <template #content>
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
      <VaultList
        :t="t"
        :title="t('myVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="myVaults"
        @select="breaker.selectVault"
      />

      <NeoCard v-if="createdVaultId" variant="erobo" class="vault-created">
        <text class="vault-created-label">{{ t("vaultCreated") }}</text>
        <text class="vault-created-id">#{{ createdVaultId }}</text>
      </NeoCard>
      </ErrorBoundary>
    </template>

    <template #operation>
      <VaultCreate
        :t="t"
        v-model:bounty="bounty"
        v-model:title="vaultTitle"
        v-model:description="vaultDescription"
        v-model:difficulty="vaultDifficulty"
        v-model:secret="secret"
        v-model:secretConfirm="secretConfirm"
        :secret-hash="secretHash"
        :loading="isCreating"
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

      <VaultDetails v-if="breaker.vaultDetails.value" :t="t" :details="breaker.vaultDetails.value" />

      <VaultList
        :t="t"
        :title="t('recentVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="breaker.recentVaults.value"
        @select="breaker.selectVault"
      />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { sha256Hex } from "@shared/utils/hash";
import { normalizeScriptHash, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { toFixed8 } from "@shared/utils/format";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { MiniAppTemplate, NeoButton, NeoInput, NeoCard, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { useVaultBreaker } from "@/composables/useVaultBreaker";
import VaultCreate from "./components/VaultCreate.vue";
import VaultList from "./components/VaultList.vue";
import VaultDetails from "./components/VaultDetails.vue";

const { t } = createUseI18n(messages)();

const APP_ID = "miniapp-unbreakablevault";
const MIN_BOUNTY = 1;

const { address, connect, invokeContract } = useWallet() as WalletSDK;
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
const { processPayment, isLoading: isCreating } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();

const breaker = useVaultBreaker(APP_ID, t);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "create", labelKey: "create", icon: "🔒", default: true },
    { key: "break", labelKey: "break", icon: "🔑" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const appState = computed(() => ({}));

const sidebarItems = computed(() => [
  { label: t("create"), value: myVaults.value.length },
  { label: t("break"), value: breaker.recentVaults.value.length },
  { label: t("sidebarDifficulty"), value: vaultDifficulty.value },
  { label: t("sidebarAttemptFee"), value: `${breaker.attemptFeeDisplay.value} GAS` },
]);

const activeTab = ref("create");

const bounty = ref("");
const vaultTitle = ref("");
const vaultDescription = ref("");
const vaultDifficulty = ref(1);
const secret = ref("");
const secretConfirm = ref("");
const secretHash = ref("");
const createdVaultId = ref<string | null>(null);

const myVaults = ref<{ id: string; bounty: number; created: number }[]>([]);

const loadMyVaults = async () => {
  if (!address.value) {
    myVaults.value = [];
    return;
  }
  try {
    const res = await listEvents({ app_id: APP_ID, event_name: "VaultCreated", limit: 50 });
    const myHash = normalizeScriptHash(addressToScriptHash(address.value));
    const vaults = res.events
      .map((evt: Record<string, unknown>) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        const id = String(values[0] ?? "");
        const creator = String(values[1] ?? "");
        const bountyValue = Number(values[2] ?? 0);
        const creatorHash = normalizeScriptHash(addressToScriptHash(creator));
        if (!id || creatorHash !== myHash) return null;
        return {
          id,
          bounty: bountyValue,
          created: evt.created_at ? new Date(evt.created_at as string).getTime() : Date.now(),
        };
      })
      .filter(Boolean) as { id: string; bounty: number; created: number }[];
    myVaults.value = vaults.sort((a, b) => b.created - a.created);
  } catch (_e: unknown) {
    // My vaults load failure is non-critical
  }
};

const createVault = async () => {
  if (isCreating.value) return;
  breaker.clearStatus();
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();
    const amount = Number.parseFloat(bounty.value);
    const bountyInt = toFixed8(amount);
    const hash = secretHash.value || (await sha256Hex(secret.value));
    const { receiptId, invoke } = await processPayment(String(amount), `vault:create:${hash.slice(0, 10)}`);
    if (!receiptId) throw new Error(t("receiptMissing"));
    const res = await invoke(
      "createVault",
      [
        { type: "Hash160", value: address.value as string },
        { type: "ByteArray", value: hash },
        { type: "Integer", value: bountyInt },
        { type: "Integer", value: String(vaultDifficulty.value) },
        { type: "String", value: vaultTitle.value.trim().slice(0, 100) },
        { type: "String", value: vaultDescription.value.trim().slice(0, 300) },
        { type: "Integer", value: String(receiptId) },
      ],
      contract
    );
    const resRecord = res as Record<string, unknown>;
    const stackArr = resRecord?.stack as unknown[] | undefined;
    const firstStackItem = stackArr?.[0] as Record<string, unknown> | undefined;
    const vaultId = String(resRecord?.result || firstStackItem?.value || "");
    createdVaultId.value = vaultId || createdVaultId.value;
    breaker.setStatus(t("vaultCreated"), "success");
    bounty.value = "";
    vaultTitle.value = "";
    vaultDescription.value = "";
    vaultDifficulty.value = 1;
    secret.value = "";
    secretConfirm.value = "";
    await breaker.loadRecentVaults();
    await loadMyVaults();
  } catch (e: unknown) {
    breaker.setStatus(formatErrorMessage(e, t("vaultCreateFailed")), "error");
  }
};

watch(secret, async (value) => {
  secretHash.value = value ? await sha256Hex(value) : "";
});

onMounted(() => {
  breaker.loadRecentVaults();
  loadMyVaults();
});

const { handleBoundaryError } = useHandleBoundaryError("unbreakable-vault");
const resetAndReload = async () => {
  breaker.loadRecentVaults();
  loadMyVaults();
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
