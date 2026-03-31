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
.neo-pay-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
}

.vaults-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
}

.streams-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  .connect-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(8px);
    text-align: center;
  }

  .connect-label {
    display: block;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 12px;
  }

  .connect-btn {
    :deep(.neo-btn) {
      background: linear-gradient(135deg, #00e599 0%, #00cc88 100%);
      color: #000;
      font-weight: 600;
      border-radius: 12px;
      transition: all 0.2s;

      &:hover {
        box-shadow: 0 8px 24px rgba(0, 229, 153, 0.3);
        transform: translateY(-1px);
      }
    }
  }
}
</style>
