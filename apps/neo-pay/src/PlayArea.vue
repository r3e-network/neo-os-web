<template>
  <div class="neo-pay-play-area">
    <PaymentTimeline
      :t="t"
      :display-streams="allStreams.slice(0, 5)"
      :created-count="createdStreams.length"
      :beneficiary-count="beneficiaryStreams.length"
      :active-count="activeCount"
    />

    <div class="vaults-header">
      <span class="section-title">{{ t("vaultsTab") }}</span>
      <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="handleRefresh">
        {{ t("refresh") }}
      </NeoButton>
    </div>

    <div v-if="!address" class="empty-state">
      <NeoCard variant="erobo" class="connect-card">
        <span class="connect-label">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" class="connect-btn" @click="handleConnect">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <div v-else class="streams-container">
      <StreamList :streams="createdStreams" :label="t('myCreated')" :empty-text="t('emptyVaults')" type="created">
        <template #actions="{ stream: s }">
          <NeoButton
            size="sm"
            variant="secondary"
            :loading="cancellingId === s.id"
            :disabled="s.status !== 'active'"
            @click="handleCancel(s)"
          >
            {{ cancellingId === s.id ? t("cancelling") : t("cancel") }}
          </NeoButton>
        </template>
      </StreamList>

      <StreamList
        :streams="beneficiaryStreams"
        :label="t('beneficiaryVaults')"
        :empty-text="t('emptyVaults')"
        type="beneficiary"
      >
        <template #actions="{ stream: s }">
          <NeoButton
            size="sm"
            variant="primary"
            :loading="claimingId === s.id"
            :disabled="s.status !== 'active' || s.claimable === 0n"
            @click="handleClaim(s)"
          >
            {{ claimingId === s.id ? t("claiming") : t("claim") }}
          </NeoButton>
        </template>
      </StreamList>
    </div>

    <StreamCreateForm :loading="isLoading" @create="handleCreateVault" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import StreamList from "./components/StreamList.vue";
import StreamCreateForm from "./components/StreamCreateForm.vue";
import PaymentTimeline from "./components/PaymentTimeline.vue";
import type { StreamItem } from "./types";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const address = computed(() => String(props.state.address?.value ?? ""));
const createdStreams = computed(() => (props.state.createdStreams?.value ?? []) as StreamItem[]);
const beneficiaryStreams = computed(() => (props.state.beneficiaryStreams?.value ?? []) as StreamItem[]);
const allStreams = computed(() => [...createdStreams.value, ...beneficiaryStreams.value]);
const activeCount = computed(() => Number(props.state.activeCount?.value ?? 0));
const isLoading = computed(() => Boolean(props.state.isLoading?.value));
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value));
const claimingId = computed(() => (props.state.claimingId?.value as string | null) ?? null);
const cancellingId = computed(() => (props.state.cancellingId?.value as string | null) ?? null);

const handleRefresh = async () => {
  const handler = actions.get("refreshStreams");
  if (handler) await handler();
};

const handleConnect = async () => {
  const handler = actions.get("connectWallet");
  if (handler) await handler();
};

const handleCreateVault = async (formData: unknown) => {
  const handler = actions.get("createVault");
  if (handler) await handler(formData);
};

const handleClaim = async (stream: StreamItem) => {
  const handler = actions.get("claimStream");
  if (handler) await handler(stream);
};

const handleCancel = async (stream: StreamItem) => {
  const handler = actions.get("cancelStream");
  if (handler) await handler(stream);
};
</script>

<style lang="scss" scoped>
@use "./pages/index/neo-pay-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');

.neo-pay-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 16px;
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  min-height: 300px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 260px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(59, 130, 246, 0.1) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.vaults-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--stream-surface, rgba(15, 28, 50, 0.65));
  border: 1px solid var(--stream-card-border, rgba(59, 130, 246, 0.22));
  border-radius: 14px;
  backdrop-filter: blur(12px);

  :deep(.neo-btn) {
    font-family: var(--stream-font, 'DM Sans', sans-serif);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.02em;
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    color: var(--stream-accent, #3B82F6);
    transition: all 0.25s ease;

    &:hover {
      background: rgba(59, 130, 246, 0.18);
      border-color: rgba(59, 130, 246, 0.35);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
    }
  }
}

.section-title {
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--stream-muted, rgba(232, 237, 245, 0.55));
}

.streams-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

:deep(.stream-item),
:deep(.neo-card) {
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  background: var(--stream-card-bg, rgba(10, 22, 40, 0.82));
  border: 1px solid var(--stream-card-border, rgba(59, 130, 246, 0.22));
  border-radius: 16px;
  box-shadow: var(--stream-card-shadow, 0 8px 32px rgba(6, 182, 212, 0.08));
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(59, 130, 246, 0.35);
    box-shadow:
      0 12px 40px rgba(6, 182, 212, 0.12),
      0 0 0 1px rgba(59, 130, 246, 0.08);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--primary) {
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  background: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 8px 28px rgba(59, 130, 246, 0.4);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--stream-accent-seafoam, #06B6D4);
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(6, 182, 212, 0.35);
  }
}

.empty-state {
  .connect-card {
    background: var(--stream-card-bg, rgba(10, 22, 40, 0.82));
    border: 1px solid var(--stream-card-border, rgba(59, 130, 246, 0.22));
    border-radius: 18px;
    padding: 32px 24px;
    backdrop-filter: blur(16px);
    text-align: center;
    box-shadow: var(--stream-card-shadow, 0 8px 32px rgba(6, 182, 212, 0.08));
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #3B82F6, #06B6D4, transparent);
      border-radius: 0 0 4px 4px;
    }
  }

  .connect-label {
    display: block;
    font-family: var(--stream-font, 'DM Sans', sans-serif);
    font-size: 14px;
    font-weight: 500;
    color: var(--stream-muted, rgba(232, 237, 245, 0.55));
    margin-bottom: 16px;
    letter-spacing: 0.01em;
  }

  .connect-btn {
    :deep(.neo-btn) {
      background: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
      color: #fff;
      font-family: var(--stream-font, 'DM Sans', sans-serif);
      font-weight: 600;
      border-radius: 12px;
      border: none;
      transition: all 0.25s ease;
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);

      &:hover {
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
        transform: translateY(-2px);
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .neo-pay-play-area::before {
    animation: none;
  }
  :deep(.stream-item):hover,
  :deep(.neo-card):hover {
    transform: none;
  }
}
</style>
