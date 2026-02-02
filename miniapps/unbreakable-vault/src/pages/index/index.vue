<template>
  <ResponsiveLayout 
    :desktop-breakpoint="1024" 
    class="theme-unbreakable-vault" 
    :tabs="navTabs" 
    :active-tab="activeTab" 
    @tab-change="activeTab = $event"
  >
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <view v-if="activeTab === 'create'" class="tab-content scrollable">
      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-3 text-center">
        <text class="font-bold">{{ status.msg }}</text>
      </NeoCard>

      <VaultCreate
        :t="t"
        v-model:bounty="bounty"
        v-model:title="vaultTitle"
        v-model:description="vaultDescription"
        v-model:difficulty="vaultDifficulty"
        v-model:secret="secret"
        v-model:secretConfirm="secretConfirm"
        :secret-hash="secretHash"
        :loading="isLoading"
        :min-bounty="MIN_BOUNTY"
        @create="createVault"
      />

      <NeoCard v-if="createdVaultId" variant="erobo" class="vault-created">
        <text class="vault-created-label">{{ t("vaultCreated") }}</text>
        <text class="vault-created-id">#{{ createdVaultId }}</text>
      </NeoCard>

      <VaultList
        :t="t"
        :title="t('myVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="myVaults"
        @select="selectVault"
      />
    </view>

    <view v-if="activeTab === 'break'" class="tab-content scrollable">
      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-3 text-center">
        <text class="font-bold">{{ status.msg }}</text>
      </NeoCard>

      <NeoCard variant="erobo-neo">
        <view class="form-group">
          <view class="input-group">
            <text class="input-label">{{ t("vaultIdLabel") }}</text>
            <NeoInput v-model="vaultIdInput" type="number" :placeholder="t('vaultIdPlaceholder')" />
          </view>

          <NeoButton variant="secondary" block :loading="isLoading" @click="loadVault">
            {{ t("loadVault") }}
          </NeoButton>

          <view class="input-group">
            <text class="input-label">{{ t("secretAttemptLabel") }}</text>
            <NeoInput v-model="attemptSecret" :placeholder="t('secretAttemptPlaceholder')" />
          </view>

          <text class="helper-text">{{ t("attemptFeeNote").replace("{fee}", attemptFeeDisplay) }}</text>

          <NeoButton
            variant="primary"
            size="lg"
            block
            :loading="isLoading"
            :disabled="!canAttempt || isLoading"
            @click="attemptBreak"
          >
            {{ isLoading ? t("attempting") : t("attemptBreak") }}
          </NeoButton>
        </view>
      </NeoCard>

      <VaultDetails v-if="vaultDetails" :t="t" :details="vaultDetails" />

      <VaultList
        :t="t"
        :title="t('recentVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="recentVaults"
        @select="selectVault"
      />
    </view>

    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { sha256Hex } from "@shared/utils/hash";
import { normalizeScriptHash, parseInvokeResult, parseStackItem, addressToScriptHash } from "@shared/utils/neo";
import { bytesToHex, formatAddress, formatGas, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoDoc, NeoButton, NeoInput, NeoCard, ChainWarning } from "@shared/components";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import VaultCreate from "./components/VaultCreate.vue";
import VaultList from "./components/VaultList.vue";
import VaultDetails from "./components/VaultDetails.vue";

const { t } = useI18n();

const APP_ID = "miniapp-unbreakablevault";
const MIN_BOUNTY = 1;
const ATTEMPT_FEE = 0.1;

