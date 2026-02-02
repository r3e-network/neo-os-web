<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-graveyard" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <!-- Destroy Tab -->
    <view v-if="activeTab === 'destroy'" class="tab-content">
      <StatusMessage :status="status" />

      <DestructionChamber
        v-model:assetHash="assetHash"
        v-model:memoryType="memoryType"
        :memory-type-options="memoryTypeOptions"
        :is-destroying="isDestroying"
        :show-warning-shake="showWarningShake"
        :t="t"
        @initiate="initiateDestroy"
      />

      <ConfirmDestroyModal
        :show="showConfirm"
        :asset-hash="assetHash"
        :t="t"
        @cancel="showConfirm = false"
        @confirm="executeDestroy"
      />
    </view>

    <!-- Stats Tab -->
    <view v-if="activeTab === 'stats'" class="tab-content">
      <GraveyardHero :total-destroyed="totalDestroyed" :gas-reclaimed="gasReclaimed" :t="t" />
    </view>

    <!-- History Tab -->
    <HistoryTab
      v-if="activeTab === 'history'"
      :history="history"
      :forgetting-id="forgettingId"
      :t="t"
      @forget="forgetMemory"
    />

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
    <Fireworks :active="status?.type === 'success'" :duration="3000" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import GraveyardHero from "./components/GraveyardHero.vue";
import DestructionChamber from "./components/DestructionChamber.vue";
import ConfirmDestroyModal from "./components/ConfirmDestroyModal.vue";
import HistoryTab from "./components/HistoryTab.vue";
import StatusMessage from "./components/StatusMessage.vue";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

const { t } = useI18n();

const navTabs = computed(() => [
  { id: "destroy", icon: "trash", label: t("destroy") },
  { id: "stats", icon: "chart", label: t("tabStats") },
  { id: "history", icon: "time", label: t("history") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("destroy");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const APP_ID = "miniapp-graveyard";
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, isLoading } = usePaymentFlow(APP_ID);
const { list: listEvents } = useEvents();

interface HistoryItem {
  id: string;
  hash: string;
  time: string;
  forgotten?: boolean;
}

const totalDestroyed = ref(0);
const gasReclaimed = ref(0);
const assetHash = ref("");
const memoryType = ref(1);
const status = ref<{ msg: string; type: string } | null>(null);
const history = ref<HistoryItem[]>([]);
const showConfirm = ref(false);
const isDestroying = ref(false);
const showWarningShake = ref(false);
const contractAddress = ref<string | null>(null);
const forgettingId = ref<string | null>(null);
const memoryTypeOptions = computed(() => [
  { value: 1, label: t("memoryTypeSecret") },
  { value: 2, label: t("memoryTypeRegret") },
  { value: 3, label: t("memoryTypeWish") },
  { value: 4, label: t("memoryTypeConfession") },
  { value: 5, label: t("memoryTypeOther") },
]);

const waitForEvent = async (txid: string, eventName: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
    const match = res.events.find((evt) => evt.tx_hash === txid);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
};

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

const initiateDestroy = () => {
  if (!assetHash.value) {
    status.value = { msg: t("enterAssetHash"), type: "error" };
    showWarningShake.value = true;
    setTimeout(() => (showWarningShake.value = false), 500);
    return;
  }
  showConfirm.value = true;
};

const executeDestroy = async () => {
  showConfirm.value = false;
  if (isLoading.value || isDestroying.value) return;
  isDestroying.value = true;

  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();

    const { receiptId, invoke } = await processPayment("0.1", `graveyard:bury:${assetHash.value.slice(0, 10)}`);
    if (!receiptId) throw new Error(t("receiptMissing"));

    const tx = await invoke(
      "BuryMemory",
      [
        { type: "Hash160", value: address.value as string },
        { type: "String", value: assetHash.value },
        { type: "Integer", value: String(memoryType.value) },
        { type: "Integer", value: String(receiptId) },
      ],
      contract,
    );

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
    );
    const evt = txid ? await waitForEvent(txid, "MemoryBuried") : null;
    if (!evt) throw new Error(t("buryPending"));

    const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
    const memoryId = String(values[0] ?? "");
    const contentHash = String(values[2] ?? assetHash.value);
    history.value.unshift({
      id: memoryId || String(Date.now()),
      hash: contentHash,
      time: new Date(evt.created_at || Date.now()).toLocaleString(),
      forgotten: false,
    });

    totalDestroyed.value += 1;
    gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
    status.value = { msg: t("memoryBuried"), type: "success" };
    assetHash.value = "";
  } catch (e: any) {
    status.value = { msg: e?.message || t("error"), type: "error" };
  } finally {
    isDestroying.value = false;
  }
};

