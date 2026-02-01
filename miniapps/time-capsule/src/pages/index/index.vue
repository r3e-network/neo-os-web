<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <view class="theme-time-capsule">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <view v-if="activeTab === 'capsules' || activeTab === 'create'" class="app-container">
        <NeoCard
          v-if="status"
          :variant="status.type === 'success' ? 'success' : status.type === 'loading' ? 'accent' : 'danger'"
          class="mb-4 text-center"
        >
          <text class="status-text font-bold uppercase tracking-wider">{{ status.msg }}</text>
        </NeoCard>

        <view v-if="activeTab === 'capsules'" class="tab-content">
          <NeoCard variant="erobo-neo" class="mb-4">
            <text class="helper-text neutral">{{ t("fishDescription") }}</text>
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
          <CapsuleList :capsules="capsules" :current-time="currentTime" :t="t as any" @open="handleOpen" />
        </view>

        <view v-if="activeTab === 'create'" class="tab-content">
          <CreateCapsuleForm
            v-model:title="newCapsule.title"
            v-model:content="newCapsule.content"
            v-model:days="newCapsule.days"
            v-model:is-public="newCapsule.isPublic"
            v-model:category="newCapsule.category"
            :is-loading="isBusy"
            :can-create="canCreate"
            :t="t as any"
            @create="handleCreate"
          />
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
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useCapsuleCreation } from "@/composables/useCapsuleCreation";
import { useCapsuleUnlock } from "@/composables/useCapsuleUnlock";
import CapsuleList, { type Capsule } from "./components/CapsuleList.vue";
import CreateCapsuleForm from "./components/CreateCapsuleForm.vue";

const { t } = useI18n();
const { address } = useWallet() as WalletSDK;

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const activeTab = ref("capsules");
const navTabs = computed<NavTab[]>(() => [
  { id: "capsules", icon: "lock", label: t("tabCapsules") },
  { id: "create", icon: "plus", label: t("tabCreate") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const capsules = ref<Capsule[]>([]);
const currentTime = ref(Date.now());
const isLoadingData = ref(false);

const { newCapsule, status, isBusy: createBusy, canCreate, create } = useCapsuleCreation();
const { isBusy: unlockBusy, open, fish, ownerMatches, listAllEvents, ensureContractAddress, invokeRead, parseInvokeResult, localContent } = useCapsuleUnlock();

const isBusy = computed(() => createBusy.value || unlockBusy.value || isLoadingData.value);

let countdownInterval: number | null = null;

onMounted(() => {
  fetchData();
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
});

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const buildCapsuleFromDetails = (
  id: string,
  data: Record<string, unknown>,
  fallback?: { unlockTime?: number; isPublic?: boolean },
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
        const values = Array.isArray(evt?.state) ? evt.state.map((s: any) => parseInvokeResult(s)) : [];
        const owner = values[0];
        const id = String(values[1] || "");
        const unlockTimeEvent = toNumber(values[2] || 0);
        const isPublicEvent = Boolean(values[3]);
        if (!id || !ownerMatches(owner)) return null;

        try {
          const capsuleRes = await invokeRead({
            contractAddress: contract,
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
          { unlockTime: unlockTimeEvent, isPublic: isPublicEvent },
        );
      }),
    );

    let resolvedCapsules = userCapsules.filter(Boolean) as Capsule[];

    if (resolvedCapsules.length === 0) {
      const totalRes = await invokeRead({
        contractAddress: contract,
        operation: "totalCapsules",
        args: [],
      });
      const totalCapsules = Number(parseInvokeResult(totalRes) || 0);
      const discovered: Capsule[] = [];
      for (let i = 1; i <= totalCapsules; i++) {
        const capsuleRes = await invokeRead({
          contractAddress: contract,
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
  } catch {
    // ignore
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
    status.value = { msg, type };
    if (type !== "error") {
      fetchData();
    }
  });
};

const handleFish = async () => {
  await fish((msg, type) => {
    status.value = { msg, type };
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./time-capsule-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--capsule-radial);
  min-height: 100vh;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--capsule-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--capsule-grid) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }
}

.tab-content {
  flex: 1;
  z-index: 1;
}

.helper-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--capsule-cyan);
  opacity: 0.8;
  letter-spacing: 0.05em;
}

:global(.theme-time-capsule) :deep(.neo-card) {
  background: var(--capsule-card-bg) !important;
  border: 1px solid var(--capsule-card-border) !important;
  box-shadow: var(--capsule-shadow) !important;
  border-radius: 8px !important;
  color: var(--capsule-text) !important;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 10px;
    height: 10px;
    border-top: 2px solid var(--capsule-corner);
    border-left: 2px solid var(--capsule-corner);
  }
}

:global(.theme-time-capsule) :deep(.neo-button) {
  border-radius: 4px !important;
  font-family: "JetBrains Mono", monospace !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;

  &.variant-primary {
    background: linear-gradient(90deg, var(--capsule-cyan) 0%, var(--capsule-cyan-strong) 100%) !important;
    color: var(--capsule-button-text) !important;
    box-shadow: var(--capsule-button-primary-shadow) !important;
  }

  &.variant-secondary {
    background: transparent !important;
    border: 1px solid var(--capsule-cyan) !important;
    color: var(--capsule-cyan) !important;

    &:hover {
      background: var(--capsule-button-hover) !important;
    }
  }
}

:global(.theme-time-capsule) :deep(.neo-input) {
  background: var(--capsule-input-bg) !important;
  border: 1px solid var(--capsule-input-border) !important;
  color: var(--capsule-input-text) !important;
  font-family: monospace !important;

  &:focus-within {
    border-color: var(--capsule-cyan) !important;
    box-shadow: 0 0 10px var(--capsule-input-focus) !important;
  }
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
