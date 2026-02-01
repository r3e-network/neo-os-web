<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-guardian-policy" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Main Tab -->
    <view v-if="activeTab === 'main'" class="tab-content">
      <!-- Chain Warning - Framework Component -->
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold">{{ status.msg }}</text>
      </NeoCard>

      <!-- Create New Policy -->
      <CreatePolicyForm
        v-model:assetType="assetType"
        v-model:policyType="policyType"
        v-model:coverage="coverage"
        v-model:threshold="threshold"
        v-model:startPrice="startPrice"
        :premium="premiumDisplay"
        :is-fetching-price="isFetchingPrice"
        :t="t"
        @fetchPrice="fetchPrice"
        @create="createPolicy"
      />

      <!-- Policy Rules -->
      <PoliciesList :policies="policies" :t="t" @claim="requestClaim" />
    </view>

    <!-- Stats Tab -->
    <view v-if="activeTab === 'stats'" class="tab-content scrollable">
      <StatsCard :stats="stats" :t="t" />

      <!-- Action History -->
      <ActionHistory :action-history="actionHistory" :t="t" />
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
import { useWallet, useEvents, useDatafeed } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoCard, NeoDoc, NeoButton, ChainWarning } from "@shared/components";
import { requireNeoChain } from "@shared/utils/chain";
import type { NavTab } from "@shared/components/NavBar.vue";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

import PoliciesList, { type Policy, type Level } from "./components/PoliciesList.vue";
import CreatePolicyForm from "./components/CreatePolicyForm.vue";
import StatsCard from "./components/StatsCard.vue";
import ActionHistory, { type ActionHistoryItem } from "./components/ActionHistory.vue";

const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { list: listEvents } = useEvents();
const { getPrice, isLoading: isFetchingPrice } = useDatafeed();
const APP_ID = "miniapp-guardianpolicy";
const { processPayment } = usePaymentFlow(APP_ID);
const contractAddress = ref<string | null>(null);

