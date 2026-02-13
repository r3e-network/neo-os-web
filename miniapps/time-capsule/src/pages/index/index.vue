<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    class="theme-time-capsule"
    @tab-change="activeTab = $event"
  >
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <template #content>
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
        <CapsuleList :capsules="capsules" :current-time="currentTime" :t="t" @open="handleOpen" />
      </ErrorBoundary>
    </template>

    <template #operation>
      <NeoCard variant="erobo-neo">
        <text class="helper-text">{{ t("fishDescription") }}</text>
        <NeoButton
          variant="secondary"
          size="md"
          block
          :loading="isBusy"
          :disabled="isBusy"
          class="mt-3"
          @click="handleFish"
        >
          {{ t("fishButton") }}
        </NeoButton>
      </NeoCard>
    </template>

    <template #tab-create>
      <CreateCapsuleForm
        v-model:title="newCapsule.title"
        v-model:content="newCapsule.content"
        v-model:days="newCapsule.days"
        v-model:is-public="newCapsule.isPublic"
        v-model:category="newCapsule.category"
        :is-loading="isBusy"
        :can-create="canCreate"
        :t="t"
        @create="handleCreate"
      />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoButton, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useCapsuleCreation } from "@/composables/useCapsuleCreation";
import { useCapsuleUnlock } from "@/composables/useCapsuleUnlock";
import CapsuleList, { type Capsule } from "./components/CapsuleList.vue";
import CreateCapsuleForm from "./components/CreateCapsuleForm.vue";

const { t } = useI18n();
const { address } = useWallet() as WalletSDK;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "capsules", labelKey: "tabCapsules", icon: "🔒", default: true },
    { key: "create", labelKey: "tabCreate", icon: "➕" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const appState = computed(() => ({}));

const sidebarItems = computed(() => {
  const total = capsules.value.length;
  const locked = capsules.value.filter((c) => c.locked).length;
  const revealed = capsules.value.filter((c) => c.revealed).length;
  return [
    { label: t("sidebarTotalCapsules"), value: total },
    { label: t("sidebarLocked"), value: locked },
    { label: t("sidebarRevealed"), value: revealed },
  ];
});

const activeTab = ref("capsules");

const capsules = ref<Capsule[]>([]);
const currentTime = ref(Date.now());
const isLoadingData = ref(false);

const { newCapsule, status: createStatus, isBusy: createBusy, canCreate, create } = useCapsuleCreation();
const { status: actionStatus, setStatus, clearStatus } = useStatusMessage(4000);
const status = computed(() => actionStatus.value ?? createStatus.value);
const {
  isBusy: unlockBusy,
  open,
  fish,
  ownerMatches,
  listAllEvents,
  ensureContractAddress,
  invokeRead,
  parseInvokeResult,
  localContent,
} = useCapsuleUnlock();

const isBusy = computed(() => createBusy.value || unlockBusy.value || isLoadingData.value);

let countdownInterval: number | null = null;

onMounted(() => {
  countdownInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000) as unknown as number;
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

watch(address, () => {
  fetchData();
}, { immediate: true });

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const buildCapsuleFromDetails = (
  id: string,
  data: Record<string, unknown>,
  fallback?: { unlockTime?: number; isPublic?: boolean }
) => {
  const contentHash = String(data.contentHash || "");
  const unlockTime = toNumber(data.unlockTime ?? fallback?.unlockTime ?? 0);
  const isPublic = typeof data.isPublic === "boolean" ? data.isPublic : Boolean(data.isPublic ?? fallback?.isPublic);
  const revealed = Boolean(data.isRevealed);
  const title = String(data.title || "");
  const unlockDate = unlockTime ? new Date(unlockTime * 1000).toISOString().split("T")[0] : "N/A";
  const content = contentHash ? localContent.value[contentHash] : "";

  return {
    id,
    title,
    contentHash,
    unlockDate,
    unlockTime,
    locked: !revealed && Date.now() < unlockTime * 1000,
    revealed,
    isPublic,
    content,
  } as Capsule;
};

const fetchData = async () => {
  if (!address.value) return;
  isLoadingData.value = true;
  try {
    const contract = await ensureContractAddress();
    const buriedEvents = await listAllEvents("CapsuleBuried");

    const userCapsules = await Promise.all(
      buriedEvents.map(async (evt) => {
        const values = Array.isArray(evt?.state) ? evt.state.map((s: unknown) => parseInvokeResult(s)) : [];
        const owner = values[0];
        const id = String(values[1] || "");
        const unlockTimeEvent = toNumber(values[2] || 0);
        const isPublicEvent = Boolean(values[3]);
        if (!id || !ownerMatches(owner)) return null;

        try {
          const capsuleRes = await invokeRead({
            scriptHash: contract,
            operation: "getCapsuleDetails",
            args: [{ type: "Integer", value: id }],
          });
          const parsed = parseInvokeResult(capsuleRes);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const data = parsed as Record<string, unknown>;
            return buildCapsuleFromDetails(id, data, { unlockTime: unlockTimeEvent, isPublic: isPublicEvent });
          }
        } catch {
          // fallback to event values
        }

        return buildCapsuleFromDetails(
          id,
          { contentHash: "", title: "", unlockTime: unlockTimeEvent, isPublic: isPublicEvent, isRevealed: false },
          { unlockTime: unlockTimeEvent, isPublic: isPublicEvent }
        );
      })
    );

    let resolvedCapsules = userCapsules.filter(Boolean) as Capsule[];

    if (resolvedCapsules.length === 0) {
      const totalRes = await invokeRead({
        scriptHash: contract,
        operation: "totalCapsules",
        args: [],
      });
      const totalCapsules = Number(parseInvokeResult(totalRes) || 0);
      const discovered: Capsule[] = [];
      for (let i = 1; i <= totalCapsules; i++) {
        const capsuleRes = await invokeRead({
          scriptHash: contract,
          operation: "getCapsuleDetails",
          args: [{ type: "Integer", value: String(i) }],
        });
        const parsed = parseInvokeResult(capsuleRes);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        const data = parsed as Record<string, unknown>;
        if (!ownerMatches(data.owner)) continue;
        discovered.push(buildCapsuleFromDetails(String(i), data));
      }
      resolvedCapsules = discovered;
    }

    capsules.value = resolvedCapsules.sort((a, b) => Number(b.id) - Number(a.id));
  } catch (e: unknown) {
    /* non-critical: capsule data fetch */
  } finally {
    isLoadingData.value = false;
  }
};

const handleCreate = async () => {
  await create(() => {
    activeTab.value = "capsules";
    fetchData();
  });
};

const handleOpen = async (cap: Capsule) => {
  await open(cap, (msg, type) => {
    setStatus(msg, type);
    if (type !== "error") {
      fetchData();
    }
  });
};

const handleFish = async () => {
  await fish((msg, type) => {
    setStatus(msg, type);
  });
};

const handleBoundaryError = (error: Error) => {
  console.error("[time-capsule] boundary error:", error);
};
const resetAndReload = async () => {
  if (address.value) fetchData();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./time-capsule-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.helper-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--capsule-cyan, var(--text-secondary));
  opacity: 0.8;
  letter-spacing: 0.05em;
}
</style>
