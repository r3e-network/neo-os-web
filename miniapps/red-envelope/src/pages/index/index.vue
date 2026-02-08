<template>
  <view class="theme-red-envelope">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="!!luckyMessage"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <!-- Create Tab (default) -->
      <template #content>
        <view class="app-container">
          <LuckyOverlay :lucky-message="luckyMessage" :t="t" @close="luckyMessage = null" />
          <OpeningModal
            :visible="showOpeningModal"
            :envelope="openingEnvelope"
            :is-connected="!!address"
            :is-opening="!!openingId"
            :eligibility="address ? { isEligible, neoBalance, holdingDays, reason: eligibilityReason } : null"
            @connect="handleConnect"
            @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
            @close="showOpeningModal = false"
          />

          <AppStatus :status="status" />

          <CreateForm
            :is-loading="isLoading"
            :t="t"
            v-model:name="name"
            v-model:description="description"
            v-model:amount="amount"
            v-model:count="count"
            v-model:expiryHours="expiryHours"
            v-model:minNeoRequired="minNeoRequired"
            v-model:minHoldDays="minHoldDays"
            v-model:envelopeType="envelopeType"
            @create="create"
          />
        </view>
      </template>

      <!-- Claim Tab -->
      <template #tab-claim>
        <view class="app-container">
          <AppStatus :status="status" />
          <ClaimPool :pools="pools" :t="t" @claim="handleClaimFromPool" />
        </view>
      </template>

      <!-- My Envelopes Tab -->
      <template #tab-myEnvelopes>
        <view class="app-container">
          <LuckyOverlay :lucky-message="luckyMessage" :t="t" @close="luckyMessage = null" />
          <OpeningModal
            :visible="showOpeningModal"
            :envelope="openingEnvelope"
            :claim="openingClaim"
            :is-connected="!!address"
            :is-opening="!!openingId"
            :eligibility="openingClaim ? null : address ? { isEligible, neoBalance, holdingDays, reason: eligibilityReason } : null"
            @connect="handleConnect"
            @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
            @open-claim="handleOpenClaim"
            @close="showOpeningModal = false"
          />
          <TransferModal
            :visible="showTransferModal"
            :envelope="transferringEnvelope"
            @transfer="handleTransfer"
            @close="showTransferModal = false"
          />

          <MyEnvelopes
            :envelopes="envelopes"
            :claims="claims"
            :current-address="address || ''"
            :t="t"
            @open="openFromList"
            @transfer="startTransfer"
            @reclaim="reclaimEnvelope"
            @open-claim="openClaimFromList"
            @transfer-claim="startTransferClaim"
            @reclaim-pool="handleReclaimPool"
          />
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { pollForEvent } from "@shared/utils/errorHandling";
import { MiniAppTemplate } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";

import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "@/composables/useRedEnvelopeOpen";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";
import { useNeoEligibility } from "@/composables/useNeoEligibility";
import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";
import AppStatus from "./components/AppStatus.vue";
import CreateForm from "./components/CreateForm.vue";
import MyEnvelopes from "./components/MyEnvelopes.vue";
import TransferModal from "./components/TransferModal.vue";
import ClaimPool from "./components/ClaimPool.vue";

const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();