const { address, connect, chainType, invokeContract, invokeRead, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();

const activeTab = ref("create");
const navTabs = computed(() => [
  { id: "create", icon: "lock", label: t("create") },
  { id: "break", icon: "key", label: t("break") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

const bounty = ref("");
const vaultTitle = ref("");
const vaultDescription = ref("");
const vaultDifficulty = ref(1);
const secret = ref("");
const secretConfirm = ref("");
const secretHash = ref("");
const createdVaultId = ref<string | null>(null);

const vaultIdInput = ref("");
const attemptSecret = ref("");
const vaultDetails = ref<{
  id: string;
  creator: string;
  bounty: number;
  attempts: number;
  broken: boolean;
  expired: boolean;
  status: string;
  winner: string;
  attemptFee: number;
  difficultyName: string;
  expiryTime: number;
  remainingDays: number;
} | null>(null);

const recentVaults = ref<{ id: string; creator: string; bounty: number }[]>([]);
const myVaults = ref<{ id: string; bounty: number; created: number }[]>([]);

const canAttempt = computed(() => {
  const status = vaultDetails.value?.status;
  return Boolean(
    vaultIdInput.value &&
    attemptSecret.value.trim() &&
    vaultDetails.value &&
    String(vaultDetails.value.id) === String(vaultIdInput.value) &&
    status === "active",
  );
});

const toNumber = (value: unknown) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const attemptFeeDisplay = computed(() => {
  const fallback = toFixed8(ATTEMPT_FEE);
  const fee = vaultDetails.value?.attemptFee ?? fallback;
  return formatGas(fee);
});

const toHex = (value: string) => {
  if (!value) return "";
  if (typeof TextEncoder === "undefined") {
    return Array.from(value)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  }
  return bytesToHex(new TextEncoder().encode(value));
};

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) throw new Error(t("wrongChain"));
  const contract = await getContractAddress();
  if (!contract) throw new Error(t("contractUnavailable"));
  return contract;
};

const loadRecentVaults = async () => {
  try {
    const res = await listEvents({ app_id: APP_ID, event_name: "VaultCreated", limit: 12 });
    const vaults = res.events
      .map((evt: any) => {
        const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
        const id = String(values[0] ?? "");
        const creator = String(values[1] ?? "");
        const bountyValue = Number(values[2] ?? 0);
        if (!id) return null;
        return { id, creator, bounty: bountyValue };
      })
      .filter(Boolean) as { id: string; creator: string; bounty: number }[];
    recentVaults.value = vaults;
  } catch {}
};

const loadMyVaults = async () => {
  if (!address.value) {
    myVaults.value = [];
    return;
  }
  try {
    const res = await listEvents({ app_id: APP_ID, event_name: "VaultCreated", limit: 50 });
    const myHash = normalizeScriptHash(addressToScriptHash(address.value));
    const vaults = res.events
      .map((evt: any) => {
        const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
        const id = String(values[0] ?? "");
        const creator = String(values[1] ?? "");
        const bountyValue = Number(values[2] ?? 0);
        const creatorHash = normalizeScriptHash(addressToScriptHash(creator));
        if (!id || creatorHash !== myHash) return null;
        return {
          id,
          bounty: bountyValue,
          created: evt.created_at ? new Date(evt.created_at).getTime() : Date.now(),
        };
      })
      .filter(Boolean) as { id: string; bounty: number; created: number }[];
    myVaults.value = vaults.sort((a, b) => b.created - a.created);
  } catch {}
};

const createVault = async () => {
  if (isLoading.value) return;
  status.value = null;
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
      contract,
    );
    const vaultId = String((res as any)?.result || (res as any)?.stack?.[0]?.value || "");
    createdVaultId.value = vaultId || createdVaultId.value;
    status.value = { msg: t("vaultCreated"), type: "success" };
    bounty.value = "";
    vaultTitle.value = "";
    vaultDescription.value = "";
    vaultDifficulty.value = 1;
    secret.value = "";
    secretConfirm.value = "";
    await loadRecentVaults();
    await loadMyVaults();
  } catch (e: any) {
    status.value = { msg: e?.message || t("vaultCreateFailed"), type: "error" };
  }
};

const loadVault = async () => {
  if (!vaultIdInput.value) return;
  status.value = null;
  try {
    const contract = await ensureContractAddress();
    const res = await invokeRead({
      contractAddress: contract,
      operation: "GetVaultDetails",
      args: [{ type: "Integer", value: vaultIdInput.value }],
    });
    const parsed = parseInvokeResult(res);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("vaultNotFound"));
    const data = parsed as Record<string, unknown>;
    const creator = String(data.creator || "");
    const creatorHash = normalizeScriptHash(creator);
    if (!creatorHash || /^0+$/.test(creatorHash)) throw new Error(t("vaultNotFound"));
    const status = String(data.status || "");
    const expired = Boolean(data.expired);
    const broken = Boolean(data.broken);
    vaultDetails.value = {
      id: vaultIdInput.value,
      creator,
      bounty: toNumber(data.bounty),
      attempts: toNumber(data.attemptCount),
      broken,
      expired,
      status: status || (broken ? "broken" : expired ? "expired" : "active"),
      winner: String(data.winner || ""),
      attemptFee: toNumber(data.attemptFee),
      difficultyName: String(data.difficultyName || ""),
      expiryTime: toNumber(data.expiryTime),
      remainingDays: toNumber(data.remainingDays),
    };
  } catch (e: any) {
    status.value = { msg: e?.message || t("loadFailed"), type: "error" };
    vaultDetails.value = null;
  }
};

