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
      <NeoCard variant="erobo" class="p-6 text-center">
        <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" @click="handleConnect">
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
  gap: 16px;
  padding: 16px 0;
}

.vaults-header { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.section-title { font-size: 18px; font-weight: 700; }
.streams-container { display: flex; flex-direction: column; gap: 16px; }
.empty-state { margin-top: 10px; }
</style>
