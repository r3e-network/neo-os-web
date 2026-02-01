<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-memorial-shrine" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />
    <!-- Memorials Tab -->
    <view v-if="activeTab === 'memorials'" class="tab-content cemetery-bg">
      <view class="header">
        <text class="title">🕯️ {{ t("title") }}</text>
        <text class="tagline">{{ t("tagline") }}</text>
        <text class="subtitle">{{ t("subtitle") }}</text>
      </view>

      <view class="obituary-banner" v-if="recentObituaries.length">
        <text class="banner-title">📜 {{ t("obituaries") }}</text>
        <scroll-view scroll-x class="banner-scroll">
          <view v-for="ob in recentObituaries" :key="ob.id" class="obituary-item" @click="openMemorial(ob.id)">
            <text class="name">{{ ob.name }}</text>
            <text class="text">{{ ob.text }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="memorials-grid">
        <TombstoneCard
          v-for="memorial in memorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </view>
    </view>

    <!-- My Tributes Tab -->
    <view v-if="activeTab === 'tributes'" class="tab-content cemetery-bg">
      <view class="section-header">
        <text class="section-title">🙏 {{ t("myTributes") }}</text>
        <text class="section-desc">{{ t("myTributesDesc") }}</text>
      </view>
      <view class="memorials-grid" v-if="visitedMemorials.length">
        <TombstoneCard
          v-for="memorial in visitedMemorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </view>
      <view v-else class="empty-state">
        <text>{{ t("noTributes") }}</text>
      </view>
    </view>

    <!-- Create Tab -->
    <view v-if="activeTab === 'create'" class="tab-content cemetery-bg">
      <CreateMemorialForm @created="onMemorialCreated" />
    </view>

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable cemetery-bg">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>

    <!-- Memorial Detail Modal -->
    <MemorialDetailModal
      v-if="selectedMemorial"
      :memorial="selectedMemorial"
      :offerings="offerings"
      @close="closeMemorial"
      @tribute-paid="onTributePaid"
      @share="shareMemorial"
    />

    <!-- Share Toast -->
    <view v-if="shareStatus" class="share-toast">
      <text>{{ shareStatus }}</text>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { readQueryParam } from "@shared/utils/url";
import { ResponsiveLayout, NeoDoc, ChainWarning } from "@shared/components";
import TombstoneCard from "./components/TombstoneCard.vue";
import CreateMemorialForm from "./components/CreateMemorialForm.vue";
import MemorialDetailModal from "./components/MemorialDetailModal.vue";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

const { t } = useI18n();

const navTabs = computed(() => [
  { id: "memorials", icon: "home", label: t("memorials") },
  { id: "tributes", icon: "heart", label: t("myTributes") },
  { id: "create", icon: "plus", label: t("create") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("memorials");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const APP_ID = "miniapp-memorial-shrine";
const { address, connect, invokeContract, invokeRead, getContractAddress } = useWallet() as WalletSDK;
const { isLoading } = usePaymentFlow(APP_ID);

interface Memorial {
  id: number;
  name: string;
  photoHash: string;
  birthYear: number;
  deathYear: number;
  relationship: string;
  biography: string;
  obituary: string;
  hasRecentTribute: boolean;
  offerings: {
    incense: number;
    candle: number;
    flower: number;
    fruit: number;
    wine: number;
    feast: number;
  };
}

const offerings = [
  { type: 1, nameKey: "incense", icon: "🕯️", cost: 0.01 },
  { type: 2, nameKey: "candle", icon: "🕯", cost: 0.02 },
  { type: 3, nameKey: "flower", icon: "🌸", cost: 0.03 },
  { type: 4, nameKey: "fruit", icon: "🍇", cost: 0.05 },
  { type: 5, nameKey: "wine", icon: "🍶", cost: 0.1 },
  { type: 6, nameKey: "feast", icon: "🍱", cost: 0.5 },
];

const memorials = ref<Memorial[]>([]);
const visitedMemorials = ref<Memorial[]>([]);
const recentObituaries = ref<{ id: number; name: string; text: string }[]>([]);
const selectedMemorial = ref<Memorial | null>(null);
const contractAddress = ref<string | null>(null);
const shareStatus = ref<string | null>(null);

const ensureContract = async () => {
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  return contractAddress.value;
};

const loadMemorials = async () => {
  // Demo data - in production, load from contract
  memorials.value = [
    {
      id: 1,
      name: "张德明",
      photoHash: "",
      birthYear: 1938,
      deathYear: 2024,
      relationship: "父亲",
      biography: "一生勤劳朴实，热爱家庭。",
      obituary: "",
      hasRecentTribute: true,
      offerings: { incense: 128, candle: 45, flower: 56, fruit: 34, wine: 12, feast: 3 },
    },
    {
      id: 2,
      name: "李淑芬",
      photoHash: "",
      birthYear: 1942,
      deathYear: 2023,
      relationship: "母亲",
      biography: "慈母一生为家庭奉献。",
      obituary: "",
      hasRecentTribute: true,
      offerings: { incense: 89, candle: 32, flower: 67, fruit: 21, wine: 8, feast: 2 },
    },
    {
      id: 3,
      name: "王建国",
      photoHash: "",
      birthYear: 1950,
      deathYear: 2022,
      relationship: "爷爷",
      biography: "老革命，一生正直。",
      obituary: "",
      hasRecentTribute: false,
      offerings: { incense: 56, candle: 23, flower: 34, fruit: 12, wine: 5, feast: 1 },
    },
  ];

  recentObituaries.value = [
    { id: 1, name: "张老先生", text: "张老先生于2024年1月驾鹤西去" },
    { id: 2, name: "李奶奶", text: "慈母李奶奶安详离世" },
  ];
};

const loadVisitedMemorials = async () => {
  // Demo data
  visitedMemorials.value = memorials.value.slice(0, 2);
};

const openMemorial = (id: number) => {
  const memorial = memorials.value.find((m) => m.id === id);
  if (memorial) {
    selectedMemorial.value = memorial;
    // Update URL with memorial ID
    updateUrlWithMemorial(id);
  }
};

const closeMemorial = () => {
  selectedMemorial.value = null;
  // Clear URL param
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());
  }
};

const updateUrlWithMemorial = (id: number) => {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.set("id", String(id));
    window.history.replaceState({}, "", url.toString());
  }
};

const shareMemorial = (memorial?: Memorial) => {
  const target = memorial || selectedMemorial.value;
  if (!target || typeof window === "undefined") return;

  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${target.id}`;

  // Try native share API first
  if (navigator.share) {
    navigator
      .share({
        title: `${target.name} - ${t("title")}`,
        text: `${t("tagline")} | ${target.name} (${target.birthYear}-${target.deathYear})`,
        url: shareUrl,
      })
      .catch(() => {
        // Fallback to clipboard
        copyToClipboard(shareUrl);
      });
  } else {
    copyToClipboard(shareUrl);
  }
};

const copyToClipboard = (text: string) => {
  uni.setClipboardData({
    data: text,
    success: () => {
      shareStatus.value = t("linkCopied");
      setTimeout(() => {
        shareStatus.value = null;
      }, 3000);
    },
  });
};

const checkUrlForMemorial = async () => {
  const idParam = readQueryParam("id");
  if (idParam) {
    const id = parseInt(idParam, 10);
    if (!isNaN(id)) {
      // Wait for memorials to load
      await loadMemorials();
      const memorial = memorials.value.find((m) => m.id === id);
      if (memorial) {
        selectedMemorial.value = memorial;
      }
    }
  }
};

const onMemorialCreated = async (data: any) => {
  // Refresh memorials list
  await loadMemorials();
  activeTab.value = "memorials";
};

const onTributePaid = async (memorialId: number, offeringType: number) => {
  // Refresh memorial data
  await loadMemorials();
  if (selectedMemorial.value?.id === memorialId) {
    selectedMemorial.value = memorials.value.find((m) => m.id === memorialId) || null;
  }
};

onMounted(async () => {
  await checkUrlForMemorial();
  await loadVisitedMemorials();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./memorial-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.tab-content {
  padding: 16px;
  min-height: 100vh;
}

.cemetery-bg {
  background: linear-gradient(180deg, var(--shrine-bg) 0%, var(--shrine-dark) 50%, var(--shrine-medium) 100%);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: radial-gradient(ellipse at 80% 20%, var(--shrine-banner-glow), transparent);
    pointer-events: none;
  }
}

.header {
  text-align: center;
  padding: 32px 16px;

  .title {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: var(--shrine-gold);
    text-shadow: 0 0 30px var(--shrine-title-glow);
    margin-bottom: 8px;
  }

  .tagline {
    display: block;
    font-size: 16px;
    color: var(--shrine-gold-light);
    letter-spacing: 6px;
    margin-bottom: 8px;
  }

  .subtitle {
    display: block;
    font-size: 13px;
    color: var(--shrine-muted);
  }
}

.obituary-banner {
  background: linear-gradient(90deg, var(--shrine-dark), var(--shrine-medium), var(--shrine-dark));
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  border: 1px solid var(--shrine-banner-border);

  .banner-title {
    display: block;
    font-size: 13px;
    color: var(--shrine-gold);
    margin-bottom: 8px;
  }

  .banner-scroll {
    white-space: nowrap;
  }

  .obituary-item {
    display: inline-block;
    margin-right: 32px;
    font-size: 12px;
    color: var(--shrine-muted);

    .name {
      color: var(--shrine-text);
      margin-right: 8px;
    }
  }
}

.memorials-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.section-header {
  text-align: center;
  margin-bottom: 24px;

  .section-title {
    display: block;
    font-size: 20px;
    color: var(--shrine-gold);
    margin-bottom: 8px;
  }

  .section-desc {
    display: block;
    font-size: 13px;
    color: var(--shrine-muted);
  }
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--shrine-muted);
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}


// Desktop sidebar
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
