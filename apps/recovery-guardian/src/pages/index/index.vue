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
      </div>
      <pre class="json-box">{{ renderedPayload }}</pre>
    </template>
    <template #operation>
      <div class="stack">
        <NeoInput v-model="accountAddress" :label="t('accountAddress')" :placeholder="t('accountAddressPlaceholder')" />
        <NeoInput v-model="verifierHashOverride" :label="t('verifierHash')" :placeholder="t('verifierHashPlaceholder')" />
        <div class="button-row">
          <NeoButton variant="primary" type="button" :loading="isQuerying" @click="queryGuardianState" :aria-label="t('queryState')">{{ t("queryState") }}</NeoButton>
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
import { getExternalIntegrationConfig, getNetwork } from "@shared/constants/rpc";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { messages } from "@/locale/messages";

const network = getNetwork();
const integration = getExternalIntegrationConfig(network);
const aaCore = integration.contracts.aaCore;
const identityWorkspaceUrl = "https://neo-abstract-account.vercel.app/identity";
const aaWorkspaceUrl = "https://neo-abstract-account.vercel.app/app";
const recoveryDocsUrl = "https://neo-abstract-account.vercel.app/docs";

const accountAddress = ref("");
const verifierHashOverride = ref("");
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
</style>