const APP_ID = "miniapp-redenvelope";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const activeTab = ref<string>("create");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "form-panel",
  tabs: [
    { key: "create", labelKey: "createTab", icon: "🧧", default: true },
    { key: "claim", labelKey: "claimTabLabel", icon: "🎯" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "🎁" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
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

const appState = computed(() => ({
  envelopeCount: envelopes.value.length,
  hasLucky: !!luckyMessage.value,
}));

// Use composables
const {
  name,
  description,
  amount,
  count,
  expiryHours,
  minNeoRequired,
  minHoldDays,
  status,
  isLoading,
  defaultBlessing,
  ensureContractAddress: ensureCreationContract,
} = useRedEnvelopeCreation();

const {
  envelopes,
  loadingEnvelopes,
  contractAddress,
  ensureContractAddress: ensureOpenContract,
  fetchEnvelopeDetails,
  loadEnvelopes,
  // Type 2 (Lucky Money)
  claims,
  pools,
  loadingPools,
  claimFromPool,
  openClaim,
  transferClaim,
  reclaimPool,
} = useRedEnvelopeOpen();

const {
  isEligible,
  neoBalance,
  holdingDays,
  reason: eligibilityReason,
  checking: checkingEligibility,
  checkEligibility,
} = useNeoEligibility();

const luckyMessage = ref<{ amount: number; from: string } | null>(null);
const openingId = ref<string | null>(null);
const showOpeningModal = ref(false);
const openingEnvelope = ref<any>(null);
const showTransferModal = ref(false);
const transferringEnvelope = ref<any>(null);
const openingClaim = ref<any>(null);
const envelopeType = ref<EnvelopeType>("spreading");

const handleConnect = async () => {
  try {
    await connect();
  } catch {}
};

const create = async () => {
  if (isLoading.value) return;
  try {
    isLoading.value = true;
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

    const finalDescription = description.value.trim() || defaultBlessing.value;
    const minNeo = Number(minNeoRequired.value) || 100;
    const holdSeconds = Math.round((Number(minHoldDays.value) || 2) * 86400);
    const envelopeTypeValue = envelopeType.value === "lucky" ? "1" : "0";

    const tx = await invokeContract({
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: contract },
        { type: "Integer", value: toFixed8(amount.value) },
        {
          type: "Array",
          value: [
            { type: "Integer", value: String(packetCount) },
            { type: "Integer", value: String(expirySeconds) },
            { type: "String", value: finalDescription },
            { type: "Integer", value: String(minNeo) },
            { type: "Integer", value: String(holdSeconds) },
            { type: "Integer", value: envelopeTypeValue },
          ],
        },
      ],
    });

    const txid = String((tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "");
    const createdEvt = txid
      ? await pollForEvent(
          async () => {
            const result = await listEvents({ app_id: APP_ID, event_name: "EnvelopeCreated", limit: 40 });
            return result.events || [];
          },
          (evt: any) => evt.tx_hash === txid,
          { timeoutMs: 30000, errorMessage: t("envelopePending") },
        )
      : null;

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
  } finally {
    isLoading.value = false;
  }
};

const openEnvelope = async (env: any) => {
  if (openingId.value) return;

  if (!address.value) {
    await connect();
    if (!address.value) return;
  }

  try {
    status.value = null;
    const contract = await ensureOpenContract();

    if (env.expired) throw new Error(t("envelopeExpired"));
    if (!env.active) throw new Error(t("envelopeNotReady"));
    if (env.depleted) throw new Error(t("envelopeEmpty"));

    // Check if already opened
    const hasOpenedRes = await invokeRead({
      scriptHash: contract,
      operation: "HasOpened",
      args: [
        { type: "Integer", value: env.id },
        { type: "Hash160", value: address.value },
      ],
    });
    if (Boolean(parseInvokeResult(hasOpenedRes))) {
      throw new Error(t("alreadyOpened"));
    }

    // Check NEO eligibility
    await checkEligibility(contract, env.id);
    if (!isEligible.value) {
      throw new Error(eligibilityReason.value === "insufficient NEO" ? t("insufficientNeo") : t("holdDurationNotMet"));
    }

    openingId.value = env.id;
    const tx = await invokeContract({
      scriptHash: contract,
      operation: "OpenEnvelope",
      args: [
        { type: "Integer", value: env.id },
        { type: "Hash160", value: address.value },
      ],
    });

    const txid = String(
      (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
    );
    const openedEvt = txid
      ? await pollForEvent(
          async () => {
            const result = await listEvents({ app_id: APP_ID, event_name: "EnvelopeOpened", limit: 25 });
            return result.events || [];
          },
          (evt: any) => evt.tx_hash === txid,
          { timeoutMs: 30000, errorMessage: t("openPending") }
        )
      : null;

    if (!openedEvt) {
      throw new Error(t("openPending"));
    }
    const values = Array.isArray((openedEvt as any)?.state) ? (openedEvt as any).state.map(parseStackItem) : [];
    const openedAmount = fromFixed8(Number(values[2] ?? 0));

    showOpeningModal.value = false;

    luckyMessage.value = {
      amount: Number(openedAmount.toFixed(2)),
      from: env.from,
    };

    status.value = { msg: t("openedFrom").replace("{0}", env.from), type: "success" };
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

const startTransfer = (env: any) => {
  transferringEnvelope.value = env;
  showTransferModal.value = true;
};

const handleTransfer = async (recipient: string) => {
  if (!address.value || !transferringEnvelope.value) return;
  try {
    status.value = null;
    const contract = await ensureOpenContract();
    const env = transferringEnvelope.value;

    if (env.poolId) {
      await transferClaim(env.id, recipient);
    } else {
      await invokeContract({
        scriptHash: contract,
        operation: "transferEnvelope",
        args: [
          { type: "Integer", value: env.id },
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: recipient },
          { type: "Any", value: null },
        ],
      });
    }

    showTransferModal.value = false;
    transferringEnvelope.value = null;
    status.value = { msg: t("transferSuccess"), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
  }
};

const reclaimEnvelope = async (env: any) => {
  if (!address.value) return;
  try {
    status.value = null;
    const contract = await ensureOpenContract();

    await invokeContract({
      scriptHash: contract,
      operation: "ReclaimEnvelope",
      args: [
        { type: "Integer", value: env.id },
        { type: "Hash160", value: address.value },
      ],
    });

    status.value = { msg: t("reclaimSuccess"), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
  }
};

// --- Type 2 (Lucky Money) handlers ---

const handleClaimFromPool = async (poolId: string) => {
  if (!address.value) {
    await connect();
    if (!address.value) return;
  }
  try {
    status.value = null;
    const { txid } = await claimFromPool(poolId);
    status.value = { msg: t("claimSuccess"), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
  }
};

const openClaimFromList = (claim: any) => {
  openingClaim.value = claim;
  openingEnvelope.value = null;
  showOpeningModal.value = true;
};

const handleOpenClaim = async (claim: any) => {
  if (!address.value || openingId.value) return;
  try {
    status.value = null;
    openingId.value = claim.id;
    const { txid } = await openClaim(claim.id);

    showOpeningModal.value = false;
    openingClaim.value = null;

    luckyMessage.value = {
      amount: Number(claim.amount?.toFixed?.(2) ?? claim.amount),
      from: `Pool #${claim.poolId}`,
    };

    status.value = { msg: t("claimSuccess"), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
    showOpeningModal.value = false;
  } finally {
    openingId.value = null;
  }
};

const startTransferClaim = (claim: any) => {
  transferringEnvelope.value = claim;
  showTransferModal.value = true;
};

const handleReclaimPool = async (pool: any) => {
  if (!address.value) return;
  try {
    status.value = null;
    const { txid } = await reclaimPool(pool.id);
    status.value = { msg: t("reclaimSuccess"), type: "success" };
    await loadEnvelopes();
  } catch (e: unknown) {
    status.value = { msg: (e as Error)?.message || t("error"), type: "error" };
  }
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
        activeTab.value = "myEnvelopes";
      } else {
        const contract = await ensureOpenContract();
        const env = await fetchEnvelopeDetails(contract, id);
        if (env) {
          openingEnvelope.value = env;
          showOpeningModal.value = true;
          activeTab.value = "myEnvelopes";
        }
      }
    }
  }
});

watch(activeTab, async (tab) => {
  if (tab === "myEnvelopes") {
    await loadEnvelopes();
  } else if (tab === "claim") {
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
