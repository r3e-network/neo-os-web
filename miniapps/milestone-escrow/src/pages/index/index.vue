<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-milestone-escrow" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
  >
    <view v-if="activeTab === 'create'" class="tab-content">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold">{{ status.msg }}</text>
      </NeoCard>

      <EscrowForm @create="handleCreateEscrow" ref="escrowFormRef" />
    </view>

    <view v-if="activeTab === 'escrows'" class="tab-content scrollable">
      <view class="escrows-header">
        <text class="section-title">{{ t("escrowsTab") }}</text>
        <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="refreshEscrows">
          {{ t("refresh") }}
        </NeoButton>
      </view>

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="text-center">
        <text class="font-bold">{{ status.msg }}</text>
      </NeoCard>

      <view v-if="!address" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <text class="text-sm block mb-3">{{ t("walletNotConnected") }}</text>
          <NeoButton size="sm" variant="primary" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </view>

      <EscrowList
        v-else
        :creator-escrows="creatorEscrows"
        :beneficiary-escrows="beneficiaryEscrows"
        :approving-id="approvingId"
        :cancelling-id="cancellingId"
        :claiming-id="claimingId"
        :status-label-func="statusLabel"
        :format-amount-func="formatAmount"
        :format-address-func="formatAddress"
        @approve="approveMilestone"
        @cancel="cancelEscrow"
        @claim="claimMilestone"
      />
    </view>

    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="[t('step1'), t('step2'), t('step3'), t('step4')]"
        :features="[
          { name: t('feature1Name'), desc: t('feature1Desc') },
          { name: t('feature2Name'), desc: t('feature2Desc') },
          { name: t('feature3Name'), desc: t('feature3Desc') },
        ]"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoCard, NeoButton, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { requireNeoChain } from "@shared/utils/chain";
import { formatGas, formatAddress, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import EscrowForm from "./components/EscrowForm.vue";
import EscrowList, { type EscrowItem } from "./components/EscrowList.vue";

const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH_NORMALIZED = normalizeScriptHash(NEO_HASH);

const activeTab = ref("create");
const navTabs = computed<NavTab[]>(() => [
  { id: "create", icon: "plus", label: t("createTab") },
  { id: "escrows", icon: "file", label: t("escrowsTab") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const status = ref<{ msg: string; type: string } | null>(null);
const isRefreshing = ref(false);
const contractAddress = ref<string | null>(null);
const approvingId = ref<string | null>(null);
const claimingId = ref<string | null>(null);
const cancellingId = ref<string | null>(null);
const escrowFormRef = ref<InstanceType<typeof EscrowForm> | null>(null);

const creatorEscrows = ref<EscrowItem[]>([]);
const beneficiaryEscrows = ref<EscrowItem[]>([]);

const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) {
    throw new Error(t("contractMissing"));
  }
  return contractAddress.value;
};

const setStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => {
    if (status.value?.msg === msg) status.value = null;
  }, 4000);
};

const formatAmount = (assetSymbol: "NEO" | "GAS", amount: bigint) => {
  if (assetSymbol === "NEO") return amount.toString();
  return formatGas(amount, 4);
};

const statusLabel = (statusValue: "active" | "completed" | "cancelled") => {
  if (statusValue === "completed") return t("statusCompleted");
  if (statusValue === "cancelled") return t("statusCancelled");
  return t("statusActive");
};

const parseBigInt = (value: unknown) => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};

const parseBoolArray = (value: unknown, count: number) => {
  if (!Array.isArray(value)) return new Array(count).fill(false);
  return value.map((item) => item === true || item === "true" || item === 1 || item === "1");
};

const parseBigIntArray = (value: unknown, count: number) => {
  if (!Array.isArray(value)) return new Array(count).fill(0n);
  return value.map((item) => parseBigInt(item));
};

const parseEscrow = (raw: any, id: string): EscrowItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const asset = String(raw.asset || "");
  const assetNormalized = normalizeScriptHash(asset);
  const assetSymbol: "NEO" | "GAS" = assetNormalized === NEO_HASH_NORMALIZED ? "NEO" : "GAS";
  const milestoneCount = Number(raw.milestoneCount || 0);

  const milestoneAmounts = parseBigIntArray(raw.milestoneAmounts, milestoneCount);
  const milestoneApproved = parseBoolArray(raw.milestoneApproved, milestoneCount);
  const milestoneClaimed = parseBoolArray(raw.milestoneClaimed, milestoneCount);

  return {
    id,
    creator: String(raw.creator || ""),
    beneficiary: String(raw.beneficiary || ""),
    assetSymbol,
    totalAmount: parseBigInt(raw.totalAmount),
    releasedAmount: parseBigInt(raw.releasedAmount),
    status: String(raw.status || "active") as "active" | "completed" | "cancelled",
    milestoneAmounts,
    milestoneApproved,
    milestoneClaimed,
    title: String(raw.title || ""),
    notes: String(raw.notes || ""),
    active: Boolean(raw.active),
  };
};

const fetchEscrowDetails = async (escrowId: string) => {
  const contract = await ensureContractAddress();
  const details = await invokeRead({
    contractAddress: contract,
    operation: "GetEscrowDetails",
    args: [{ type: "Integer", value: escrowId }],
  });
  const parsed = parseInvokeResult(details) as any;
  return parseEscrow(parsed, escrowId);
};