const navTabs = computed<NavTab[]>(() => [
  { id: "main", icon: "wallet", label: t("main") },
  { id: "stats", icon: "chart", label: t("stats") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("main");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const policies = ref<Policy[]>([]);
const actionHistory = ref<ActionHistoryItem[]>([]);
const assetType = ref("");
const policyType = ref(1);
const coverage = ref("");
const threshold = ref("");
const startPrice = ref("");
const priceDecimals = ref(8);
const status = ref<{ msg: string; type: string } | null>(null);

const premiumDisplay = computed(() => {
  const amount = parseFloat(coverage.value);
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return (amount * 0.05).toFixed(2);
});

const stats = computed(() => ({
  totalPolicies: policies.value.length,
  activePolicies: policies.value.filter((p) => p.active && !p.claimed).length,
  claimedPolicies: policies.value.filter((p) => p.claimed).length,
  totalCoverage: policies.value.reduce((sum, p) => sum + (p.coverageValue || 0), 0),
}));

const ownerMatches = (value: unknown) => {
  if (!address.value) return false;
  const val = String(value || "");
  if (val === address.value) return true;
  const normalized = normalizeScriptHash(val);
  const addrHash = addressToScriptHash(address.value);
  return Boolean(normalized && addrHash && normalized === addrHash);
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

const formatWithDecimals = (value: string, decimals: number) => {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  if (!cleaned) return "0";
  const padded = cleaned.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
};

const toInteger = (value: string, decimals: number) => {
  const normalized = String(value || "").trim();
  const [wholeRaw, fracRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/[^\d]/g, "") || "0";
  const frac = fracRaw.replace(/[^\d]/g, "");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${padded}`.replace(/^0+/, "");
  return combined || "0";
};

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

const levelFromThreshold = (thresholdPercent: number): Level => {
  if (thresholdPercent <= 10) return "critical";
  if (thresholdPercent <= 20) return "high";
  if (thresholdPercent <= 30) return "medium";
  return "low";
};

const parsePolicyStruct = (raw: unknown) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const data = raw as Record<string, unknown>;
    return {
      holder: data.holder,
      assetType: String(data.assetType || ""),
      coverage: Number(data.coverage || 0),
      premium: Number(data.premium || 0),
      startPrice: String(data.startPrice || "0"),
      threshold: Number(data.thresholdPercent || 0),
      startTime: Number(data.startTime || 0),
      endTime: Number(data.endTime || 0),
      active: Boolean(data.active),
      claimed: Boolean(data.claimed),
    };
  }
  const data = Array.isArray(raw) ? raw : [];
  return {
    holder: data[0],
    assetType: String(data[1] || ""),
    coverage: Number(data[2] || 0),
    premium: Number(data[3] || 0),
    startPrice: String(data[4] || "0"),
    threshold: Number(data[5] || 0),
    startTime: Number(data[6] || 0),
    endTime: Number(data[7] || 0),
    active: Boolean(data[8]),
    claimed: Boolean(data[9]),
  };
};

const fetchPolicies = async () => {
  if (!address.value) return;
  const createdEvents = await listAllEvents("PolicyCreated");
  const policyIds = createdEvents
    .map((evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
      return {
        id: String(values[0] || ""),
        holder: values[1],
      };
    })
    .filter((entry) => entry.id && ownerMatches(entry.holder))
    .map((entry) => entry.id);

  const uniqueIds = Array.from(new Set(policyIds));
  const contract = await ensureContractAddress();
  const policyList: Policy[] = [];

  for (const id of uniqueIds) {
    const res = await invokeRead({
      contractAddress: contract,
      operation: "GetPolicyDetails",
      args: [{ type: "Integer", value: id }],
    });
    const parsed = parseInvokeResult(res);
    const data = parsePolicyStruct(parsed);
    if (!data.assetType) continue;

    const coverageGas = data.coverage / 1e8;
    const endTimeMs = data.endTime > 1e12 ? data.endTime : data.endTime * 1000;
    const endDate = endTimeMs ? new Date(endTimeMs).toISOString().split("T")[0] : t("notAvailable");
    const description = t("policyDescription", {
      coverage: coverageGas.toFixed(2),
      threshold: data.threshold,
      date: endDate,
    });

    policyList.push({
      id,
      name: data.assetType,
      description,
      active: data.active,
      claimed: data.claimed,
      level: levelFromThreshold(data.threshold),
      coverageValue: coverageGas,
    });
  }

  policies.value = policyList;
};

const fetchHistory = async () => {
  const [createdEvents, claimEvents, processedEvents] = await Promise.all([
    listAllEvents("PolicyCreated"),
    listAllEvents("ClaimRequested"),
    listAllEvents("ClaimProcessed"),
  ]);

  const history: ActionHistoryItem[] = [];
  const userPolicyIds = new Set<string>();

  createdEvents.forEach((evt) => {
    const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
    const policyId = String(values[0] || "");
    const holder = values[1];
    if (!policyId || !ownerMatches(holder)) return;
    userPolicyIds.add(policyId);
    history.push({
      id: evt.id,
      action: `${t("policyCreated")} #${policyId}`,
      time: new Date(evt.created_at || Date.now()).toLocaleString(),
      type: "create",
    });
  });

  claimEvents.forEach((evt) => {
    const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
    const policyId = String(values[0] || "");
    if (!policyId || !userPolicyIds.has(policyId)) return;
    history.push({
      id: evt.id,
      action: `${t("requestClaim")} #${policyId}`,
      time: new Date(evt.created_at || Date.now()).toLocaleString(),
      type: "claim",
    });
  });

  processedEvents.forEach((evt) => {
    const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
    const policyId = String(values[0] || "");
    const approved = Boolean(values[2]);
    const payout = Number(values[3] || 0) / 1e8;
    if (!policyId || !userPolicyIds.has(policyId)) return;
    history.push({
      id: evt.id,
      action: `${t("claimProcessed")} #${policyId} · ${approved ? "Approved" : "Denied"} · ${payout.toFixed(2)} GAS`,
      time: new Date(evt.created_at || Date.now()).toLocaleString(),
      type: "processed",
    });
  });

  actionHistory.value = history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
};

const refreshData = async () => {
  try {
    if (!address.value) {
      await connect();
    }
    if (!address.value) return;
    await fetchPolicies();
    await fetchHistory();
  } catch {}
};

