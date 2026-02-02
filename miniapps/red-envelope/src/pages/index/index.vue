<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-red-envelope" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <view v-if="activeTab === 'create' || activeTab === 'claim'" class="app-container">
      <LuckyOverlay :lucky-message="luckyMessage" :t="t" @close="luckyMessage = null" />
      <Fireworks :active="!!luckyMessage" :duration="3000" />
      <OpeningModal
        :visible="showOpeningModal"
        :envelope="openingEnvelope"
        :is-connected="!!address"
        :is-opening="!!openingId"
        @connect="handleConnect"
        @open="() => openingEnvelope && claim(openingEnvelope, true)"
        @close="showOpeningModal = false"
      />

      <AppStatus :status="status" />

      <view v-if="activeTab === 'create'" class="tab-content">
        <CreateForm
          :is-loading="isLoading"
          :t="t"
          v-model:name="name"
          v-model:description="description"
          v-model:amount="amount"
          v-model:count="count"
          v-model:expiryHours="expiryHours"
          @create="create"
        />
      </view>

      <view v-if="activeTab === 'claim'" class="tab-content">
        <ClaimInterface
          :envelopes="envelopes"
          :t="t"
          @select="openFromList"
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
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { pollForEvent } from "@shared/utils/errorHandling";
import { ResponsiveLayout, NeoDoc, Fireworks, ChainWarning } from "@shared/components";

import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeClaim } from "@/composables/useRedEnvelopeClaim";
import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";
import AppStatus from "./components/AppStatus.vue";
import CreateForm from "./components/CreateForm.vue";
import ClaimInterface from "./components/ClaimInterface.vue";

const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();

const APP_ID = "miniapp-redenvelope";

const activeTab = ref<string>("create");
const navTabs = computed(() => [
  { id: "create", label: t("createTab"), icon: "envelope" },
  { id: "claim", label: t("claimTab"), icon: "gift" },
  { id: "docs", label: t("docs"), icon: "book" },
]);

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

// Use composables
const {
  name,
  description,
  amount,
  count,
  expiryHours,
  status,
  isLoading,
  defaultBlessing,
  ensureContractAddress: ensureCreationContract,
  processPayment,
} = useRedEnvelopeCreation();

const {
  envelopes,
  loadingEnvelopes,
  contractAddress,
  ensureContractAddress: ensureClaimContract,
  fetchEnvelopeDetails,
  loadEnvelopes,
} = useRedEnvelopeClaim();

const luckyMessage = ref<{ amount: number; from: string } | null>(null);
const openingId = ref<string | null>(null);
const showOpeningModal = ref(false);
const openingEnvelope = ref<any>(null);

const handleConnect = async () => {
  try {
    await connect();
  } catch {}
};

const create = async () => {
  if (isLoading.value) return;
  try {
    status.value = null;
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("connectWallet"));
    }
    const contract = await ensureCreationContract();

    const totalValue = Number(amount.value);
    const packetCount = Number(count.value);
    if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
    if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100) throw new Error(t("invalidPackets"));
    if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));

    const expiryValue = Number(expiryHours.value);
    if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));
    const expirySeconds = Math.round(expiryValue * 3600);

    const { receiptId, invoke, waitForEvent } = await processPayment(amount.value, `redenvelope:${count.value}`);
    if (!receiptId) {
      throw new Error(t("receiptMissing"));
    }

    const finalDescription = description.value.trim() || defaultBlessing.value;

    const tx = await invoke(contract, "createEnvelope", [
      { type: "Hash160", value: address.value },
      { type: "String", value: name.value || "" },
      { type: "String", value: finalDescription },
      { type: "Integer", value: toFixed8(amount.value) },
      { type: "Integer", value: String(packetCount) },
      { type: "Integer", value: String(expirySeconds) },
      { type: "Integer", value: receiptId },
    ]);

    const txid = (tx as { txid?: string })?.txid || "";
    const createdEvt = txid ? await waitForEvent(txid, "EnvelopeCreated") : null;
    if (!createdEvt) {
      throw new Error(t("envelopePending"));
    }

    status.value = { msg: t("envelopeSent"), type: "success" };
    name.value = "";
    description.value = "";
    amount.value = "";
    count.value = "";
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
  }
};

