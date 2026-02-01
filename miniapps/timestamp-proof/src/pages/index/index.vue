<template>
  <view class="theme-timestamp-proof">
    <ResponsiveLayout
      :title="t('title')"
      :nav-items="navTabs"
      :active-tab="activeTab"
      :show-sidebar="isDesktop"
      layout="sidebar"
      @tab-change="activeTab = $event"
    >
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="sidebar-stats">
          <text class="sidebar-title">{{ t("proofStats") }}</text>
          <view class="stat-item">
            <text class="stat-label">{{ t("totalProofs") }}</text>
            <text class="stat-value">{{ proofs.length }}</text>
          </view>
          <view class="stat-item">
            <text class="stat-label">{{ t("yourProofs") }}</text>
            <text class="stat-value">{{ myProofsCount }}</text>
          </view>
        </view>
      </template>

      <view v-if="activeTab === 'proofs'" class="tab-content">
        <!-- Mobile: Quick Stats -->
        <view v-if="!isDesktop" class="mobile-stats">
          <view class="stat-card">
            <text class="stat-value">{{ proofs.length }}</text>
            <text class="stat-label">{{ t("totalProofs") }}</text>
          </view>
          <view class="stat-card">
            <text class="stat-value">{{ myProofsCount }}</text>
            <text class="stat-label">{{ t("yourProofs") }}</text>
          </view>
        </view>

        <view class="create-section">
          <text class="section-title">{{ t("createProof") }}</text>
          <textarea
            v-model="proofContent"
            class="content-input"
            :placeholder="t('contentPlaceholder')"
            maxlength="1000"
          />
          <button class="create-button" :disabled="isCreating || !proofContent.trim()" @click="createProof">
            <text>{{ isCreating ? t("loading") : t("createProof") }}</text>
          </button>
        </view>

        <view class="proofs-list">
          <text class="section-title">{{ t("recentProofs") }}</text>
          <view v-if="proofs.length === 0" class="empty-state">
            <text>{{ t("noProofs") }}</text>
          </view>
          <view v-else class="proof-cards">
            <view v-for="proof in proofs" :key="proof.id" class="proof-card">
              <text class="proof-id">#{{ proof.id }}</text>
              <text class="proof-timestamp">{{ formatTime(proof.timestamp) }}</text>
              <text class="proof-content"
                >{{ proof.content.slice(0, 50) }}{{ proof.content.length > 50 ? "..." : "" }}</text
              >
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'verify'" class="tab-content scrollable">
        <view class="verify-section">
          <text class="section-title">{{ t("verifyProof") }}</text>
          <input v-model="verifyId" class="id-input" :placeholder="t('enterProofId')" type="number" />
          <button class="verify-button" :disabled="isVerifying || !verifyId" @click="verifyProof">
            <text>{{ isVerifying ? t("loading") : t("verifyProof") }}</text>
          </button>

          <view v-if="verifiedProof" class="verified-proof">
            <text class="proof-status valid">{{ t("validProof") }}</text>
            <text class="proof-label">{{ t("verifiedContent") }}:</text>
            <text class="proof-content-full">{{ verifiedProof.content }}</text>
            <text class="proof-meta">{{ t("timestamp") }}: {{ formatTime(verifiedProof.timestamp) }}</text>
          </view>

          <view v-if="verifyError" class="verify-error">
            <text>{{ t("invalidProof") }}</text>
          </view>
        </view>
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

      <view v-if="errorMessage" class="error-toast">
        <text>{{ errorMessage }}</text>
      </view>
    </ResponsiveLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";

const { t } = useI18n();
const APP_ID = "miniapp-timestamp-proof";

const navTabs = computed<NavTab[]>(() => [
  { id: "proofs", icon: "clock", label: t("proofs") },
  { id: "verify", icon: "check", label: t("verify") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("proofs");
const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);

const contractAddress = ref<string | null>(null);
const proofContent = ref("");
const verifyId = ref("");
const proofs = ref<TimestampProof[]>([]);
const verifiedProof = ref<TimestampProof | null>(null);
const verifyError = ref(false);
const isCreating = ref(false);
const isVerifying = ref(false);
const errorMessage = ref<string | null>(null);

interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: "Immutable", desc: "Blockchain cannot be altered" },
  { name: "Verifiable", desc: "Anyone can verify proofs" },
]);

const ensureContractAddress = async (): Promise<boolean> => {
  if (!requireNeoChain(chainType, t)) return false;
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  return !!contractAddress.value;
};

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
      proofs.value = parsed.map((p: any) => ({
        id: Number(p.id || 0),
        content: String(p.content || ""),
        contentHash: String(p.contentHash || ""),
        timestamp: Number(p.timestamp || 0) * 1000,
        creator: String(p.creator || ""),
        txHash: String(p.txHash || ""),
      }));
    }
  } catch (e: any) {
  }
};

