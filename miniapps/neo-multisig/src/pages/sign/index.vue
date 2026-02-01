<template>
  <view class="page-container">
    <view class="nav-header">
      <text class="back-btn" @click="goHome">←</text>
      <view class="nav-text">
        <text class="title">{{ t("signTitle") }}</text>
        <text class="subtitle">{{ t("appSubtitle") }}</text>
      </view>
    </view>

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

      <NeoCard class="details-card">
        <text class="card-title">{{ t("detailsTitle") }}</text>
        <view class="detail-row">
          <text class="label">{{ t("detailId") }}</text>
          <text class="value copy" @click="copy(request.id)">{{ request.id }} ({{ t("copy") }})</text>
        </view>
        <view class="detail-row">
          <text class="label">{{ t("detailMemo") }}</text>
          <text class="value">{{ request.memo || t("detailMemoNone") }}</text>
        </view>
        <view class="detail-row">
          <text class="label">{{ t("detailChain") }}</text>
          <text class="value">{{ chainLabel }}</text>
        </view>
        <view class="raw-data">
          <text class="label">{{ t("detailRawTx") }}</text>
          <textarea class="raw-input" :value="request.transaction_hex" disabled />
        </view>
      </NeoCard>

      <NeoCard class="signers-card">
        <text class="card-title">{{ t("signersTitle") }}</text>
        <view class="signer-list">
          <view v-for="signer in orderedSigners" :key="signer.publicKey" class="signer-row">
            <view class="signer-info">
              <text class="signer-key">{{ shorten(signer.publicKey) }}</text>
              <text class="signer-address">{{ shorten(signer.address) }}</text>
              <text v-if="hasSigned(signer.publicKey)" class="badge signed">{{ t("badgeSigned") }}</text>
              <text v-else class="badge pending">{{ t("badgePending") }}</text>
            </view>
          </view>
        </view>
      </NeoCard>

      <view class="actions">
        <NeoButton
          v-if="!isComplete && !hasUserSigned"
          variant="primary"
          size="lg"
          block
          @click="sign"
          :disabled="isProcessing"
        >
          {{ isProcessing ? t("buttonSigning") : t("buttonSign") }}
        </NeoButton>

        <NeoButton
          v-if="isComplete && request.status !== 'broadcasted'"
          variant="success"
          size="lg"
          block
          @click="broadcast"
          :disabled="isProcessing"
        >
          {{ isProcessing ? t("buttonBroadcasting") : t("buttonBroadcast") }}
        </NeoButton>

        <view v-if="broadcastTxId" class="broadcast-success">
          <text class="success-text">{{ t("broadcastedTitle") }}</text>
          <text class="tx-id" @click="copy(broadcastTxId)">
            {{ t("broadcastedTxid") }}: {{ broadcastTxId }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { NeoCard, NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { api, type MultisigRequest } from "../../services/api";
import { useWallet } from "@neo/uniapp-sdk";
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

const { t } = useI18n();
const { address, signMessage } = useWallet() as any;

const request = ref<MultisigRequest | null>(null);
const loading = ref(true);
const error = ref("");
const isProcessing = ref(false);
const broadcastTxId = ref("");

onLoad((query: any) => {
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
  } catch (e: any) {
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
  } catch (e) {
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

const shorten = (str: string) => (str ? str.slice(0, 6) + "..." + str.slice(-4) : "");

const copy = (str: string) => {
  uni.setClipboardData({ data: str });
  uni.showToast({ title: t("copied"), icon: "none" });
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

    const res: any = await signMessage(message);
    if (!res || !res.publicKey || !res.data) {
      uni.showToast({ title: t("toastSignFailed"), icon: "none" });
      return;
    }

    const pubKey = normalizePublicKey(res.publicKey);
    const signature = String(res.data || "").replace(/^0x/i, "").toLowerCase();

    if (!request.value.signers.includes(pubKey)) {
      uni.showToast({ title: t("toastNotSigner"), icon: "none" });
      return;
    }

    if (!verifySignature(message, signature, pubKey)) {
      uni.showToast({ title: t("toastSignatureInvalid"), icon: "none" });
      return;
    }

    const updated = await api.addSignature(request.value.id, pubKey, signature);
    request.value = updated;
    uni.showToast({ title: t("toastSignSuccess"), icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: t("toastSignFailed"), icon: "none" });
  } finally {
    isProcessing.value = false;
  }
};

const broadcast = async () => {
  if (!request.value) return;
  isProcessing.value = true;
  try {
    if (!isComplete.value) {
      uni.showToast({ title: t("toastNotEnoughSignatures"), icon: "none" });
      return;
    }

    const txn = tx.Transaction.deserialize(request.value.transaction_hex);
    const client = getRpcClient(request.value.chain_id);
    const currentHeight = await client.getBlockCount();
    if (currentHeight >= txn.validUntilBlock) {
      await api.updateStatus(request.value.id, "expired");
      request.value.status = "expired";
      uni.showToast({ title: t("toastExpired"), icon: "none" });
      return;
    }

    const verification = buildVerificationScript(request.value.threshold, request.value.signers);
    const orderedKeys = verification.publicKeys;
    const orderedSigs = orderedKeys
      .map((key) => request.value?.signatures?.[key])
      .filter((sig): sig is string => !!sig);

    if (orderedSigs.length < request.value.threshold) {
      uni.showToast({ title: t("toastNotEnoughSignatures"), icon: "none" });
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
    const index = history.findIndex((item: any) => item.id === request.value?.id);
    if (index >= 0) {
      history[index].status = "broadcasted";
      uni.setStorageSync("multisig_history", JSON.stringify(history));
    }

    uni.showToast({ title: t("toastBroadcastSuccess"), icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: t("toastBroadcastFailed"), icon: "none" });
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

  &.pending { color: var(--status-warning); }
  &.ready { color: var(--status-info); }
  &.broadcasted { color: var(--multisig-accent); }
  &.cancelled { color: var(--status-error); }
  &.expired { color: var(--text-muted); }
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

.details-card,
.signers-card {
  margin-bottom: 24px;
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  display: block;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.label {
  color: var(--text-secondary);
}

.value {
  font-family: $font-mono;
  text-align: right;
}

.raw-data {
  margin-top: 16px;
}

.raw-input {
  width: 100%;
  height: 80px;
  background: var(--multisig-input-bg);
  border: 1px solid var(--multisig-border);
  border-radius: 8px;
  padding: 8px;
  font-size: 10px;
  font-family: $font-mono;
  color: var(--text-secondary);
}

.signer-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--multisig-surface);
  border-radius: 8px;
}

.signer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signer-key {
  font-family: $font-mono;
  font-size: 12px;
}

.signer-address {
  font-size: 11px;
  color: var(--text-secondary);
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 6px;

  &.signed { background: var(--multisig-accent-strong); color: var(--multisig-accent-text); }
  &.pending { background: var(--multisig-surface-strong); color: var(--text-secondary); }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.broadcast-success {
  margin-top: 16px;
  text-align: center;
}

.success-text {
  color: var(--multisig-accent);
  font-weight: 700;
}

.tx-id {
  font-size: 12px;
  color: var(--text-secondary);
  text-decoration: underline;
  display: block;
  margin-top: 4px;
}
</style>
