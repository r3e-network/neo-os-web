<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-breakup-contract" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <view v-if="activeTab === 'create' || activeTab === 'contracts'" class="app-container">
      <!-- Chain Warning - Framework Component -->
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
        <text class="font-bold status-msg">{{ status.msg }}</text>
      </NeoCard>

      <!-- Create Contract Tab -->
      <view v-if="activeTab === 'create'" class="tab-content">
        <CreateContractForm
          v-model:partnerAddress="partnerAddress"
          v-model:stakeAmount="stakeAmount"
          v-model:duration="duration"
          v-model:title="contractTitle"
          v-model:terms="contractTerms"
          :address="address"
          :is-loading="isLoading"
          :t="t as any"
          @create="createContract"
        />
      </view>

      <!-- Active Contracts Tab -->
      <view v-if="activeTab === 'contracts'" class="tab-content">
        <ContractList
          :contracts="contracts"
          :address="address"
          :t="t as any"
          @sign="signContract"
          @break="breakContract"
        />
      </view>
    </view>

    <!-- Docs Tab -->
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
import { ref, computed, onMounted } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, NeoCard, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import CreateContractForm from "./components/CreateContractForm.vue";
import ContractList from "./components/ContractList.vue";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

const { t } = useI18n();

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const APP_ID = "miniapp-breakupcontract";
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const contractAddress = ref<string | null>(null);

const activeTab = ref<string>("create");
const navTabs = computed<NavTab[]>(() => [
  { id: "create", label: t("tabCreate"), icon: "💔" },
  { id: "contracts", label: t("tabContracts"), icon: "📋" },
  { id: "docs", icon: "book", label: t("docs") },
]);

const partnerAddress = ref("");
const stakeAmount = ref("");
const duration = ref("");
const contractTitle = ref("");
const contractTerms = ref("");
const status = ref<{ msg: string; type: string } | null>(null);

type ContractStatus = "pending" | "active" | "broken" | "ended";
interface RelationshipContractView {
  id: number;
  party1: string;
  party2: string;
  partner: string;
  title: string;
  terms: string;
  stake: number;
  stakeRaw: string;
  progress: number;
  daysLeft: number;
  status: ContractStatus;
}

const contracts = ref<RelationshipContractView[]>([]);

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) {
    throw new Error(t("contractUnavailable"));
  }
  return contractAddress.value;
};

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

const listAllEvents = async (eventName: string) => {
  const events: any[] = [];
  let afterId: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 50, after_id: afterId });
    events.push(...res.events);
    hasMore = Boolean(res.has_more && res.last_id);
    afterId = res.last_id || undefined;
  }
  return events;
};

