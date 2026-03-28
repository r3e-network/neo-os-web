<template>
  <div class="explorer-play-area">
    <!-- ── Search Panel ── -->
    <NeoCard variant="erobo-neo" class="search-card">
      <div class="search-box">
        <NeoInput
          :modelValue="searchQuery"
          @update:modelValue="searchQuery = $event"
          :placeholder="t('searchPlaceholder')"
          @confirm="handleSearch"
          class="search-input"
        />
        <NeoButton
          type="button"
          variant="primary"
          block
          :loading="isSearching"
          @click="handleSearch"
        >
          {{ t("search") }}
        </NeoButton>
      </div>

      <div class="network-toggle">
        <NeoButton
          :variant="selectedNetwork === 'mainnet' ? 'success' : 'secondary'"
          size="sm"
          class="toggle-btn"
          @click="selectedNetwork = 'mainnet'"
        >
          {{ t("mainnet") }}
        </NeoButton>
        <NeoButton
          :variant="selectedNetwork === 'testnet' ? 'warning' : 'secondary'"
          size="sm"
          class="toggle-btn"
          @click="selectedNetwork = 'testnet'"
        >
          {{ t("testnet") }}
        </NeoButton>
      </div>
    </NeoCard>

    <!-- ── Loading State ── -->
    <div v-if="isSearching" class="loading" role="status" aria-live="polite">
      <span>{{ t("searching") }}</span>
    </div>

    <!-- ── Search Result ── -->
    <div v-if="searchResult" class="result-section">
      <span class="section-title">{{ t("searchResult") }}</span>

      <!-- Transaction Result -->
      <NeoCard
        v-if="searchResult.type === 'transaction'"
        variant="erobo"
        class="result-card"
      >
        <div class="result-rows">
          <div class="result-row">
            <span class="label">{{ t("hash") }}</span>
            <span class="value mono">{{ searchResult.data?.hash }}</span>
          </div>
          <div class="result-row">
            <span class="label">{{ t("block") }}</span>
            <span class="value mono">{{ searchResult.data?.blockIndex }}</span>
          </div>
          <div class="result-row">
            <span class="label">{{ t("time") }}</span>
            <span class="value">{{ formatTime(searchResult.data?.blockTime) }}</span>
          </div>
          <div class="result-row">
            <span class="label">{{ t("sender") }}</span>
            <span class="value mono">{{ searchResult.data?.sender }}</span>
          </div>
        </div>
      </NeoCard>

      <!-- Address Result -->
      <NeoCard
        v-else-if="searchResult.type === 'address'"
        :title="t('address')"
        variant="erobo"
        class="result-card"
      >
        <div class="result-rows">
          <div class="result-row">
            <span class="label">{{ t("addressLabel") }}</span>
            <span class="value mono">{{ searchResult.data?.address }}</span>
          </div>
          <div class="result-row">
            <span class="label">{{ t("transactionsLabel") }}</span>
            <span class="value mono">{{ searchResult.data?.txCount }}</span>
          </div>
        </div>
      </NeoCard>
    </div>

    <!-- ── Recent Transactions ── -->
    <div class="recent-section">
      <span class="section-title">{{ t("recentTransactions") }}</span>
      <NeoCard
        v-for="tx in recentTxs"
        :key="tx.hash"
        variant="erobo"
        class="tx-card"
        hoverable
        @click="handleViewTx(tx.hash)"
      >
        <div class="tx-content">
          <div class="tx-info">
            <span class="tx-hash mono">{{ truncateHash(tx.hash) }}</span>
            <span :class="['vm-state', tx.vmState]">
              {{ tx.vmState === 'HALT' ? t('vmHalt') : t('vmFault') }}
            </span>
          </div>
          <span class="tx-time">{{ formatTime(tx.blockTime) }}</span>
        </div>
      </NeoCard>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Explorer
 *
 * Renders the search bar, search results, and recent transaction list.
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const searchQuery = computed({
  get: () => String(props.state.searchQuery?.value ?? ""),
  set: (val: string) => {
    if (props.state.searchQuery) {
      (props.state.searchQuery as Ref<string>).value = val;
    }
  },
});
const selectedNetwork = computed({
  get: () => (props.state.selectedNetwork?.value as "mainnet" | "testnet") ?? "mainnet",
  set: (val: "mainnet" | "testnet") => {
    if (props.state.selectedNetwork) {
      (props.state.selectedNetwork as Ref<string>).value = val;
    }
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
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.explorer-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

/* ── Search ── */
.search-card {
  width: 100%;
}

.search-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.network-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
}

/* ── Loading ── */
.loading {
  text-align: center;
  padding: 20px;
  animation: blink 1s infinite;
}

/* ── Results ── */
.section-title {
  @include stat-label;
  color: var(--matrix-success, rgba(0, 229, 153, 1));
  margin-bottom: 12px;
  display: block;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.result-card {
  margin-bottom: 12px;
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  @include card-base(12px, 12px);
  backdrop-filter: blur(5px);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
  }
}

.label {
  @include stat-label;
  font-weight: 600;
  margin-bottom: 4px;
  display: block;
}

.value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.mono {
  font-family: $font-mono;
}

/* ── Recent Transactions ── */
.recent-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tx-card {
  cursor: pointer;
  margin-bottom: 4px;
}

.tx-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tx-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tx-hash {
  font-family: $font-mono;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tx-time {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}

.vm-state {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 100px;

  &.HALT {
    background: rgba(0, 229, 153, 0.1);
    color: var(--matrix-success, #00e599);
    border: 1px solid rgba(0, 229, 153, 0.2);
  }

  &.FAULT {
    background: rgba(239, 68, 68, 0.1);
    color: var(--matrix-error, #ef4444);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
}

@media (max-width: 480px) {
  .explorer-play-area {
    padding: 12px 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading {
    animation: none;
  }
}
</style>
