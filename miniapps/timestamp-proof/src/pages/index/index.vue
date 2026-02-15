<template>
  <MiniAppPage
    name="timestamp-proof"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="errorStatus"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <!-- Mobile: Quick Stats -->
      <StatsDisplay :items="mobileStats" layout="grid" class="mobile-stats" />

      <ProofList :proofs="proofs" />
    </template>

    <template #operation>
      <ProofCreateForm v-model:content="proofContent" :is-creating="isCreating" @create="createProof" />
    </template>

    <template #tab-verify>
      <ProofVerify
        v-model:proof-id="verifyId"
        :is-verifying="isVerifying"
        :verified-proof="verifiedProof"
        :verify-error="verifyError"
        @verify="verifyProof"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, StatsDisplay } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useTimestampProofContract } from "@/composables/useTimestampProof";
import ProofList from "./components/ProofList.vue";

const proofContent = ref("");
const verifyId = ref("");

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status: errorStatus,
  setStatus: setErrorStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "timestamp-proof",
  messages,
  template: {
    tabs: [
      { key: "proofs", labelKey: "proofs", icon: "🕐", default: true },
      { key: "verify", labelKey: "verify", icon: "✅" },
    ],
  },
  sidebarItems: [
    { labelKey: "totalProofs", value: () => proof.proofs.value.length },
    { labelKey: "yourProofs", value: () => proof.myProofsCount.value },
    { labelKey: "latestId", value: () => (proof.proofs.value.length > 0 ? `#${proof.proofs.value[0].id}` : "—") },
  ],
  sidebarTitleKey: "proofStats",
  statusTimeoutMs: 5000,
});

const proof = useTimestampProofContract(t);
const { proofs, verifiedProof, verifyError, isCreating, isVerifying, myProofsCount, loadProofs } = proof;

const mobileStats = computed<StatsDisplayItem[]>(() => [
  { label: t("totalProofs"), value: proofs.value.length },
  { label: t("yourProofs"), value: myProofsCount.value },
]);

const createProof = async () => {
  await proof.createProof(proofContent.value, setErrorStatus, () => {
    proofContent.value = "";
  });
};

const verifyProof = async () => {
  await proof.verifyProofById(verifyId.value);
};

onMounted(async () => {
  await loadProofs();
});

const appState = computed(() => ({}));

const resetAndReload = async () => {
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