const fetchEscrowIds = async (operation: string, walletAddress: string) => {
  const contract = await ensureContractAddress();
  const result = await invokeRead({
    contractAddress: contract,
    operation,
    args: [
      { type: "Hash160", value: walletAddress },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "20" },
    ],
  });
  const parsed = parseInvokeResult(result);
  if (!Array.isArray(parsed)) return [] as string[];
  return parsed
    .map((value) => String(value || ""))
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => String(value));
};

const refreshEscrows = async () => {
  if (!address.value) return;
  if (isRefreshing.value) return;
  try {
    isRefreshing.value = true;
    const creatorIds = await fetchEscrowIds("getCreatorEscrows", address.value);
    const beneficiaryIds = await fetchEscrowIds("getBeneficiaryEscrows", address.value);

    const creator = await Promise.all(creatorIds.map(fetchEscrowDetails));
    const beneficiary = await Promise.all(beneficiaryIds.map(fetchEscrowDetails));

    creatorEscrows.value = creator.filter(Boolean) as EscrowItem[];
    beneficiaryEscrows.value = beneficiary.filter(Boolean) as EscrowItem[];
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isRefreshing.value = false;
  }
};

const connectWallet = async () => {
  try {
    await connect();
    if (address.value) {
      await refreshEscrows();
    }
  } catch (e: any) {
    setStatus(e.message || t("walletNotConnected"), "error");
  }
};

const handleCreateEscrow = async (data: { name: string; beneficiary: string; asset: string; notes: string; milestones: Array<{ amount: string }> }) => {
  if (isLoading.value) return;
  if (!requireNeoChain(chainType, t)) return;

  const beneficiary = data.beneficiary.trim();
  if (!beneficiary || !addressToScriptHash(beneficiary)) {
    setStatus(t("invalidAddress"), "error");
    return;
  }

  if (data.milestones.length < 1 || data.milestones.length > 12) {
    setStatus(t("milestoneLimit"), "error");
    return;
  }

  const decimals = data.asset === "NEO" ? 0 : 8;
  const milestoneValues: string[] = [];
  let totalAmount = 0n;

  for (const milestone of data.milestones) {
    const raw = String(milestone.amount || "").trim();
    if (!raw) {
      setStatus(t("invalidAmount"), "error");
      return;
    }
    if (decimals === 0 && raw.includes(".")) {
      setStatus(t("invalidAmount"), "error");
      return;
    }
    const fixed = decimals === 8 ? toFixed8(raw) : toFixedDecimals(raw, 0);
    const amount = parseBigInt(fixed);
    if (amount <= 0n) {
      setStatus(t("invalidAmount"), "error");
      return;
    }
    milestoneValues.push(fixed);
    totalAmount += amount;
  }

  if (totalAmount <= 0n) {
    setStatus(t("invalidAmount"), "error");
    return;
  }

  try {
    isLoading.value = true;
    escrowFormRef.value?.setLoading(true);
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("walletNotConnected"));

    const contract = await ensureContractAddress();
    const assetHash = data.asset === "NEO" ? NEO_HASH : GAS_HASH;
    const title = data.name.trim().slice(0, 60);
    const notes = data.notes.trim().slice(0, 240);

    await invokeContract({
      scriptHash: contract,
      operation: "CreateEscrow",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: beneficiary },
        { type: "Hash160", value: assetHash },
        { type: "Integer", value: totalAmount.toString() },
        {
          type: "Array",
          value: milestoneValues.map((amount) => ({ type: "Integer", value: amount })),
        },
        { type: "String", value: title },
        { type: "String", value: notes },
      ],
    });

    setStatus(t("escrowCreated"), "success");
    escrowFormRef.value?.reset();
    await refreshEscrows();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isLoading.value = false;
    escrowFormRef.value?.setLoading(false);
  }
};

const isLoading = ref(false);

const approveMilestone = async (escrow: EscrowItem, milestoneIndex: number) => {
  if (approvingId.value) return;
  if (!requireNeoChain(chainType, t)) return;
  try {
    approvingId.value = `${escrow.id}-${milestoneIndex}`;
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "ApproveMilestone",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: escrow.id },
        { type: "Integer", value: String(milestoneIndex) },
      ],
    });
    await refreshEscrows();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    approvingId.value = null;
  }
};

const claimMilestone = async (escrow: EscrowItem, milestoneIndex: number) => {
  if (claimingId.value) return;
  if (!requireNeoChain(chainType, t)) return;
  try {
    claimingId.value = `${escrow.id}-${milestoneIndex}`;
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "ClaimMilestone",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: escrow.id },
        { type: "Integer", value: String(milestoneIndex) },
      ],
    });
    await refreshEscrows();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    claimingId.value = null;
  }
};

const cancelEscrow = async (escrow: EscrowItem) => {
  if (cancellingId.value) return;
  if (!requireNeoChain(chainType, t)) return;
  try {
    cancellingId.value = escrow.id;
    if (!address.value) throw new Error(t("walletNotConnected"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "CancelEscrow",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: escrow.id },
      ],
    });
    await refreshEscrows();
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    cancellingId.value = null;
  }
};

onMounted(() => {
  if (address.value) {
    refreshEscrows();
  }
});

watch(activeTab, (next) => {
  if (next === "escrows" && address.value) {
    refreshEscrows();
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./milestone-escrow-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--escrow-bg-start) 0%, var(--escrow-bg-end) 100%);
  color: var(--escrow-text);
}

.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.escrows-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
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
