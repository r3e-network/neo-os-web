<template>
  <ConsoleMiniApp
    page-name="recovery-guardian"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :on-retry="queryGuardianState"
    hero-icon="shield"
    :hero-stats="heroStats"
    :overview-stats="overviewStats"
    :result-title="t('latestState')"
    :operation-title="t('guardianState')"
  >
    <template #result>
      <div v-if="latestPayload" class="note-box">
        <p class="note-title">{{ t("noteTitle") }}</p>
        <p class="note-text">{{ t("noteText") }}</p>
        <div v-if="previewUrl" class="link-box">
          <p class="link-label">{{ t("openRecoveryPreview") }}</p>
          <p class="link-value">{{ previewUrl }}</p>
          <div class="link-actions">
            <NeoButton variant="secondary" size="sm" type="button" @click="copyRecoveryPreviewLink" :aria-label="t('copyRecoveryLink')">{{ t("copyRecoveryLink") }}</NeoButton>
            <NeoButton variant="secondary" size="sm" type="button" @click="shareRecoveryPreviewLink" :aria-label="t('shareRecoveryLink')">{{ t("shareRecoveryLink") }}</NeoButton>
          </div>
        </div>
        <div v-if="credentialUrl" class="link-box">
          <p class="link-label">{{ t("openRecoveryCredential") }}</p>
          <p class="link-value">{{ credentialUrl }}</p>
          <div class="link-actions">
            <NeoButton variant="secondary" size="sm" type="button" @click="copyRecoveryCredentialLink" :aria-label="t('copyRecoveryCredential')">{{ t("copyRecoveryCredential") }}</NeoButton>
            <NeoButton variant="secondary" size="sm" type="button" @click="shareRecoveryCredentialLink" :aria-label="t('shareRecoveryCredential')">{{ t("shareRecoveryCredential") }}</NeoButton>
          </div>
        </div>
      </div>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="accountAddress" :label="t('accountAddress')" :placeholder="t('accountAddressPlaceholder')" />
        <NeoInput v-model="verifierHashOverride" :label="t('verifierHash')" :placeholder="t('verifierHashPlaceholder')" />
        <NeoInput v-model="recoveryNewOwner" :label="t('newOwner')" :placeholder="t('newOwnerPlaceholder')" />
        <NeoInput v-model="recoveryExpiryMinutes" :label="t('recoveryExpiry')" :placeholder="t('recoveryExpiryPlaceholder')" />
        <NeoInput v-model="recoveryTemplateId" :label="t('recoveryTemplateId')" :placeholder="t('recoveryTemplateIdPlaceholder')" />
        <div class="button-row">
          <NeoButton variant="primary" type="button" :loading="isQuerying" @click="queryGuardianState" :aria-label="t('queryState')">{{ t("queryState") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openRecoveryPreviewLink" :aria-label="t('openRecoveryPreview')">{{ t("openRecoveryPreview") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="copyRecoveryPreviewLink" :aria-label="t('copyRecoveryLink')">{{ t("copyRecoveryLink") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="shareRecoveryPreviewLink" :aria-label="t('shareRecoveryLink')">{{ t("shareRecoveryLink") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openRecoveryCredentialLink" :aria-label="t('openRecoveryCredential')">{{ t("openRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="copyRecoveryCredentialLink" :aria-label="t('copyRecoveryCredential')">{{ t("copyRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="shareRecoveryCredentialLink" :aria-label="t('shareRecoveryCredential')">{{ t("shareRecoveryCredential") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openExternal(identityWorkspaceUrl)" :aria-label="t('openIdentityWorkspace')">{{ t("openIdentityWorkspace") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openExternal(aaWorkspaceUrl)" :aria-label="t('openAaWorkspace')">{{ t("openAaWorkspace") }}</NeoButton>
          <NeoButton variant="secondary" type="button" @click="openExternal(recoveryDocsUrl)" :aria-label="t('openRecoveryDocs')">{{ t("openRecoveryDocs") }}</NeoButton>
        </div>
      </div>
    </template>
  </ConsoleMiniApp>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ConsoleMiniApp, NeoButton, NeoInput } from "@shared/components";
import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";
import { createConsolePage } from "@shared/utils/createConsolePage";
import { buildAAHeroStats, buildAAOverviewStats } from "@shared/utils/console-stats";
import {
  getAADocsUrl,
  getAAAppWorkspaceUrl,
  getAAIdentityWorkspaceUrl,
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";
import { CREDENTIAL_REGISTRY } from "@shared/constants";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { messages } from "@/locale/messages";

const network = getNetwork();
const integration = getExternalIntegrationConfig(network);
const aaCore = integration.contracts.aaCore;
const identityWorkspaceUrl = getAAIdentityWorkspaceUrl(network);
const aaWorkspaceUrl = getAAAppWorkspaceUrl(network);
const recoveryDocsUrl = getAADocsUrl(network);
const soulboundAppUrl = "/miniapps/soulbound-certificate/index.html";
const recoveryCredential = CREDENTIAL_REGISTRY.recovery_audit;

const accountAddress = ref("");
const verifierHashOverride = ref("");
const recoveryNewOwner = ref("");
const recoveryExpiryMinutes = ref("30");
const recoveryTemplateId = ref("");
const latestPayload = ref<Record<string, unknown> | null>(null);
const isQuerying = ref(false);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } = createConsolePage({
  name: "recovery-guardian",
  messages,
  tab: { key: "guardian", labelKey: "latestState", icon: "🛡️" },
  sidebarItems: [
    { labelKey: "accountId", value: () => String(latestPayload.value?.account_id || t("notAvailable")) },
    { labelKey: "currentVerifier", value: () => String(latestPayload.value?.verifier_hash || t("notAvailable")) },
    { labelKey: "threshold", value: () => String(latestPayload.value?.threshold || t("notAvailable")) },
    { labelKey: "timelockLabel", value: () => String(latestPayload.value?.timelock || t("notAvailable")) },
  ],
});

function sanitizeHex(value: string): string {
  return String(value || "").trim().replace(/^0x/i, "").toLowerCase();
}

function normalizeHash160(value: string): string {
  const raw = String(value || "").trim();
  const normalized = raw.startsWith("N") ? addressToScriptHash(raw) : normalizeScriptHash(raw);
  const hex = sanitizeHex(normalized);
  if (!/^[0-9a-f]{40}$/.test(hex)) {
    throw new Error("invalid hash160");
  }
  return `0x${hex}`;
}

function decodeBase64Hex(value: string): string {
  const binary = globalThis.atob ? globalThis.atob(value) : "";
  return Array.from(binary, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

function decodeUtf8(value: string): string {
  const binary = globalThis.atob ? globalThis.atob(value) : "";
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function maybeDecodeByteString(value: string): string {
  const hex = decodeBase64Hex(value);
  if (!hex) return "";
  if (hex.length === 40) return `0x${hex}`;
  try {
    const text = decodeUtf8(value);
    if (/^[\x20-\x7E\s]+$/.test(text)) return text;
  } catch {
    // ignore
  }
  return `0x${hex}`;
}

function decodeStackItem(item: unknown): unknown {
  if (!item || typeof item !== "object") return null;
  const typed = item as { type?: string; value?: unknown };
  switch (typed.type) {
    case "Integer":
      return String(typed.value ?? "0");
    case "Boolean":
      return Boolean(typed.value);
    case "Hash160":
    case "Hash256":
    case "String":
      return String(typed.value ?? "");
    case "ByteArray":
    case "ByteString":
      return typeof typed.value === "string" ? maybeDecodeByteString(typed.value) : "";
    case "Array":
    case "Struct":
      return Array.isArray(typed.value) ? typed.value.map((entry) => decodeStackItem(entry)) : [];
    default:
      return typed.value ?? null;
  }
}

async function invokeReadFunction(scriptHash: string, operation: string, args: Array<Record<string, unknown>> = []) {
  const response = await fetch(integration.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [scriptHash, operation, args],
    }),
  });
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || `RPC ${operation} failed`);
  }
  return payload.result;
}

async function readSingle(scriptHash: string, operation: string, args: Array<Record<string, unknown>> = []) {
  const result = await invokeReadFunction(scriptHash, operation, args);
  return decodeStackItem(result?.stack?.[0]);
}

function toByteArrayParam(hexValue: string) {
  return { type: "ByteArray", value: `0x${sanitizeHex(hexValue)}` };
}

function formatTimestamp(value: unknown): string {
  const numeric = Number(String(value ?? "0"));
  if (!Number.isFinite(numeric) || numeric <= 0) return t("notAvailable");
  const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  return new Date(ms).toISOString();
}

async function queryGuardianState() {
  if (!String(accountAddress.value || "").trim()) {
    setStatus(t("queryFailed"), "error");
    return;
  }

  isQuerying.value = true;
  try {
    const accountHash = normalizeHash160(accountAddress.value);
    const accountId = await readSingle(aaCore, "getAccountIdByAddress", [{ type: "Hash160", value: accountHash }]);
    const resolvedVerifier = verifierHashOverride.value
      ? normalizeHash160(verifierHashOverride.value)
      : String(await readSingle(aaCore, "getVerifierContractByAddress", [{ type: "Hash160", value: accountHash }]) || "");

    if (!resolvedVerifier || resolvedVerifier === "0x") {
      latestPayload.value = {
        network,
        aa_core: aaCore,
        account_hash: accountHash,
        account_id: accountId || "",
        verifier_hash: "",
        note: "No verifier bound for this account address.",
      };
      setStatus(t("queryLoaded"), "success");
      return;
    }

    const accountIdParam = toByteArrayParam(String(accountId || ""));
    const [owner, morpheusOracle, recoveryNonce, sessionNonce, threshold, timelock, pendingRecovery, activeSession] = await Promise.all([
      readSingle(resolvedVerifier, "getOwner", [accountIdParam]),
      readSingle(resolvedVerifier, "getMorpheusOracle", [accountIdParam]).catch(() => ""),
      readSingle(resolvedVerifier, "getRecoveryNonce", [accountIdParam]).catch(() => "0"),
      readSingle(resolvedVerifier, "getSessionNonce", [accountIdParam]).catch(() => "0"),
      readSingle(resolvedVerifier, "getThreshold", [accountIdParam]).catch(() => "0"),
      readSingle(resolvedVerifier, "getTimelock", [accountIdParam]).catch(() => "0"),
      readSingle(resolvedVerifier, "getPendingRecovery", [accountIdParam]).catch(() => []),
      readSingle(resolvedVerifier, "getActiveSession", [accountIdParam]).catch(() => []),
    ]);

    const pending = Array.isArray(pendingRecovery)
      ? {
          new_owner: pendingRecovery[0] || "",
          recovery_nonce: pendingRecovery[1] || "0",
          approved_count: pendingRecovery[2] || "0",
          initiated_at: pendingRecovery[3] || "0",
          executable_at: pendingRecovery[4] || "0",
          active: Boolean(pendingRecovery[5]),
          executable_at_iso: formatTimestamp(pendingRecovery[4]),
        }
      : null;

    const session = Array.isArray(activeSession)
      ? {
          executor: activeSession[0] || "",
          action_id: activeSession[1] || "",
          action_nullifier: activeSession[2] || "",
          expires_at: activeSession[3] || "0",
          active: Boolean(activeSession[4]),
          expires_at_iso: formatTimestamp(activeSession[3]),
        }
      : null;

    latestPayload.value = {
      network,
      rpc_url: integration.rpcUrl,
      aa_core: aaCore,
      account_hash: accountHash,
      account_id: accountId,
      verifier_hash: resolvedVerifier,
      owner,
      morpheus_oracle: morpheusOracle,
      recovery_nonce: recoveryNonce,
      session_nonce: sessionNonce,
      threshold,
      timelock,
      timelock_seconds: String(timelock || "0"),
      pending_recovery: pending,
      active_session: session,
    };

    setStatus(t("queryLoaded"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("queryFailed")), "error");
  } finally {
    isQuerying.value = false;
  }
}

function openExternal(url: string) {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function buildRecoveryPreviewUrl() {
  const accountHash = String(latestPayload.value?.account_hash || "").trim() || normalizeHash160(accountAddress.value);
  const verifierHash = String(latestPayload.value?.verifier_hash || "").trim() || (verifierHashOverride.value ? normalizeHash160(verifierHashOverride.value) : "");
  const newOwner = String(recoveryNewOwner.value || "").trim();
  if (!accountHash || !verifierHash || !newOwner) {
    throw new Error("account, verifier, and new owner are required");
  }

  const params = new URLSearchParams({
    account: accountHash,
    recoveryVerifier: verifierHash,
    recoveryNewOwner: newOwner,
    recoveryExpiryMinutes: String(recoveryExpiryMinutes.value || "30"),
    autoPreviewRecovery: "1",
  });
  return `${identityWorkspaceUrl}?${params.toString()}`;
}

function buildRecoveryCredentialUrl() {
  const accountHash = String(latestPayload.value?.account_hash || "").trim() || normalizeHash160(accountAddress.value);
  const accountId = String(latestPayload.value?.account_id || "").trim();
  const verifierHash = String(latestPayload.value?.verifier_hash || "").trim() || (verifierHashOverride.value ? normalizeHash160(verifierHashOverride.value) : "");
  if (!accountHash || !verifierHash) {
    throw new Error("account and verifier are required");
  }

  const pending = latestPayload.value?.pending_recovery as { new_owner?: string; active?: boolean } | undefined;
  const recipient = String(recoveryNewOwner.value || pending?.new_owner || latestPayload.value?.owner || "").trim();
  const params = new URLSearchParams({
    issueRecipient: recipient,
    issueRecipientName: "",
    issueAchievement: "Recovery Flow Verified",
    issueMemo: `AA ${accountId || accountHash} / verifier ${verifierHash}`,
    issueCategory: recoveryCredential.category,
    issueCredentialType: recoveryCredential.credentialType,
    issueIssuerPolicy: recoveryCredential.issuerPolicy,
    issueSource: "recovery-guardian",
    autoIssueDraft: "1",
  });
  if (recoveryTemplateId.value.trim()) {
    params.set("issueTemplateId", recoveryTemplateId.value.trim());
  }
  return `${soulboundAppUrl}?${params.toString()}`;
}

const previewUrl = computed(() => {
  try {
    return buildRecoveryPreviewUrl();
  } catch {
    return "";
  }
});

const credentialUrl = computed(() => {
  try {
    return buildRecoveryCredentialUrl();
  } catch {
    return "";
  }
});

function openRecoveryPreviewLink() {
  try {
    const url = previewUrl.value || buildRecoveryPreviewUrl();
    openExternal(url);
    setStatus(t("previewLinkReady"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("queryFailed")), "error");
  }
}

function openRecoveryCredentialLink() {
  try {
    const url = credentialUrl.value || buildRecoveryCredentialUrl();
    openExternal(url);
    setStatus(t("credentialLinkReady"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("queryFailed")), "error");
  }
}

async function copyRecoveryPreviewLink() {
  const url = previewUrl.value;
  if (!url) {
    setStatus(t("previewLinkUnavailable"), "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus(t("previewLinkCopied"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("queryFailed")), "error");
  }
}

async function shareRecoveryPreviewLink() {
  const url = previewUrl.value;
  if (!url) {
    setStatus(t("previewLinkUnavailable"), "error");
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: t("title"),
        text: t("subtitle"),
        url,
      });
      setStatus(t("previewLinkShared"), "success");
      return;
    }
    await copyRecoveryPreviewLink();
  } catch (error: unknown) {
    if (error instanceof Error && /abort|cancel/i.test(error.message)) {
      return;
    }
    await copyRecoveryPreviewLink();
  }
}

async function copyRecoveryCredentialLink() {
  const url = credentialUrl.value;
  if (!url) {
    setStatus(t("previewLinkUnavailable"), "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus(t("credentialLinkCopied"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("queryFailed")), "error");
  }
}

async function shareRecoveryCredentialLink() {
  const url = credentialUrl.value;
  if (!url) {
    setStatus(t("previewLinkUnavailable"), "error");
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: t("openRecoveryCredential"),
        text: t("openRecoveryCredential"),
        url,
      });
      setStatus(t("credentialLinkShared"), "success");
      return;
    }
    await copyRecoveryCredentialLink();
  } catch (error: unknown) {
    if (error instanceof Error && /abort|cancel/i.test(error.message)) {
      return;
    }
    await copyRecoveryCredentialLink();
  }
}

const renderedPayload = computed(() =>
  latestPayload.value ? JSON.stringify(latestPayload.value, null, 2) : t("noStateYet"),
);

const heroStats = computed<HeroStatsStripItem[]>(() =>
  buildAAHeroStats({
    aaCore,
    middleLabel: t("currentVerifier"),
    middleValue: String(latestPayload.value?.verifier_hash || t("notAvailable")),
    trailingLabel: "Network",
    trailingValue: network,
  }),
);

const overviewStats = computed<StatsDisplayItem[]>(() =>
  buildAAOverviewStats({
    aaCore,
    extra: {
      label: t("oracle"),
      value: String(latestPayload.value?.morpheus_oracle || t("notAvailable")),
      variant: "erobo",
    },
  }),
);

const appState = computed(() => ({
  network,
  accountHash: latestPayload.value?.account_hash || "",
  accountId: latestPayload.value?.account_id || "",
  verifierHash: latestPayload.value?.verifier_hash || "",
  previewUrl: previewUrl.value,
  credentialUrl: credentialUrl.value,
  recoveryTemplateId: recoveryTemplateId.value,
  recoveryNewOwner: recoveryNewOwner.value,
  recoveryExpiryMinutes: recoveryExpiryMinutes.value,
  pendingRecoveryActive: Boolean((latestPayload.value?.pending_recovery as { active?: boolean } | undefined)?.active),
  activeSessionActive: Boolean((latestPayload.value?.active_session as { active?: boolean } | undefined)?.active),
}));
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.stack { @include console.stack; }
.button-row { @include console.button-grid(2); }
.json-box {
  @include console.json-box(520px);
  white-space: pre-wrap;
  word-break: break-word;
}
.note-box {
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}
.note-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.note-text {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.8;
}
.link-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.link-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.link-value {
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.88;
  word-break: break-all;
}
.link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}
</style>