const fetchPrice = async () => {
  if (!assetType.value) {
    status.value = { msg: t("fillAllFields"), type: "error" };
    return;
  }
  try {
    const symbol = assetType.value.trim().replace("/", "-");
    const price = await getPrice(symbol);
    if (price?.price) {
      priceDecimals.value = price.decimals ?? 8;
      startPrice.value = formatWithDecimals(price.price, priceDecimals.value);
      status.value = { msg: t("priceFetched"), type: "success" };
    }
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

const createPolicy = async () => {
  if (!assetType.value || !coverage.value || !threshold.value || !startPrice.value) {
    status.value = { msg: t("fillAllFields"), type: "error" };
    return;
  }

  const coverageInt = toInteger(coverage.value, 8);
  const startPriceInt = toInteger(startPrice.value, priceDecimals.value);
  const thresholdPercent = Math.floor(Number(threshold.value));
  const selectedPolicyType = Number(policyType.value);

  if (
    Number(coverageInt) <= 0 ||
    Number(startPriceInt) <= 0 ||
    thresholdPercent <= 0 ||
    thresholdPercent > 50 ||
    selectedPolicyType < 1 ||
    selectedPolicyType > 3
  ) {
    status.value = { msg: t("fillAllFields"), type: "error" };
    return;
  }

  try {
    status.value = { msg: t("creatingPolicy"), type: "loading" };
    if (!address.value) {
      await connect();
    }
    if (!address.value) throw new Error(t("error"));

    const contract = await ensureContractAddress();
    const { receiptId, invoke } = await processPayment(premiumDisplay.value || "0", `policy:${assetType.value.trim()}`);
    if (!receiptId) throw new Error(t("receiptMissing"));
    await invoke(
      "createPolicy",
      [
        { type: "Hash160", value: address.value },
        { type: "String", value: assetType.value.trim() },
        { type: "Integer", value: String(selectedPolicyType) },
        { type: "Integer", value: coverageInt },
        { type: "Integer", value: startPriceInt },
        { type: "Integer", value: String(thresholdPercent) },
        { type: "Integer", value: String(receiptId) },
      ],
      contract,
    );
    status.value = { msg: t("policyCreated"), type: "success" };
    assetType.value = "";
    coverage.value = "";
    threshold.value = "";
    startPrice.value = "";
    await refreshData();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

const requestClaim = async (policyId: string) => {
  if (!policyId) return;
  try {
    status.value = { msg: t("claimRequested"), type: "loading" };
    if (!address.value) {
      await connect();
    }
    if (!address.value) throw new Error(t("error"));
    const contract = await ensureContractAddress();
    await invokeContract({
      scriptHash: contract,
      operation: "RequestClaim",
      args: [{ type: "Integer", value: policyId }],
    });
    status.value = { msg: t("claimRequested"), type: "success" };
    await refreshData();
  } catch (e: any) {
    status.value = { msg: e.message || t("error"), type: "error" };
  }
};

onMounted(() => {
  refreshData();
});

watch(address, () => {
  refreshData();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./guardian-policy-theme.scss";

:global(page) {
  background: var(--ops-bg);
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--ops-bg);
  background-image: var(--ops-grid);
  background-size: 40px 40px;
  min-height: 100vh;
}

/* Ops Component Overrides */
:deep(.neo-card) {
  background: var(--ops-card-bg) !important;
  border: 1px solid var(--ops-card-border) !important;
  border-top: 2px solid var(--ops-blue) !important;
  border-radius: 4px !important;
  box-shadow: var(--ops-card-shadow) !important;
  color: var(--ops-text) !important;
  backdrop-filter: blur(10px);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: -2px;
    left: -1px;
    width: 10px;
    height: 10px;
    border-top: 2px solid var(--ops-cyan);
    border-left: 2px solid var(--ops-cyan);
  }
  &::after {
    content: "";
    position: absolute;
    bottom: -2px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-bottom: 2px solid var(--ops-cyan);
    border-right: 2px solid var(--ops-cyan);
  }
}

:deep(.neo-button) {
  font-family: "Share Tech Mono", monospace !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 2px !important;

  &.variant-primary {
    background: var(--ops-button-primary-bg) !important;
    border: 1px solid var(--ops-blue) !important;
    color: var(--ops-blue) !important;
    box-shadow: var(--ops-button-primary-shadow) !important;

    &:active {
      background: var(--ops-button-primary-bg-pressed) !important;
    }
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--ops-button-secondary-border) !important;
    color: var(--ops-button-secondary-text) !important;
  }
}

/* Technical Font Overrides */
:deep(text),
:deep(view) {
  font-family: "Share Tech Mono", monospace; /* Fallback if not available */
}

/* Status Indicator */
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ops-cyan);
  box-shadow: var(--ops-cyan-glow);
  display: inline-block;
  margin-right: 8px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
