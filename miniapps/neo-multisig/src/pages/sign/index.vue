<template>
  <view class="page-container">
    <view class="nav-header">
      <text class="back-btn" role="button" :aria-label="t('back') || 'Go back'" tabindex="0" @click="goHome" @keydown.enter="goHome">←</text>
      <view class="nav-text">
        <text class="title">{{ t("signTitle") }}</text>
        <text class="subtitle">{{ t("appSubtitle") }}</text>
      </view>
    </view>

    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
      <text>{{ status.msg }}</text>
    </NeoCard>

    <view v-if="loading" class="loading">{{ t("loading") }}</view>
    <view v-else-if="error" class="error">{{ error }}</view>

    <view v-else-if="request" class="content">
      <NeoCard class="status-card">
        <view class="status-row">
          <text class="status-label">{{ t("statusLabel") }}</text>
          <text class="status-val" :class="request.status">{{ statusLabel(request.status) }}</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
        <text class="progress-text">
          {{ t("signatureProgress", { count: signatureCount, total: request.threshold }) }}
        </text>
      </NeoCard>

      <TransactionDetails
        :t="t"
        :request="request"
        :chain-label="chainLabel"
        @copy="copy"
      />

      <SignersList
        :t="t"
        :signers="orderedSigners"
        :has-signed="hasSigned"
      />

      <SignActions
        :t="t"
        :is-complete="isComplete"
        :has-user-signed="hasUserSigned"
        :is-processing="isProcessing"
        :status="request.status"
        :broadcast-tx-id="broadcastTxId"
        @sign="sign"
        @broadcast="broadcast"
        @copy="copy"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { api, type MultisigRequest } from "../../services/api";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { tx } from "@cityofzion/neon-core";
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

const { t } = useI18n();
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

const loadRequest = async (id: string) => {
  try {
    request.value = await api.get(id);
    broadcastTxId.value = request.value?.broadcast_txid || "";
  } catch (e: unknown) {
    error.value = t("toastLoadFailed");
  } finally {
    loading.value = false;
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
  } catch (e: unknown) {
    /* non-critical: verification script parse */
    return [];
  }
});

const signatureCount = computed(() => Object.keys(request.value?.signatures || {}).length);
const progressPercent = computed(() => {
  if (!request.value) return 0;
  return Math.min(100, (signatureCount.value / request.value.threshold) * 100);
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
  } catch (e: unknown) {
    setStatus(t("toastSignFailed"), "error");
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

    const history = uni.getStorageSync("multisig_history") ? JSON.parse(uni.getStorageSync("multisig_history")) : [];
    const index = history.findIndex((item: { id: string; status?: string }) => item.id === request.value?.id);
    if (index >= 0) {
      history[index].status = "broadcasted";
      uni.setStorageSync("multisig_history", JSON.stringify(history));
    }

    setStatus(t("toastBroadcastSuccess"), "success");
  } catch (e: unknown) {
    setStatus(t("toastBroadcastFailed"), "error");
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.page-container {
  --multisig-accent: var(--status-success);
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
    color: var(--status-warning);
  }
  &.ready {
    color: var(--status-info);
  }
  &.broadcasted {
    color: var(--multisig-accent);
  }
  &.cancelled {
    color: var(--status-error);
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