const createProof = async () => {
  if (!address.value) {
    showError(t("wpTitle"));
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
      contractAddress.value as string,
    )) as { txid: string };

    if (tx.txid) {
      await waitForEvent(tx.txid, "ProofCreated");
      proofContent.value = "";
      await loadProofs();
    }
  } catch (e: any) {
    showError(e.message || t("error"));
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
      verifiedProof.value = {
        id: Number((parsed as any).id || 0),
        content: String((parsed as any).content || ""),
        contentHash: String((parsed as any).contentHash || ""),
        timestamp: Number((parsed as any).timestamp || 0) * 1000,
        creator: String((parsed as any).creator || ""),
        txHash: String((parsed as any).txHash || ""),
      };
    } else {
      verifyError.value = true;
    }
  } catch (e: any) {
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

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

const showError = (msg: string) => {
  errorMessage.value = msg;
  setTimeout(() => (errorMessage.value = null), 5000);
};

onMounted(async () => {
  await ensureContractAddress();
  await loadProofs();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/theme-base.scss" as *;
@import "./timestamp-proof-theme.scss";

// Tab content - works with both mobile and desktop layouts
.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5, 20px);
  color: var(--proof-text-primary, var(--text-primary, #f8fafc));

  // Remove default padding - DesktopLayout provides padding
  // For mobile AppLayout, padding is handled by the layout itself
}

.create-section,
.verify-section,
.proofs-list {
  background: var(--proof-card-bg, var(--bg-card, rgba(30, 41, 59, 0.8)));
  border: 1px solid var(--proof-card-border, var(--border-color, rgba(255, 255, 255, 0.1)));
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-5, 20px);

  // Hover effect for interactive cards
  &:where(.proofs-list) {
    transition:
      background var(--transition-normal),
      border-color var(--transition-normal);

    &:hover {
      background: var(--bg-hover, rgba(255, 255, 255, 0.06));
      border-color: var(--border-color-hover, rgba(255, 255, 255, 0.15));
    }
  }
}

.section-title {
  font-size: var(--font-size-xl, 20px);
  font-weight: 700;
  color: var(--proof-text-primary, var(--text-primary, #f8fafc));
  margin-bottom: var(--spacing-4, 16px);
  letter-spacing: -0.3px;
}

.content-input,
.id-input {
  width: 100%;
  padding: var(--spacing-3, 12px);
  background: var(--proof-input-bg, var(--bg-tertiary, rgba(15, 23, 42, 0.6)));
  border: 1px solid var(--proof-input-border, var(--border-color, rgba(255, 255, 255, 0.1)));
  border-radius: var(--radius-md, 8px);
  color: var(--proof-text-primary, var(--text-primary, #f8fafc));
  font-size: var(--font-size-md, 14px);
  margin-bottom: var(--spacing-4, 16px);
  transition: all var(--transition-normal);

  &:focus {
    outline: none;
    border-color: var(--proof-accent, #8b5cf6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: var(--proof-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
  }
}

.content-input {
  min-height: 120px;
  resize: vertical;
}

.create-button,
.verify-button {
  width: 100%;
  padding: var(--spacing-3, 14px);
  background: var(--proof-btn-primary, #8b5cf6);
  color: white;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-lg, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);

  &:hover:not(:disabled) {
    background: var(--proof-btn-hover, #7c3aed);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

.empty-state {
  text-align: center;
  padding: var(--spacing-10, 40px);
  color: var(--proof-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
}

.proof-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.proof-card {
  padding: var(--spacing-4, 16px);
  background: var(--proof-bg-secondary, var(--bg-tertiary, rgba(15, 23, 42, 0.6)));
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  transition: all var(--transition-normal);

  &:hover {
    border-color: var(--proof-accent, #8b5cf6);
    transform: translateX(4px);
  }
}

.proof-id {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--proof-accent, #a78bfa);
  display: block;
  margin-bottom: var(--spacing-1, 4px);
  font-family: monospace;
}

.proof-timestamp {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
  display: block;
  margin-bottom: var(--spacing-2, 8px);
}

.proof-content {
  font-size: var(--font-size-md, 14px);
  color: var(--proof-text-secondary, var(--text-secondary, rgba(248, 250, 252, 0.7)));
  line-height: 1.5;
}

.verified-proof {
  margin-top: var(--spacing-5, 20px);
  padding: var(--spacing-4, 16px);
  background: var(--proof-success-bg, rgba(16, 185, 129, 0.1));
  border: 1px solid var(--proof-success, #10b981);
  border-radius: var(--radius-md, 8px);
}

.proof-status {
  font-size: var(--font-size-md, 14px);
  font-weight: 600;
  display: block;
  margin-bottom: var(--spacing-3, 12px);

  &.valid {
    color: var(--proof-success, #10b981);
  }

  &.invalid {
    color: var(--proof-danger, #ef4444);
  }
}

.proof-label {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
  display: block;
  margin-bottom: var(--spacing-1, 4px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.proof-content-full {
  font-size: var(--font-size-md, 14px);
  color: var(--proof-text-primary, var(--text-primary, #f8fafc));
  white-space: pre-wrap;
  word-break: break-all;
  display: block;
  margin-bottom: var(--spacing-2, 8px);
  font-family: monospace;
  background: var(--bg-tertiary, rgba(15, 23, 42, 0.6));
  padding: var(--spacing-2, 8px);
  border-radius: var(--radius-sm, 4px);
}

.proof-meta {
  font-size: var(--font-size-xs, 12px);
  color: var(--proof-text-muted, var(--text-tertiary, rgba(248, 250, 252, 0.5)));
  font-family: monospace;
}

.verify-error {
  margin-top: var(--spacing-5, 20px);
  padding: var(--spacing-4, 16px);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md, 8px);
  color: #ef4444;
  text-align: center;
}

.error-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: var(--spacing-3, 12px) var(--spacing-6, 24px);
  border-radius: var(--radius-md, 8px);
  font-weight: 600;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 3000;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: toast-in var(--transition-normal, 300ms ease-out);
}

@keyframes toast-in {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

// Reduced motion support for accessibility
@media (prefers-reduced-motion: reduce) {
  .create-button,
  .verify-button,
  .proof-card {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }

  .error-toast {
    animation: none;
  }

  .content-input,
  .id-input {
    transition: none;
  }
}
</style>