const attemptBreak = async () => {
  if (!canAttempt.value || isLoading.value) return;
  status.value = null;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();
    const feeBase = vaultDetails.value?.attemptFee ?? toFixed8(ATTEMPT_FEE);
    const { receiptId, invoke } = await processPayment(formatGas(feeBase), `vault:attempt:${vaultIdInput.value}`);
    if (!receiptId) throw new Error(t("receiptMissing"));
    const res = await invoke(
      "attemptBreak",
      [
        { type: "Integer", value: vaultIdInput.value },
        { type: "Hash160", value: address.value as string },
        { type: "ByteArray", value: toHex(attemptSecret.value) },
        { type: "Integer", value: String(receiptId) },
      ],
      contract,
    );
    const success = Boolean((res as any)?.stack?.[0]?.value ?? (res as any)?.result);
    status.value = {
      msg: success ? t("broken") : t("vaultAttemptFailed"),
      type: success ? "success" : "error",
    };
    attemptSecret.value = "";
    await loadVault();
    await loadRecentVaults();
  } catch (e: any) {
    status.value = { msg: e?.message || t("vaultAttemptFailed"), type: "error" };
  }
};

const selectVault = (id: string) => {
  vaultIdInput.value = id;
  loadVault();
};

watch(secret, async (value) => {
  secretHash.value = value ? await sha256Hex(value) : "";
});

onMounted(() => {
  loadRecentVaults();
  loadMyVaults();
});

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./unbreakable-vault-theme.scss";

:global(page) {
  background: var(--bg-primary);
  font-family: var(--vault-font);
}

.tab-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

:deep(.neo-card) {
  background: var(--vault-bg) !important;
  border-radius: 20px !important;
  box-shadow:
    9px 9px 16px var(--vault-shadow-dark),
    -9px -9px 16px var(--vault-shadow-light) !important;
  color: var(--vault-text) !important;
  border: none !important;
  padding: 24px !important;

  &.variant-danger {
    background: var(--vault-danger-bg) !important;
    box-shadow:
      5px 5px 10px var(--vault-danger-shadow-dark),
      -5px -5px 10px var(--vault-danger-shadow-light) !important;
    color: var(--vault-danger-text) !important;
  }
}

:deep(.neo-card.variant-danger .text-white) {
  color: var(--vault-danger-text) !important;
}

:deep(.neo-button) {
  border-radius: 50px !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em;
  color: var(--vault-text) !important;
  transition: all 0.2s ease;

  &.variant-primary {
    background: var(--vault-button-bg);
    box-shadow:
      5px 5px 10px var(--vault-shadow-dark),
      -5px -5px 10px var(--vault-shadow-light) !important;
    border: none !important;
    color: var(--vault-button-text) !important;

    &:active {
      box-shadow:
        inset 5px 5px 10px var(--vault-shadow-dark),
        inset -5px -5px 10px var(--vault-shadow-light) !important;
    }
  }

  &.variant-secondary {
    background: var(--vault-bg) !important;
    box-shadow:
      5px 5px 10px var(--vault-shadow-dark),
      -5px -5px 10px var(--vault-shadow-light) !important;
    border: none !important;

    &:active {
      box-shadow:
        inset 5px 5px 10px var(--vault-shadow-dark),
        inset -5px -5px 10px var(--vault-shadow-light) !important;
    }
  }
}

:deep(input),
:deep(.neo-input) {
  background: var(--vault-bg) !important;
  border-radius: 12px !important;
  box-shadow:
    inset 5px 5px 10px var(--vault-shadow-dark),
    inset -5px -5px 10px var(--vault-shadow-light) !important;
  border: none !important;
  color: var(--vault-text-strong) !important;
  padding: 12px 16px !important;

  &:focus {
    box-shadow:
      inset 2px 2px 5px var(--vault-shadow-dark),
      inset -2px -2px 5px var(--vault-shadow-light) !important;
    color: var(--vault-text-strong) !important;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
