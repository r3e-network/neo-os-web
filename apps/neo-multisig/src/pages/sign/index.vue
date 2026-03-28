<template>
  <div class="page-container">
    <div class="nav-header">
      <button
        type="button"
        class="back-btn"
        :aria-label="t('buttonBack')"
        @click="goHome"
      >←</button>
      <div class="nav-text">
        <span class="title">{{ t("signTitle") }}</span>
        <span class="subtitle">{{ t("appSubtitle") }}</span>
      </div>
    </div>

    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
      <span>{{ status.msg }}</span>
    </NeoCard>

    <div v-if="loading" class="loading">{{ t("loading") }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="request" class="content">
      <NeoCard class="status-card">
        <div class="status-row">
          <span class="status-label">{{ t("statusLabel") }}</span>
          <span class="status-val" :class="request.status">{{ statusLabel(request.status) }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="progress-text">
          {{ t("signatureProgress", { count: signatureCount, total: request.threshold }) }}
        </span>
      </NeoCard>

      <TransactionDetails :request="request" :chain-label="chainLabel" @copy="copy" />

      <SignersList :signers="orderedSigners" :has-signed="hasSigned" />

      <SignActions
        :is-complete="isComplete"
        :has-user-signed="hasUserSigned"
        :is-processing="isProcessing"
        :status="request.status"
        :broadcast-tx-id="broadcastTxId"
        @sign="sign"
        @broadcast="broadcast"
        @copy="copy"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onMounted } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { api } from "../../services/api";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { tx } from "@r3e/neo-js-sdk/browser";
import {
  buildVerificationScript,
  buildWitness,
  getNetworkMagic,
  getPublicKeyAddress,
  getRpcClient,
  normalizePublicKey,
  verifySignature,
} from "../../utils/multisig";
import TransactionDetails from "./components/TransactionDetails.vue";
import SignersList from "./components/SignersList.vue";
import SignActions from "./components/SignActions.vue";

const { t } = createUseI18n(messages)();
const { address, signMessage } = useWallet() as WalletSDK;
const { status, setStatus } = useStatusMessage(5000);

const request = ref<MultisigRequest | null>(null);
const loading = ref(true);
const error = ref("");
const isProcessing = ref(false);
const broadcastTxId = ref("");

onLoad((query: Record<string, string>) => {
  if (query.id) {
    loadRequest(query.id);
  } else {
    error.value = t("toastNoId");
    loading.value = false;
  }
});

onMounted(() => {
  // Additional mount logic if needed
});

const loadRequest = async (id: string) => {
  try {
    request.value = await api.get(id);
    broadcastTxId.value = request.value?.broadcast_txid || "";
  } catch (e) {
    error.value = formatErrorMessage(e, t("toastLoadFailed"));
  } finally {
    loading.value = false;
    error.value = null;
  }
};

const chainLabel = computed(() => {
  if (!request.value) return "";
  return request.value.chain_id === "neo-n3-testnet" ? t("chainTestnet") : t("chainMainnet");
});

const orderedSigners = computed(() => {
  if (!request.value) return [];
  try {
    const verification = buildVerificationScript(request.value.threshold, request.value.signers);
    const orderedKeys = verification.publicKeys;
    return orderedKeys.map((key) => ({
      publicKey: key,
      address: getPublicKeyAddress(key),
    }));
  } catch (e) {
    console.warn("[neo-multisig] verification script parse failed:", e instanceof Error ? e.message : String(e));
    return [];
  }
});

const signatureCount = computed(() => Object.keys(request.value?.signatures || {}).length);
const progressPercent = computed(() => {
  if (!request.value) return 0;
  const threshold = request.value.threshold || 1;
  return Math.min(100, (signatureCount.value / threshold) * 100);
});
const isComplete = computed(() => signatureCount.value >= (request.value?.threshold || 1));

const hasUserSigned = computed(() => {
  if (!request.value || !address?.value) return false;
  const match = orderedSigners.value.find((signer) => signer.address === address.value);
  if (!match) return false;
  return !!request.value.signatures?.[match.publicKey];
});

const goHome = () => uni.navigateTo({ url: "/pages/index/index" });

const hasSigned = (signer: string) => {
  return !!request.value?.signatures?.[signer];
};

const copy = (str: string) => {
  uni.setClipboardData({ data: str });
  setStatus(t("copied"), "success");
};

const statusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return t("statusPending");
    case "ready":
      return t("statusReady");
    case "broadcasted":
      return t("statusBroadcasted");
    case "cancelled":
      return t("statusCancelled");
    case "expired":
      return t("statusExpired");
    default:
      return t("statusUnknown");
  }
};