const parseContract = (id: number, data: any): RelationshipContractView | null => {
  if (!data || typeof data !== "object") return null;
  const details = Array.isArray(data)
    ? {
        party1: data[0],
        party2: data[1],
        stake: data[2],
        party1Signed: data[3],
        party2Signed: data[4],
        createdTime: data[5],
        startTime: data[6],
        duration: data[7],
        signDeadline: data[8],
        active: data[9],
        completed: data[10],
        cancelled: data[11],
        title: data[12],
        terms: data[13],
        milestonesReached: data[14],
        totalPenaltyPaid: data[15],
        breakupInitiator: data[16],
      }
    : (data as Record<string, any>);

  const party1 = String(details.party1 ?? "");
  const party2 = String(details.party2 ?? "");
  const stakeRaw = String(details.stake ?? "0");
  const party2Signed = Boolean(details.party2Signed);
  const startTimeSeconds = Number(details.startTime ?? 0);
  const durationSeconds = Number(details.duration ?? 0);
  const active = Boolean(details.active);
  const completed = Boolean(details.completed);
  const cancelled = Boolean(details.cancelled);
  const title = String(details.title ?? "");
  const terms = String(details.terms ?? "");

  const startTimeMs = startTimeSeconds * 1000;
  const durationMs = durationSeconds * 1000;
  const now = Date.now();
  const endTime = startTimeMs + durationMs;
  const elapsed = startTimeMs > 0 ? Math.max(0, Math.min(durationMs, now - startTimeMs)) : 0;
  const computedProgress = durationMs > 0 ? Math.round((elapsed / durationMs) * 100) : 0;
  const progressPercent = Number(details.progressPercent ?? 0);
  const progress = progressPercent > 0 ? Math.min(100, Math.max(0, Math.floor(progressPercent))) : computedProgress;
  const remainingSeconds = Number(details.remainingTime ?? 0);
  const daysLeft =
    remainingSeconds > 0
      ? Math.max(0, Math.ceil(remainingSeconds / 86400))
      : durationMs > 0
        ? Math.max(0, Math.ceil((endTime - now) / 86400000))
        : 0;

  let status: ContractStatus = "pending";
  if (active) status = "active";
  else if (completed) status = "broken";
  else if (party2Signed || cancelled) status = "ended";

  const partner = address.value && address.value === party1 ? party2 : party1;

  return {
    id,
    party1,
    party2,
    partner,
    title,
    terms,
    stake: parseGas(stakeRaw),
    stakeRaw,
    progress,
    daysLeft,
    status,
  };
};

const loadContracts = async () => {
  try {
    await ensureContractAddress();
    const createdEvents = await listAllEvents("ContractCreated");
    const ids = new Set<number>();
    createdEvents.forEach((evt) => {
      const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
      const id = Number(values[0] ?? 0);
      if (id > 0) ids.add(id);
    });

    const contractViews: RelationshipContractView[] = [];
    for (const id of Array.from(ids).sort((a, b) => b - a)) {
      const res = await invokeRead({
        contractAddress: contractAddress.value!,
        operation: "GetContractDetails",
        args: [{ type: "Integer", value: id }],
      });
      const parsed = parseContract(id, parseInvokeResult(res));
      if (parsed) contractViews.push(parsed);
    }
    contracts.value = contractViews;
  } catch (e) {
    status.value = { msg: t("loadFailed"), type: "error" };
  }
};

const createContract = async () => {
  if (isLoading.value) return;
  const partnerValue = partnerAddress.value.trim();
  if (!partnerValue) {
    status.value = { msg: t("partnerRequired"), type: "error" };
    return;
  }
  if (!isValidNeoAddress(partnerValue)) {
    status.value = { msg: t("partnerInvalid"), type: "error" };
    return;
  }
  if (!stakeAmount.value) {
    status.value = { msg: t("error"), type: "error" };
    return;
  }
  const stake = parseFloat(stakeAmount.value);
  const durationDays = parseInt(duration.value, 10);
  const titleValue = contractTitle.value.trim();
  const termsValue = contractTerms.value.trim();
  if (!Number.isFinite(stake) || stake < 1 || !Number.isFinite(durationDays) || durationDays < 30) {
    status.value = { msg: t("error"), type: "error" };
    return;
  }
  if (!titleValue) {
    status.value = { msg: t("titleRequired"), type: "error" };
    return;
  }
  if (titleValue.length > 100) {
    status.value = { msg: t("titleTooLong"), type: "error" };
    return;
  }
  if (termsValue.length > 2000) {
    status.value = { msg: t("termsTooLong"), type: "error" };
    return;
  }
  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("error"));
    }
    await ensureContractAddress();
    const { receiptId, invoke } = await processPayment(stakeAmount.value, `contract:${partnerValue.slice(0, 10)}`);
    if (!receiptId) {
      throw new Error(t("receiptMissing"));
    }
    await invoke(
      "createContract",
      [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: partnerValue },
        { type: "Integer", value: toFixed8(stakeAmount.value) },
        { type: "Integer", value: durationDays },
        { type: "String", value: titleValue },
        { type: "String", value: termsValue },
        { type: "Integer", value: receiptId },
      ],
      contractAddress.value!,
    );
    status.value = { msg: t("contractCreated"), type: "success" };
    partnerAddress.value = "";
    stakeAmount.value = "";
    duration.value = "";
    contractTitle.value = "";
    contractTerms.value = "";
    await loadContracts();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

