<template>
  <view class="theme-event-ticket-pass">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="onTabChange"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <EventList
            :t="t"
            :address="address"
            :events="contract.events"
            :is-refreshing="contract.isRefreshing"
            :toggling-id="contract.togglingId"
            @refresh="contract.refreshEvents"
            @connect="contract.connectWallet"
            @issue="contract.openIssueModal"
            @toggle="contract.toggleEvent"
          />
        
      </template>

      <template #operation>
        <EventCreateForm
          :t="t"
          v-model:form="contract.form"
          :is-creating="contract.isCreating"
          @create="contract.createEvent"
        />
      </template>

      <template #tab-tickets>
        <TicketManagement
          :t="t"
          :address="address"
          :tickets="contract.tickets"
          :ticket-qrs="contract.ticketQrs"
          :is-refreshing="contract.isRefreshingTickets"
          @refresh="contract.refreshTickets"
          @connect="contract.connectWallet"
          @copy="contract.copyTokenId"
        />
      </template>

      <template #tab-checkin>
        <CheckinTab
          :t="t"
          v-model:token-id="contract.checkin.tokenId"
          :lookup="contract.lookup"
          :is-looking-up="contract.isLookingUp"
          :is-checking-in="contract.isCheckingIn"
          :status="status"
          @lookup="contract.lookupTicket"
          @checkin="contract.checkInTicket"
        />
      </template>
    </MiniAppShell>
  </view>
  <TicketIssueModal
    :t="t"
    :visible="contract.issueModalOpen"
    v-model:recipient="contract.issueForm.recipient"
    v-model:seat="contract.issueForm.seat"
    v-model:memo="contract.issueForm.memo"
    :is-issuing="contract.isIssuing"
    @close="contract.closeIssueModal"
    @issue="contract.issueTicket"
  />
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { useEventTicketContract } from "@/composables/useEventTicketContract";
import EventCreateForm from "./components/EventCreateForm.vue";
import EventList from "./components/EventList.vue";
import TicketManagement from "./components/TicketManagement.vue";
import CheckinTab from "./components/CheckinTab.vue";
import TicketIssueModal from "./components/TicketIssueModal.vue";

const { t } = createUseI18n(messages)();
const wallet = useWallet() as WalletSDK;
const { address, connect } = wallet;
const { ensure: ensureContractAddress } = useContractAddress(t);
const { status, setStatus } = useStatusMessage();

const contract = useEventTicketContract(wallet, ensureContractAddress, setStatus, t);

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "create", labelKey: "createTab", icon: "➕", default: true },
    { key: "tickets", labelKey: "ticketsTab", icon: "🎫" },
    { key: "checkin", labelKey: "checkinTab", icon: "✅" },
  ],
  docFeatureCount: 3,
});

const activeTab = ref("create");

const sidebarItems = createSidebarItems(t, [
  { labelKey: "sidebarEvents", value: () => contract.events.value.length },
  { labelKey: "sidebarTickets", value: () => contract.tickets.value.length },
  { labelKey: "sidebarActive", value: () => contract.events.value.filter((e) => e.active).length },
]);

const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: contract.isCreating.value,
  isRefreshing: contract.isRefreshing.value,
  eventsCount: contract.events.value.length,
  ticketsCount: contract.tickets.value.length,
}));

const onTabChange = async (tab: string) => {
  activeTab.value = tab;
  if (tab === "tickets") {
    await contract.refreshTickets();
  }
  if (tab === "create") {
    await contract.refreshEvents();
  }
};

const { handleBoundaryError } = useHandleBoundaryError("event-ticket-pass");

const resetAndReload = async () => {
  if (address.value) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  }
};

onMounted(async () => {
  await connect();
  if (address.value) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  }
});

watch(address, async (newAddr) => {
  if (newAddr) {
    await contract.refreshEvents();
    await contract.refreshTickets();
  } else {
    contract.events.value = [];
    contract.tickets.value = [];
    contract.lookup.value = null;
  }
});
</script>
<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./event-ticket-pass-theme.scss";
:global(page) {
  background: linear-gradient(135deg, var(--ticket-bg-start) 0%, var(--ticket-bg-end) 100%);
  color: var(--ticket-text);
}
</style>