const loadStats = async () => {
  if (!contractAddress.value) {
    contractAddress.value = (await ensureContractAddress()) as string;
  }
  if (!contractAddress.value) return;
  try {
    const statsRes = await invokeRead({ contractAddress: contractAddress.value, operation: "getPlatformStats" });
    const parsed = parseInvokeResult(statsRes);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const stats = parsed as Record<string, unknown>;
      const total = Number(stats.totalBuried ?? stats.totalMemories ?? 0);
      const fee = Number(stats.buryFee ?? 0);
      totalDestroyed.value = Number.isFinite(total) ? total : 0;
      if (Number.isFinite(fee) && fee > 0) {
        gasReclaimed.value = Number(((totalDestroyed.value * fee) / 1e8).toFixed(2));
      } else {
        gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
      }
      return;
    }
    const totalRes = await invokeRead({ contractAddress: contractAddress.value, operation: "totalMemories" });
    totalDestroyed.value = Number(parseInvokeResult(totalRes) || 0);
    gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
  } catch {}
};

const loadHistory = async () => {
  try {
    const contract = await ensureContractAddress();
    const res = await listEvents({ app_id: APP_ID, event_name: "MemoryBuried", limit: 20 });
    const entries = await Promise.all(
      res.events.map(async (evt) => {
        const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
        const memoryId = String(values[0] ?? evt.id);
        let contentHash = String(values[2] ?? "");
        let forgotten = false;
        if (memoryId) {
          try {
            const detailRes = await invokeRead({
              contractAddress: contract,
              operation: "getMemoryDetails",
              args: [{ type: "Integer", value: memoryId }],
            });
            const parsed = parseInvokeResult(detailRes);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const detail = parsed as Record<string, unknown>;
              forgotten = Boolean(detail.forgotten);
              if (!forgotten && detail.contentHash) {
                contentHash = String(detail.contentHash);
              }
            }
          } catch {}
        }
        return {
          id: memoryId,
          hash: contentHash,
          time: new Date(evt.created_at || Date.now()).toLocaleString(),
          forgotten,
        };
      }),
    );
    history.value = entries;
  } catch {}
};

const forgetMemory = async (item: HistoryItem) => {
  if (!item.id || item.forgotten) return;
  if (isLoading.value || forgettingId.value) return;

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: t("forgetConfirmTitle"),
      content: t("forgetConfirmText"),
      confirmText: t("forgetAction"),
      cancelText: t("cancel"),
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    });
  });

  if (!confirmed) return;

  forgettingId.value = item.id;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    const contract = await ensureContractAddress();

    const { receiptId, invoke } = await processPayment("1", `graveyard:forget:${item.id}`);
    if (!receiptId) throw new Error(t("receiptMissing"));

    await invoke(
      "ForgetMemory",
      [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(item.id) },
        { type: "Integer", value: String(receiptId) },
      ],
      contract,
    );

    history.value = history.value.map((entry) => (entry.id === item.id ? { ...entry, forgotten: true } : entry));
    status.value = { msg: t("forgetSuccess"), type: "success" };
  } catch (e: any) {
    status.value = { msg: e?.message || t("error"), type: "error" };
  } finally {
    forgettingId.value = null;
  }
};

onMounted(async () => {
  await loadStats();
  await loadHistory();
});

watch(activeTab, async (tab) => {
  if (tab === "history") {
    await loadHistory();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./graveyard-theme.scss";

:global(page) {
  background: var(--grave-bg);
  font-family: var(--grave-font);
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--grave-bg);
  min-height: 100vh;
  position: relative;

  /* Matrix/Grid background */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--grave-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grave-grid) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    z-index: 0;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Digital Afterlife Component Overrides */
:deep(.neo-card) {
  background: var(--grave-card-bg) !important;
  border: 1px solid var(--grave-card-border) !important;
  border-left: 4px solid var(--grave-card-accent-border) !important;
  border-radius: 0 !important;
  box-shadow: var(--grave-card-shadow) !important;
  color: var(--grave-text) !important;
  font-family: var(--grave-font) !important;
  position: relative;
  z-index: 1;

  &.variant-danger {
    background: var(--grave-card-danger-bg) !important;
    border-color: var(--grave-danger) !important;
    color: var(--grave-danger) !important;
    text-shadow: 0 0 5px var(--grave-danger-glow);
  }
}

:deep(.neo-button) {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: var(--grave-font) !important;
  font-weight: 700 !important;
  border-radius: 0 !important;
  transition: all 0.1s steps(2);

  &.variant-primary {
    background: var(--grave-accent) !important;
    color: var(--grave-bg) !important;
    border: none !important;
    box-shadow: var(--grave-button-shadow) !important;

    &:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--grave-card-shadow) !important;
    }

    &:active {
      transform: translate(0, 0);
      box-shadow: 0 0 0 !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--grave-accent) !important;
    color: var(--grave-accent) !important;

    &:hover {
      background: var(--grave-accent-soft) !important;
    }
  }

  &.variant-danger {
    background: var(--grave-danger) !important;
    color: var(--grave-bg) !important;
    box-shadow: var(--grave-button-danger-shadow) !important;
  }
}

:deep(input),
:deep(.neo-input) {
  background: var(--grave-bg) !important;
  border: 1px solid var(--grave-input-border) !important;
  color: var(--grave-accent) !important;
  font-family: var(--grave-font) !important;
  border-radius: 0 !important;
  caret-color: var(--grave-accent);

  &:focus {
    border-color: var(--grave-accent) !important;
    box-shadow: 0 0 10px var(--grave-accent-glow) !important;
  }
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