const claim = async (env: any, fromModal = false) => {
  if (openingId.value) return;

  if (!address.value) {
    await connect();
    if (!address.value) return;
  }

  try {
    status.value = null;
    const contract = await ensureClaimContract();

    if (env.expired) throw new Error(t("envelopeExpired"));
    if (!env.ready) throw new Error(t("envelopeNotReady"));
    if (env.remaining <= 0) throw new Error(t("envelopeEmpty"));

    const hasClaimedRes = await invokeRead({
      scriptHash: contract,
      operation: "HasClaimed",
      args: [
        { type: "Integer", value: env.id },
        { type: "Hash160", value: address.value },
      ],
    });
    if (Boolean(parseInvokeResult(hasClaimedRes))) {
      throw new Error(t("alreadyClaimed"));
    }

    openingId.value = env.id;
    const tx = await invokeContract({
      scriptHash: contract,
      operation: "Claim",
      args: [
        { type: "Integer", value: env.id },
        { type: "Hash160", value: address.value },
      ],
    });

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
    );
    const claimedEvt = txid
      ? await pollForEvent(
          async () => {
            const result = await listEvents({ app_id: APP_ID, event_name: "EnvelopeClaimed", limit: 25 });
            return result.events || [];
          },
          (evt: any) => evt.tx_hash === txid,
          { timeoutMs: 30000, errorMessage: t("claimPending") },
        )
      : null;

    if (!claimedEvt) {
      throw new Error(t("claimPending"));
    }
    const values = Array.isArray((claimedEvt as any)?.state) ? (claimedEvt as any).state.map(parseStackItem) : [];
    const claimedAmount = fromFixed8(Number(values[2] ?? 0));
    const remaining = Number(values[3] ?? env.remaining);

    showOpeningModal.value = false;

    luckyMessage.value = {
      amount: Number(claimedAmount.toFixed(2)),
      from: env.from,
    };

    env.remaining = Math.max(0, remaining);
    env.canClaim = env.remaining > 0 && env.ready && !env.expired;

    status.value = { msg: t("claimedFrom").replace("{0}", env.from), type: "success" };

    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
    showOpeningModal.value = false;
  } finally {
    openingId.value = null;
  }
};

const openFromList = (env: any) => {
  openingEnvelope.value = env;
  showOpeningModal.value = true;
};

onMounted(async () => {
  await loadEnvelopes();

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      const found = envelopes.value.find((e) => e.id === id);
      if (found) {
        openFromList(found);
        activeTab.value = "claim";
      } else {
        const contract = await ensureClaimContract();
        const env = await fetchEnvelopeDetails(contract, id);
        if (env) {
          openingEnvelope.value = env;
          showOpeningModal.value = true;
          activeTab.value = "claim";
        }
      }
    }
  }
});

watch(activeTab, async (tab) => {
  if (tab === "claim") {
    await loadEnvelopes();
  }
});

// Helper function
function parseInvokeResult(result: unknown): unknown {
  if (!result) return null;
  if (typeof result === "object" && result !== null) {
    if ("value" in result) {
      return (result as { value: unknown }).value;
    }
  }
  return result;
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./red-envelope-theme.scss";

.app-container {
  padding: 80px 20px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: radial-gradient(circle at 50% 30%, var(--red-envelope-accent) 0%, var(--red-envelope-base) 100%);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 150%;
    height: 50%;
    background: radial-gradient(circle, var(--red-envelope-glow) 0%, transparent 70%);
    opacity: 0.6;
    z-index: 0;
    filter: blur(40px);
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      radial-gradient(var(--red-envelope-gold) 1px, transparent 1px),
      radial-gradient(var(--red-envelope-gold) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position:
      0 0,
      20px 20px;
    opacity: var(--red-envelope-pattern-opacity);
    pointer-events: none;
    z-index: 0;
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
