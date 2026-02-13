<template>
  <view class="theme-timestamp-proof">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="errorStatus"
      class="theme-timestamp-proof"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('proofStats')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <!-- Mobile: Quick Stats -->
          <NeoStats :stats="mobileStats" class="mobile-stats" />

          <ProofList :t="t" :proofs="proofs" />
        </ErrorBoundary>
      </template>

      <template #operation>
        <ProofCreateForm :t="t" v-model:content="proofContent" :is-creating="isCreating" @create="createProof" />
      </template>

      <template #tab-verify>
        <ProofVerify
          :t="t"
          v-model:proof-id="verifyId"
          :is-verifying="isVerifying"
          :verified-proof="verifiedProof"
          :verify-error="verifyError"
          @verify="verifyProof"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary, NeoStats } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import ProofCreateForm from "./components/ProofCreateForm.vue";
import ProofList from "./components/ProofList.vue";
import ProofVerify from "./components/ProofVerify.vue";

const { t } = createUseI18n(messages)();
const APP_ID = "miniapp-timestamp-proof";

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "proofs", labelKey: "proofs", icon: "🕐", default: true },
    { key: "verify", labelKey: "verify", icon: "✅" },
  ],
});

const appState = computed(() => ({}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "totalProofs", value: () => proofs.value.length },
  { labelKey: "yourProofs", value: () => myProofsCount.value },
  { labelKey: "latestId", value: () => (proofs.value.length > 0 ? `#${proofs.value[0].id}` : "—") },
]);

const activeTab = ref("proofs");
const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);
const { contractAddress, ensureSafe: ensureContractAddress } = useContractAddress(t);
const proofContent = ref("");
const verifyId = ref("");
const proofs = ref<TimestampProof[]>([]);
const verifiedProof = ref<TimestampProof | null>(null);
const verifyError = ref(false);
const isCreating = ref(false);
const isVerifying = ref(false);
const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
const errorMessage = computed(() => errorStatus.value?.msg ?? null);

interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

const myProofsCount = computed(() => {
  if (!address.value) return 0;
  return proofs.value.filter((p) => p.creator === address.value).length;
});

const mobileStats = computed(() => [
  { label: t("totalProofs"), value: proofs.value.length },
  { label: t("yourProofs"), value: myProofsCount.value },
]);

const loadProofs = async () => {
  if (!(await ensureContractAddress())) return;
  try {
    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getProofs",
      args: [],
    });
    const parsed = parseInvokeResult(result) as unknown[];
    if (Array.isArray(parsed)) {
      proofs.value = parsed.map((p: unknown) => {
        const item = p as Record<string, unknown>;
        return {
          id: Number(item.id || 0),
          content: String(item.content || ""),
          contentHash: String(item.contentHash || ""),
          timestamp: Number(item.timestamp || 0) * 1000,
          creator: String(item.creator || ""),
          txHash: String(item.txHash || ""),
        };
      });
    }
  } catch (_e: unknown) {
    // Proof load failure handled silently
  }
};

const createProof = async () => {
  if (!address.value) {
    setErrorStatus(t("wpTitle"), "error");
    return;
  }
  if (!(await ensureContractAddress())) return;

  try {
    isCreating.value = true;
    const hash = await hashContent(proofContent.value);
    const { receiptId, invoke } = await processPayment("0.5", `proof:${hash.slice(0, 16)}`);

    const tx = (await invoke(
      "createProof",
      [
        { type: "String", value: proofContent.value },
        { type: "String", value: hash },
        { type: "Integer", value: String(receiptId) },
      ],
      contractAddress.value as string
    )) as { txid: string };

    if (tx.txid) {
      await waitForEvent(tx.txid, "ProofCreated");
      proofContent.value = "";
      await loadProofs();
    }
  } catch (e: unknown) {
    setErrorStatus(formatErrorMessage(e, t("error")), "error");
  } finally {
    isCreating.value = false;
  }
};

const verifyProof = async () => {
  if (!(await ensureContractAddress())) return;

  try {
    isVerifying.value = true;
    verifyError.value = false;
    verifiedProof.value = null;

    const result = await invokeRead({
      scriptHash: contractAddress.value as string,
      operation: "getProof",
      args: [{ type: "Integer", value: verifyId.value }],
    });

    const parsed = parseInvokeResult(result);
    if (parsed) {
      const item = parsed as Record<string, unknown>;
      verifiedProof.value = {
        id: Number(item.id || 0),
        content: String(item.content || ""),
        contentHash: String(item.contentHash || ""),
        timestamp: Number(item.timestamp || 0) * 1000,
        creator: String(item.creator || ""),
        txHash: String(item.txHash || ""),
      };
    } else {
      verifyError.value = true;
    }
  } catch (_e: unknown) {
    verifyError.value = true;
  } finally {
    isVerifying.value = false;
  }
};

const hashContent = async (content: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

onMounted(async () => {
  await ensureContractAddress();
  await loadProofs();
});

const { handleBoundaryError } = useHandleBoundaryError("timestamp-proof");
const resetAndReload = async () => {
  await ensureContractAddress();
  await loadProofs();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./timestamp-proof-theme.scss";

:global(page) {
  background: var(--proof-bg);
}
</style>
