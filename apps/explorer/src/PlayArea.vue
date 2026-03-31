<template>
  <div class="explorer-play-area">
    <SearchPanel
      :t="t"
      :searchQuery="searchQuery"
      :selectedNetwork="selectedNetwork"
      :isSearching="isSearching"
      @update:searchQuery="searchQuery = $event"
      @update:selectedNetwork="selectedNetwork = $event"
      @search="handleSearch"
    />

    <!-- ── Loading State ── -->
    <div v-if="isSearching" class="loading" role="status" aria-live="polite">
      <span>{{ t("searching") }}</span>
    </div>

    <SearchResultDisplay
      :t="t"
      :result="searchResult"
      :formatTime="formatTime"
    />

    <RecentTransactions
      :t="t"
      :transactions="recentTxs"
      :formatTime="formatTime"
      :truncateHash="truncateHash"
      @viewTx="handleViewTx"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Composition root for Explorer
 *
 * Composes SearchPanel, SearchResultDisplay, and RecentTransactions.
 * Everything else (sidebar, stats, docs, shell chrome) is rendered
 * by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import SearchPanel from "./components/SearchPanel.vue";
import SearchResultDisplay from "./components/SearchResultDisplay.vue";
import RecentTransactions from "./components/RecentTransactions.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const searchQuery = computed({
  get: () => String(props.state.searchQuery?.value ?? ""),
  set: (val: string) => {
    if (props.state.searchQuery) (props.state.searchQuery as Ref<string>).value = val;
  },
});
const selectedNetwork = computed({
  get: () => (props.state.selectedNetwork?.value as "mainnet" | "testnet") ?? "mainnet",
  set: (val: "mainnet" | "testnet") => {
    if (props.state.selectedNetwork) (props.state.selectedNetwork as Ref<string>).value = val;
  },
});
const isSearching = computed(() => Boolean(props.state.isSearching?.value ?? false));
const searchResult = computed(() => props.state.searchResult?.value as Record<string, unknown> | null);
const recentTxs = computed(() => {
  const raw = props.state.recentTxs?.value;
  return Array.isArray(raw) ? raw : [];
});

// ── Helpers ───────────────────────────────────────────────────────────
const formatTime = (time: unknown) => {
  const dateStr = typeof time === "string" ? time : String(time ?? "");
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined).format(d);
};

const truncateHash = (hash: unknown) => {
  const str = typeof hash === "string" ? hash : String(hash ?? "");
  if (!str) return "";
  return `${str.slice(0, 10)}...${str.slice(-8)}`;
};

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleSearch = async () => {
  const handler = actions.get("search");
  if (handler) await handler();
};

const handleViewTx = async (hash: string) => {
  const handler = actions.get("viewTx");
  if (handler) await handler(hash);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/console-common" as console;

.explorer-play-area { @include console.play-area; min-height: 300px; }

.loading {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
}

@media (max-width: 480px) {
  .explorer-play-area { padding: 12px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .loading { animation: none; }
}
</style>