const sign = async () => {
  if (!request.value) return;
  isProcessing.value = true;
  try {
    const txn = tx.Transaction.deserialize(request.value.transaction_hex);
    const networkMagic = getNetworkMagic(request.value.chain_id);
    const message = txn.getMessageForSigning(networkMagic);

    const res = (await signMessage(message)) as { publicKey?: string; data?: string } | null;
    if (!res || !res.publicKey || !res.data) {
      setStatus(t("toastSignFailed"), "error");
      return;
    }

    const pubKey = normalizePublicKey(res.publicKey);
    const signature = String(res.data || "")
      .replace(/^0x/i, "")
      .toLowerCase();

    if (!request.value.signers.includes(pubKey)) {
      setStatus(t("toastNotSigner"), "error");
      return;
    }

    if (!verifySignature(message, signature, pubKey)) {
      setStatus(t("toastSignatureInvalid"), "error");
      return;
    }

    const updated = await api.addSignature(request.value.id, pubKey, signature);
    request.value = updated;
    setStatus(t("toastSignSuccess"), "success");
  } catch (e) {
    setStatus(formatErrorMessage(e, t("toastSignFailed")), "error");
  } finally {
    isProcessing.value = false;
  }
};

const broadcast = async () => {
  if (!request.value) return;
  isProcessing.value = true;
  try {
    if (!isComplete.value) {
      setStatus(t("toastNotEnoughSignatures"), "error");
      return;
    }

    const txn = tx.Transaction.deserialize(request.value.transaction_hex);
    const client = getRpcClient(request.value.chain_id);
    const currentHeight = await client.getBlockCount();
    if (currentHeight >= txn.validUntilBlock) {
      await api.updateStatus(request.value.id, "expired");
      request.value.status = "expired";
      setStatus(t("toastExpired"), "error");
      return;
    }

    const verification = buildVerificationScript(request.value.threshold, request.value.signers);
    const orderedKeys = verification.publicKeys;
    const orderedSigs = orderedKeys
      .map((key) => request.value?.signatures?.[key])
      .filter((sig): sig is string => !!sig);

    if (orderedSigs.length < request.value.threshold) {
      setStatus(t("toastNotEnoughSignatures"), "error");
      return;
    }

    const witness = buildWitness(verification.script, orderedSigs.slice(0, request.value.threshold));
    txn.witnesses = [witness];

    const result = await client.sendRawTransaction(txn);
    const txid = typeof result === "string" ? result : txn.hash();
    broadcastTxId.value = txid;

    const updated = await api.updateStatus(request.value.id, "broadcasted", txid);
    request.value = updated;

    const cachedHistory = readCachedJSON<Array<{ id: string; status?: string }>>("multisig_history");
    const history = Array.isArray(cachedHistory) ? cachedHistory : [];
    const index = history.findIndex((item: { id: string; status?: string }) => item.id === request.value?.id);
    if (index >= 0) {
      history[index].status = "broadcasted";
      writeCachedJSON("multisig_history", history);
    }

    setStatus(t("toastBroadcastSuccess"), "success");
  } catch (e) {
    setStatus(formatErrorMessage(e, t("toastBroadcastFailed")), "error");
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.page-container {
  --multisig-accent: var(--accent-success);
  --multisig-accent-soft: rgba(0, 229, 153, 0.12);
  --multisig-accent-strong: rgba(0, 229, 153, 0.2);
  --multisig-accent-text: #0b0c16;
  --multisig-surface: rgba(255, 255, 255, 0.04);
  --multisig-surface-strong: rgba(255, 255, 255, 0.08);
  --multisig-border: rgba(255, 255, 255, 0.1);
  --multisig-border-subtle: rgba(255, 255, 255, 0.05);
  --multisig-divider: rgba(255, 255, 255, 0.05);
  --multisig-input-bg: rgba(255, 255, 255, 0.05);
  --multisig-input-text: var(--text-primary);

  padding: 24px;
  background: var(--bg-body);
  min-height: 100vh;
  color: var(--text-primary);
}

:global(.theme-light) .page-container,
:global([data-theme="light"]) .page-container {
  --multisig-accent-soft: rgba(0, 229, 153, 0.18);
  --multisig-accent-strong: rgba(0, 229, 153, 0.22);
  --multisig-accent-text: #0b0c16;
  --multisig-surface: rgba(15, 23, 42, 0.04);
  --multisig-surface-strong: rgba(15, 23, 42, 0.08);
  --multisig-border: rgba(15, 23, 42, 0.12);
  --multisig-border-subtle: rgba(15, 23, 42, 0.08);
  --multisig-divider: rgba(15, 23, 42, 0.1);
  --multisig-input-bg: rgba(15, 23, 42, 0.04);
  --multisig-input-text: var(--text-primary);
}

.nav-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  gap: 12px;
}

.nav-text {
  display: flex;
  flex-direction: column;
}

.back-btn {
  font-size: 24px;
  cursor: pointer;
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
}

.title {
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.loading,
.error {
  text-align: center;
  color: var(--text-secondary);
  margin-top: 32px;
}

.status-card {
  margin-bottom: 24px;
  padding: 24px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.status-val {
  text-transform: uppercase;
  font-weight: 700;

  &.pending {
    color: var(--accent-warning);
  }
  &.ready {
    color: var(--accent-info);
  }
  &.broadcasted {
    color: var(--multisig-accent);
  }
  &.cancelled {
    color: var(--accent-error);
  }
  &.expired {
    color: var(--text-muted);
  }
}

.progress-bar {
  height: 8px;
  background: var(--multisig-border);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--multisig-accent);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