const signContract = async (contract: RelationshipContractView) => {
  if (isLoading.value || !address.value) return;
  try {
    await ensureContractAddress();
    const { receiptId, invoke } = await processPayment(contract.stake.toFixed(8), `contract:sign:${contract.id}`);
    if (!receiptId) {
      throw new Error(t("receiptMissing"));
    }
    await invoke(
      "signContract",
      [
        { type: "Integer", value: contract.id },
        { type: "Hash160", value: address.value },
        { type: "Integer", value: receiptId },
      ],
      contractAddress.value!,
    );
    status.value = { msg: t("contractSigned"), type: "success" };
    await loadContracts();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

const breakContract = async (contract: RelationshipContractView) => {
  if (!address.value) {
    status.value = { msg: t("error"), type: "error" };
    return;
  }
  try {
    await ensureContractAddress();
    await invokeContract({
      contractAddress: contractAddress.value!,
      operation: "TriggerBreakup",
      args: [
        { type: "Integer", value: contract.id },
        { type: "Hash160", value: address.value },
      ],
    });
    status.value = { msg: t("contractBroken"), type: "error" };
    await loadContracts();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

onMounted(() => {
  loadContracts();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./breakup-contract-theme.scss";

:global(page) {
  background: var(--heartbreak-bg);
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: radial-gradient(circle at 20% 20%, var(--heartbreak-radial) 0%, var(--heartbreak-bg) 100%);
  min-height: 100vh;
  position: relative;

  /* Broken glass shards overlay (simulated with gradients) */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background-image:
      linear-gradient(45deg, transparent 48%, var(--heartbreak-shard) 49%, transparent 51%),
      linear-gradient(-45deg, transparent 40%, var(--heartbreak-shard) 41%, transparent 42%);
    background-size: 200px 200px;
    pointer-events: none;
  }
}

.status-msg {
  color: var(--heartbreak-status-text);
  text-transform: uppercase;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-shadow: var(--heartbreak-status-shadow);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 10;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Neon Heartbreak Component Overrides */
:deep(.neo-card) {
  background: var(--heartbreak-card-bg) !important;
  border: 1px solid var(--heartbreak-card-border) !important;
  border-left: 4px solid var(--heartbreak-accent) !important;
  box-shadow: var(--heartbreak-card-shadow) !important;
  border-radius: 2px !important; /* Sharp edges */
  color: var(--heartbreak-text) !important;
  backdrop-filter: blur(10px);

  &.variant-danger {
    background: var(--heartbreak-card-danger-bg) !important;
    border-color: var(--heartbreak-card-danger-border) !important;
  }
}

:deep(.neo-button) {
  border-radius: 0 !important;
  text-transform: uppercase;
  font-weight: 800 !important;
  letter-spacing: 0.1em;
  border: 1px solid var(--heartbreak-accent) !important;

  &.variant-primary {
    background: linear-gradient(135deg, var(--heartbreak-accent) 0%, var(--heartbreak-accent-dark) 100%) !important;
    color: var(--heartbreak-status-text) !important;
    box-shadow: var(--heartbreak-button-shadow) !important;

    &:active {
      transform: translate(2px, 2px);
      box-shadow: var(--heartbreak-button-shadow-press) !important;
    }
  }
}

:deep(.neo-input) {
  background: var(--heartbreak-input-bg) !important;
  border-bottom: 2px solid var(--heartbreak-accent) !important;
  border-radius: 0 !important;
  color: var(--heartbreak-status-text) !important;
}


// Desktop sidebar
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
